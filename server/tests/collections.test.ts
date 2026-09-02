/**
 * Collections: curated product order (#68).
 *
 * `CollectionsRepository` reads, orders by, and writes `collection_products.position`,
 * a column migration 006 adds. Before it existed every one of these paths raised
 * `42703 undefined_column`, so these assertions run against a migrated database rather
 * than a mocked `query` — a stub would have passed happily on the broken schema.
 *
 * pg-mem is enough here: the ordering and numbering rules are single-connection
 * behaviour. The one rule that needs genuine concurrency — two admins appending to the
 * same collection at once — lives in `tests/concurrency/collections.concurrency.test.ts`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { CollectionsRepository } from '../src/modules/inventory/collections/repository';
import { CollectionsService } from '../src/modules/inventory/collections/service';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

describe('collection product ordering', () => {
  let testPool: PgPool;
  let collectionId: number;
  const repo = new CollectionsRepository();
  const service = new CollectionsService(repo);

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM collection_products');
    await testPool.query('DELETE FROM collections');
    await testPool.query('DELETE FROM products');

    // Deliberately inserted so that the ids ascend while the names do not: an assertion
    // on curated order must be able to fail if the query silently falls back to id or
    // name order.
    await testPool.query(
      `INSERT INTO products (id, name, sku, price, stock)
       VALUES (10, 'Zebra coat', 'SKU-10', 100, 5),
              (11, 'Amber dress', 'SKU-11', 200, 5),
              (12, 'Marigold bag', 'SKU-12', 300, 5),
              (13, 'Cobalt scarf', 'SKU-13', 400, 5)`
    );
    const created = await testPool.query<{ id: number }>(
      "INSERT INTO collections (name) VALUES ('Autumn window') RETURNING id"
    );
    collectionId = created.rows[0].id;
  });

  const positionsOf = async (collectionId: number) => {
    const { rows } = await testPool.query<{ product_id: number; position: number }>(
      'SELECT product_id, position FROM collection_products WHERE collection_id = $1 ORDER BY position ASC',
      [collectionId]
    );
    return rows.map((r) => [r.product_id, r.position]);
  };

  it('returns the detail view in curated order, not id or name order', async () => {
    // The curated order is the reverse of the id order, so a query that dropped the
    // ORDER BY would produce the opposite result rather than an incidentally equal one.
    await repo.addProducts(collectionId, [12, 10, 11]);

    const detail = await service.findById(collectionId);

    expect(detail).not.toBeNull();
    expect(detail!.products.map((p) => p.id)).toEqual([12, 10, 11]);
    expect(detail!.products.map((p) => p.position)).toEqual([0, 1, 2]);
    // The join still returns the full product row the client renders.
    expect(detail!.products[0].name).toBe('Marigold bag');
    expect(detail!.products[0].sku).toBe('SKU-12');
  });

  it('numbers a fresh collection densely from zero in the order supplied', async () => {
    await repo.addProducts(collectionId, [11, 12, 10]);
    expect(await positionsOf(collectionId)).toEqual([
      [11, 0],
      [12, 1],
      [10, 2],
    ]);
  });

  it('appends after the products already in the collection instead of restarting at zero', async () => {
    await repo.addProducts(collectionId, [10, 11]);
    await repo.addProducts(collectionId, [12]);

    expect(await positionsOf(collectionId)).toEqual([
      [10, 0],
      [11, 1],
      [12, 2],
    ]);
  });

  it('numbers each collection independently', async () => {
    const other = await testPool.query<{ id: number }>(
      "INSERT INTO collections (name) VALUES ('Spring window') RETURNING id"
    );
    await repo.addProducts(collectionId, [10, 11]);
    await repo.addProducts(other.rows[0].id, [12, 10]);

    expect(await positionsOf(other.rows[0].id)).toEqual([
      [12, 0],
      [10, 1],
    ]);
  });

  it('treats an empty product list as a no-op', async () => {
    await repo.addProducts(collectionId, []);
    expect(await positionsOf(collectionId)).toEqual([]);
  });

  it('renumbers from zero when update() replaces the whole product set', async () => {
    await service.create({ name: 'Winter window', product_ids: [10, 11, 12] });
    const { rows } = await testPool.query<{ id: number }>(
      "SELECT id FROM collections WHERE name = 'Winter window'"
    );
    const id = rows[0].id;
    expect(await positionsOf(id)).toEqual([
      [10, 0],
      [11, 1],
      [12, 2],
    ]);

    // A reorder in this codebase is a full replace: delete every row, re-insert in the
    // caller's order. Dense positions must come back dense, not continue from 3.
    const result = await service.update(id, { name: 'Winter window', product_ids: [12, 10] });
    expect(result.success).toBe(true);
    expect(await positionsOf(id)).toEqual([
      [12, 0],
      [10, 1],
    ]);
  });

  it('keeps appending correctly across a gap left by a deleted product', async () => {
    await repo.addProducts(collectionId, [10, 11, 12]);
    // ON DELETE CASCADE removes the join row and leaves position 1 vacant. Contiguity is
    // not an invariant of the table; relative order and a working append are.
    await testPool.query('DELETE FROM products WHERE id = 11');

    await repo.addProducts(collectionId, [13]);

    expect(await positionsOf(collectionId)).toEqual([
      [10, 0],
      [12, 2],
      [13, 3],
    ]);
    const detail = await service.findById(collectionId);
    expect(detail!.products.map((p) => p.id)).toEqual([10, 12, 13]);
  });
});
