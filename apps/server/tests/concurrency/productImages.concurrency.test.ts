/**
 * Product gallery invariants that pg-mem cannot prove (plan KD-8, Unit 3).
 *
 * - Appends compute `MAX(position) + 1`, which races under READ COMMITTED unless the product
 *   row is locked first; pg-mem has no MVCC, so an unlocked version would pass there.
 * - The cap is re-checked under that lock, and a refused append must remove the object it
 *   already wrote.
 * - PostgreSQL checks a non-deferrable UNIQUE per row, so a reorder that writes final
 *   positions in one pass collides with rows not yet moved. pg-mem's checking differs.
 * - A reorder that fails midway must leave the old order, which needs a real rollback.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { ProductsRepository } from '../../src/modules/inventory/products/repository';
import { ProductsService } from '../../src/modules/inventory/products/service';
import { setStorage, resetStorage } from '../../src/storage';
import type { PutOptions, StorageDriver, StoredObject } from '../../src/storage/types';
import type { Queryable } from '../../src/database/transaction';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(20)]);

/** In-memory store: what these tests read is which objects survived. */
class MemoryDriver implements StorageDriver {
  readonly name = 'memory';
  readonly objects = new Map<string, Date>();

  async put(key: string, _body: Buffer, _options: PutOptions): Promise<void> {
    this.objects.set(key, new Date());
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }
  async list(prefix: string): Promise<StoredObject[]> {
    return [...this.objects.entries()]
      .filter(([key]) => key.startsWith(`${prefix}/`))
      .map(([key, lastModified]) => ({ key, size: PNG.length, lastModified }));
  }
  publicUrl(key: string): string {
    return `/uploads/${key}`;
  }
  keyFromUrl(url: string): string | null {
    return url.startsWith('/uploads/') ? url.slice('/uploads/'.length) : null;
  }
  ownsUrl(url: string): boolean {
    return url.startsWith('/uploads/');
  }
}

describeWithPostgres('product gallery under concurrency', () => {
  let harness: RealPostgresHarness;
  let productId: number;
  let driver: MemoryDriver;
  const service = new ProductsService(new ProductsRepository());
  const upload = { buffer: PNG, mimetype: 'image/png' };

  beforeAll(async () => {
    harness = await setupRealPostgres('product-images-concurrency', { maxConnections: 6 });
  });

  afterAll(async () => {
    resetStorage();
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    driver = new MemoryDriver();
    setStorage(driver);
    const { rows } = await harness.pool.query<{ id: number }>(
      "INSERT INTO products (name, sku, price, stock) VALUES ('Silk dress', 'SKU-1', 100, 5) RETURNING id"
    );
    productId = rows[0].id;
  });

  const seedImages = async (count: number): Promise<number[]> => {
    const ids: number[] = [];
    for (let position = 0; position < count; position += 1) {
      const { rows } = await harness.pool.query<{ id: number }>(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ($1, $2, $3) RETURNING id`,
        [productId, `https://cdn.example.com/seed-${position}.png`, position]
      );
      ids.push(rows[0].id);
    }
    return ids;
  };

  const order = async (): Promise<number[][]> => {
    const { rows } = await harness.pool.query<{ id: number; position: number }>(
      'SELECT id, position FROM product_images WHERE product_id = $1 ORDER BY position ASC',
      [productId]
    );
    return rows.map((r) => [r.id, r.position]);
  };

  it('gives four simultaneous appends four distinct consecutive positions', async () => {
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map(() => service.addImage(productId, upload))
    );

    expect(results.map((r) => r.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
    expect((await order()).map(([, position]) => position)).toEqual([0, 1, 2, 3]);
    expect(driver.objects.size).toBe(4);
  });

  it('lets exactly one of three racing appends take the last slot, and keeps no loser object', async () => {
    await seedImages(7);

    const results = await Promise.allSettled(
      [1, 2, 3].map(() => service.addImage(productId, upload))
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected.map((r) => (r.reason as { code: string }).code)).toEqual([
      'CONFLICT',
      'CONFLICT',
    ]);
    expect(await order()).toHaveLength(8);
    // Seeded rows point at a foreign CDN, so the only object left is the winner's.
    expect(driver.objects.size).toBe(1);
  });

  it('reverses eight images, which a one-pass position write cannot do on PostgreSQL', async () => {
    const ids = await seedImages(8);

    // The naive form: every target position is still held by a row not yet moved.
    await expect(
      harness.pool.query(
        'UPDATE product_images SET position = 7 - position WHERE product_id = $1',
        [productId]
      )
    ).rejects.toMatchObject({ code: '23505' });

    const reversed = [...ids].reverse();
    await service.reorderImages(productId, reversed);
    expect(await order()).toEqual(reversed.map((id, position) => [id, position]));
  });

  it('leaves the previous order intact when a reorder fails between its passes', async () => {
    const ids = await seedImages(3);
    const before = await order();

    class FailingRepository extends ProductsRepository {
      override async rewriteImagePositions(
        id: number | string,
        _orderedIds: number[],
        queryable: Queryable
      ): Promise<void> {
        await queryable.query(
          'UPDATE product_images SET position = -1 - position WHERE product_id = $1',
          [id]
        );
        throw new Error('connection lost mid-reorder');
      }
    }
    const failing = new ProductsService(new FailingRepository());

    await expect(failing.reorderImages(productId, [...ids].reverse())).rejects.toThrow(
      'connection lost mid-reorder'
    );
    expect(await order()).toEqual(before);
  });
});
