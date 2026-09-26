/**
 * Product gallery routes and the media sweep's view of them (plan KD-8, Unit 3).
 *
 * Through the real app (`createApp()`), so routing, `verifyToken`, `requireRole`, the upload
 * limiter, multer, the magic-byte check and the contract parse are all on the path -- the
 * boundary is what these assert, not the service alone. Media goes to a `LocalStorageDriver`
 * in a temp directory so "nothing stays stored" is read off real files.
 *
 * The upload limiter allows 10 uploads per window per IP and is module-scoped, so this file
 * seeds rows by SQL wherever an upload is not the subject. Concurrency and rollback live in
 * `tests/concurrency/productImages.concurrency.test.ts`: pg-mem has no MVCC and never rolls
 * back.
 */
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { LocalStorageDriver } from '../src/storage/localDriver';
import { setStorage, resetStorage } from '../src/storage';
import { sweepOrphanedMedia } from '../src/scheduler/mediaSweep';
import { startHttpApp, type HttpHarness, type JsonRow } from './support/httpApp';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(20)]);
const HOUR = 60 * 60 * 1000;

describe('product gallery images', () => {
  let testPool: PgPool;
  let root: string;
  let driver: LocalStorageDriver;
  let admin: HttpHarness;
  let cashier: HttpHarness;

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'moon-gallery-'));
    driver = new LocalStorageDriver({ root });
    setStorage(driver);
    admin = await startHttpApp('Admin');
    cashier = await startHttpApp('Cashier');
  });

  afterAll(async () => {
    await admin.close();
    await cashier.close();
    resetStorage();
    await fs.rm(root, { recursive: true, force: true });
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM product_images');
    await testPool.query('DELETE FROM products');
    await testPool.query(
      `INSERT INTO products (id, name, sku, price, stock, status)
       VALUES (1, 'Silk dress', 'SKU-1', 100, 5, 'active'),
              (2, 'Linen shirt', 'SKU-2', 100, 5, 'active'),
              (3, 'Old coat', 'SKU-3', 100, 5, 'discontinued')`
    );
    await fs.rm(path.join(root, 'products'), { recursive: true, force: true });
  });

  const storedKeys = async () => (await driver.list('products')).map((o) => o.key).sort();

  /** Inserts gallery rows directly, returning their ids in position order. */
  const seedImages = async (productId: number, count: number): Promise<number[]> => {
    const ids: number[] = [];
    for (let position = 0; position < count; position += 1) {
      const { rows } = await testPool.query<{ id: number }>(
        `INSERT INTO product_images (product_id, image_url, position)
         VALUES ($1, $2, $3) RETURNING id`,
        [productId, `/uploads/products/seed-${productId}-${position}.png`, position]
      );
      ids.push(rows[0].id);
    }
    return ids;
  };

  const orderOf = async (productId: number) => {
    const { rows } = await testPool.query<{ id: number; position: number }>(
      'SELECT id, position FROM product_images WHERE product_id = $1 ORDER BY position ASC',
      [productId]
    );
    return rows.map((r) => [r.id, r.position]);
  };

  it('appends uploads at positions 0 and 1 and lists them in that order', async () => {
    const first = await admin.upload('/api/v1/products/1/images', 'image', 'a.png', PNG);
    const second = await admin.upload('/api/v1/products/1/images', 'image', 'b.png', PNG);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect([first.body.data.position, second.body.data.position]).toEqual([0, 1]);

    const list = await cashier.request('GET', '/api/v1/products/1/images');
    expect(list.status).toBe(200);
    expect(list.body.data.map((row: JsonRow) => [row.id, row.position])).toEqual([
      [first.body.data.id, 0],
      [second.body.data.id, 1],
    ]);
    expect(await storedKeys()).toHaveLength(2);
  });

  it('refuses a ninth image with 409 GALLERY_FULL and stores nothing', async () => {
    await seedImages(1, 8);

    const res = await admin.upload('/api/v1/products/1/images', 'image', 'ninth.png', PNG);

    expect(res.status).toBe(409);
    expect(res.body.error.details[0]).toMatchObject({ field: 'image', code: 'GALLERY_FULL' });
    expect(await orderOf(1)).toHaveLength(8);
    expect(await storedKeys()).toEqual([]);
  });

  /**
   * HIGH-6: the two configuration-level refusals - the size limit and the extension
   * allowlist - were asserted as *multer configuration* (`storage.test.ts`) rather than
   * as HTTP responses, so nobody noticed both answered 500 INTERNAL_ERROR against a
   * contract that publishes 400. The one refusal asserted end to end was the magic-byte
   * check below, which is the one implemented as ordinary middleware and worked.
   *
   * Test the boundary, not the configuration (root CLAUDE.md -> Learnings).
   */
  it('refuses an oversized image with a typed error naming the limit, writing nothing', async () => {
    // Over the route's 2 MB ceiling; the PNG header keeps it a real image, so the only
    // thing being tested is the size refusal.
    const oversized = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024, 0x7f)]);

    const res = await admin.upload('/api/v1/products/1/images', 'image', 'huge.png', oversized);

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/2 MB/);
    expect(await orderOf(1)).toEqual([]);
    expect(await storedKeys()).toEqual([]);
  });

  it('refuses a disallowed file type with a typed error naming the formats, writing nothing', async () => {
    const res = await admin.upload('/api/v1/products/1/images', 'image', 'animated.gif', PNG);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/JPEG, PNG, and WebP/);
    expect(await orderOf(1)).toEqual([]);
    expect(await storedKeys()).toEqual([]);
  });

  it('refuses an oversized image on the primary-image route too', async () => {
    const oversized = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024, 0x7f)]);

    const res = await admin.upload('/api/v1/products/1/image', 'image', 'huge.png', oversized);

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await storedKeys()).toEqual([]);
  });

  it('rejects bytes that are not an image with 400, writing nothing', async () => {
    const res = await admin.upload(
      '/api/v1/products/1/images',
      'image',
      'fake.png',
      Buffer.from('<?php echo 1; ?>')
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await orderOf(1)).toEqual([]);
    expect(await storedKeys()).toEqual([]);
  });

  it('refuses gallery writes on a discontinued product, like the primary image route', async () => {
    const [imageId] = await seedImages(3, 1);
    const reorder = await admin.request('PUT', '/api/v1/products/3/images/order', {
      imageIds: [imageId],
    });
    const remove = await admin.request('DELETE', `/api/v1/products/3/images/${imageId}`);
    expect([reorder.status, remove.status]).toEqual([403, 403]);
    expect(await orderOf(3)).toHaveLength(1);
  });

  it('removes the row and then the stored object on delete', async () => {
    const uploaded = await admin.upload('/api/v1/products/1/images', 'image', 'a.png', PNG);
    expect(await storedKeys()).toHaveLength(1);

    const res = await admin.request('DELETE', `/api/v1/products/1/images/${uploaded.body.data.id}`);

    expect(res.status).toBe(204);
    expect(await orderOf(1)).toEqual([]);
    expect(await storedKeys()).toEqual([]);
  });

  it('answers 404 for an image that belongs to another product, leaving it in place', async () => {
    const [foreign] = await seedImages(2, 1);
    const res = await admin.request('DELETE', `/api/v1/products/1/images/${foreign}`);
    expect(res.status).toBe(404);
    expect(await orderOf(2)).toHaveLength(1);
  });

  it('swaps positions when reordered [b, a]', async () => {
    const [a, b] = await seedImages(1, 2);

    const res = await admin.request('PUT', '/api/v1/products/1/images/order', {
      imageIds: [b, a],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.map((row: JsonRow) => row.id)).toEqual([b, a]);
    expect(await orderOf(1)).toEqual([
      [b, 0],
      [a, 1],
    ]);
  });

  it('rejects a reorder list that is not exactly the current set, changing nothing', async () => {
    const [a, b, c] = await seedImages(1, 3);
    const [foreign] = await seedImages(2, 1);
    const before = await orderOf(1);

    for (const imageIds of [
      [a, b], // missing one
      [a, b, foreign], // another product's image
      [a, b, b], // duplicate
      [a, b, c, foreign], // extra
    ]) {
      const res = await admin.request('PUT', '/api/v1/products/1/images/order', { imageIds });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toMatchObject({
        field: 'imageIds',
        code: 'IMAGE_SET_MISMATCH',
      });
    }

    const malformed = await admin.request('PUT', '/api/v1/products/1/images/order', {
      imageIds: [a, b, c],
      extra: true,
    });
    expect(malformed.status).toBe(400);
    expect(await orderOf(1)).toEqual(before);
  });

  it('refuses every gallery write to a non-admin token with 403', async () => {
    const [imageId] = await seedImages(1, 1);
    const results = [
      await cashier.upload('/api/v1/products/1/images', 'image', 'a.png', PNG),
      await cashier.request('PUT', '/api/v1/products/1/images/order', { imageIds: [imageId] }),
      await cashier.request('DELETE', `/api/v1/products/1/images/${imageId}`),
      await cashier.upload('/api/v1/collections/1/image', 'image', 'a.png', PNG),
      await cashier.request('DELETE', '/api/v1/collections/1/image'),
    ];
    expect(results.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
    expect(await orderOf(1)).toHaveLength(1);
    expect(await storedKeys()).toEqual([]);
  });

  it('keeps a gallery image through the sweep and deletes an unreferenced old file', async () => {
    const uploaded = await admin.upload('/api/v1/products/1/images', 'image', 'keep.png', PNG);
    const galleryKey = driver.keyFromUrl(uploaded.body.data.image_url as string);
    expect(galleryKey).toBeTruthy();
    await driver.put('products/orphan.png', PNG, { contentType: 'image/png' });

    // Both files are older than the grace window, so only the reference decides.
    const old = new Date(Date.now() - 48 * HOUR);
    for (const key of [galleryKey as string, 'products/orphan.png']) {
      await fs.utimes(path.join(root, ...key.split('/')), old, old);
    }

    const outcome = await sweepOrphanedMedia({
      pool: testPool,
      storage: driver,
      minAgeMs: 24 * HOUR,
    });

    expect(outcome).toMatchObject({ scanned: 2, deleted: 1, failed: 0 });
    expect(await storedKeys()).toEqual([galleryKey]);
  });
});
