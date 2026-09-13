/**
 * Branch deactivation against a migrated database (#163).
 *
 * A branch is never hard-deleted: `branch_inventory` cascades on delete, and
 * `branch_transfers` references branches with no ON DELETE at all. These assertions run
 * on a real schema rather than a mocked `query`, because "the referencing rows are still
 * there" is exactly what a stub cannot prove.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { BranchesRepository } from '../src/modules/core/branches/repository';
import { BranchesService } from '../src/modules/core/branches/service';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

describe('branch deactivation', () => {
  let testPool: PgPool;
  const service = new BranchesService(new BranchesRepository());
  let mainId: number;
  let storeId: number;

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM branch_transfers');
    await testPool.query('DELETE FROM branch_inventory');
    await testPool.query('DELETE FROM branches');
    await testPool.query('DELETE FROM products');

    await testPool.query(
      `INSERT INTO products (id, name, sku, price, stock) VALUES (10, 'Silk scarf', 'SKU-10', 100, 5)`
    );
    const main = await testPool.query<{ id: number }>(
      `INSERT INTO branches (name, code, is_main) VALUES ('Maadi', 'MAADI', 1) RETURNING id`
    );
    const store = await testPool.query<{ id: number }>(
      `INSERT INTO branches (name, code, is_main) VALUES ('Zamalek', 'ZMLK', 0) RETURNING id`
    );
    mainId = main.rows[0].id;
    storeId = store.rows[0].id;

    await testPool.query(
      'INSERT INTO branch_inventory (branch_id, product_id, stock) VALUES ($1, 10, 7)',
      [storeId]
    );
    await testPool.query(
      `INSERT INTO branch_transfers (source_branch_id, target_branch_id, product_id, quantity)
       VALUES ($1, $2, 10, 2)`,
      [mainId, storeId]
    );
  });

  it('marks the branch inactive and keeps its inventory and transfer rows', async () => {
    const branch = await service.deactivate(storeId);
    expect(branch.status).toBe('inactive');

    const stored = await testPool.query('SELECT status FROM branches WHERE id = $1', [storeId]);
    expect(stored.rows[0].status).toBe('inactive');

    const inventory = await testPool.query(
      'SELECT stock FROM branch_inventory WHERE branch_id = $1',
      [storeId]
    );
    expect(inventory.rows).toHaveLength(1);
    expect(inventory.rows[0].stock).toBe(7);

    const transfers = await testPool.query(
      'SELECT id FROM branch_transfers WHERE target_branch_id = $1',
      [storeId]
    );
    expect(transfers.rows).toHaveLength(1);
  });

  it('is idempotent: deactivating an inactive branch succeeds and changes nothing', async () => {
    await service.deactivate(storeId);
    const again = await service.deactivate(storeId);
    expect(again.status).toBe('inactive');
  });

  it('refuses the main branch with a 409 and leaves it active', async () => {
    await expect(service.deactivate(mainId)).rejects.toMatchObject({ code: 'CONFLICT' });
    const stored = await testPool.query('SELECT status FROM branches WHERE id = $1', [mainId]);
    expect(stored.rows[0].status).toBe('active');
  });

  it('answers an unknown id with a 404', async () => {
    await expect(service.deactivate(999999)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
