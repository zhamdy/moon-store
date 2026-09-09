/**
 * Migration 011 — retires the two columns that held a value nothing read.
 *
 * 009's legacy alignment added each new column beside the old one rather than replacing
 * it, so `purchase_orders` and `product_bundles` each ended up with two columns for one
 * value: written through one, read through the other. #129 and #124 corrected the read
 * side; this drops what is left.
 *
 * Real PostgreSQL rather than pg-mem because the whole assertion is about
 * `information_schema` and about what a rollback does to a column, which is exactly the
 * kind of DDL pg-mem approximates.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import path from 'path';
import { Pool } from 'pg';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import {
  runMigrationsDown,
  runMigrationsUp,
  getAppliedMigrations,
} from '../../src/database/migrate';

const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');
const MIGRATION = '011_retire_duplicate_value_columns.sql';

const DROPPED: ReadonlyArray<readonly [string, string]> = [
  ['purchase_orders', 'total_amount'],
  ['product_bundles', 'price'],
];

async function hasColumn(pool: Pool, table: string, column: string): Promise<boolean> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows[0].n === 1;
}

async function depthOf(pool: Pool, name: string): Promise<number> {
  const applied = await getAppliedMigrations(pool);
  const index = applied.indexOf(name);
  expect(index, `${name} should be applied`).toBeGreaterThanOrEqual(0);
  return applied.length - index;
}

describeWithPostgres('migration 011 — retiring the duplicate value columns', () => {
  let harness: RealPostgresHarness;

  beforeAll(async () => {
    harness = await setupRealPostgres('migration-011', { maxConnections: 3 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  it('leaves neither dead column on a fully migrated database', async () => {
    for (const [table, column] of DROPPED) {
      expect(await hasColumn(harness.pool, table, column), `${table}.${column}`).toBe(false);
    }
  });

  it('keeps the column each writer actually writes', async () => {
    expect(await hasColumn(harness.pool, 'purchase_orders', 'total')).toBe(true);
    expect(await hasColumn(harness.pool, 'product_bundles', 'bundle_price')).toBe(true);
  });

  it('leaves total_amount alone on the tables where it is live', async () => {
    // Only the `purchase_orders` one was dead. Dropping by column name across the schema
    // would have taken two columns that carry real money with it.
    expect(await hasColumn(harness.pool, 'expenses', 'total_amount')).toBe(true);
    expect(await hasColumn(harness.pool, 'layaway_plans', 'total_amount')).toBe(true);
  });

  it('restores both columns on rollback and drops them again on re-apply', async () => {
    const cycle = await setupRealPostgres('migration-011-cycle', {
      installAsAppPool: false,
      maxConnections: 2,
    });

    try {
      const depth = await depthOf(cycle.pool, MIGRATION);
      await runMigrationsDown(depth, cycle.pool, MIGRATIONS_DIR);
      expect(await getAppliedMigrations(cycle.pool)).not.toContain(MIGRATION);

      // The down is a real reversal of the schema, not a no-op.
      for (const [table, column] of DROPPED) {
        expect(await hasColumn(cycle.pool, table, column), `${table}.${column}`).toBe(true);
      }

      // Restored as 001 declared them: nullable, defaulting to 0.
      const { rows } = await cycle.pool.query<{ is_nullable: string; column_default: string }>(
        `SELECT is_nullable, column_default FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'purchase_orders' AND column_name = 'total_amount'`
      );
      expect(rows[0].is_nullable).toBe('YES');
      expect(rows[0].column_default).toContain('0');

      expect(await runMigrationsUp(cycle.pool, MIGRATIONS_DIR)).toContain(MIGRATION);
      for (const [table, column] of DROPPED) {
        expect(await hasColumn(cycle.pool, table, column), `${table}.${column}`).toBe(false);
      }
    } finally {
      await cycle.teardown();
    }
  });

  it('does not disturb the rows in the columns that survive', async () => {
    const cycle = await setupRealPostgres('migration-011-rows', {
      installAsAppPool: false,
      maxConnections: 2,
    });

    try {
      const depth = await depthOf(cycle.pool, MIGRATION);
      await runMigrationsDown(depth, cycle.pool, MIGRATIONS_DIR);

      await cycle.pool.query(
        `INSERT INTO purchase_orders (po_number, total, total_amount, status)
         VALUES ('PO-011-A', 500, 999, 'Draft')`
      );
      await cycle.pool.query(
        `INSERT INTO product_bundles (name, bundle_price, price) VALUES ('Bundle A', 250, 999)`
      );

      await runMigrationsUp(cycle.pool, MIGRATIONS_DIR);

      const po = await cycle.pool.query<{ total: string }>(
        "SELECT total FROM purchase_orders WHERE po_number = 'PO-011-A'"
      );
      expect(po.rows[0].total).toBe('500');

      const bundle = await cycle.pool.query<{ bundle_price: string }>(
        "SELECT bundle_price FROM product_bundles WHERE name = 'Bundle A'"
      );
      expect(bundle.rows[0].bundle_price).toBe('250');
    } finally {
      await cycle.teardown();
    }
  });
});
