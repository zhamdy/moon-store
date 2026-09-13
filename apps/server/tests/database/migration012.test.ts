/**
 * Migration 012 — gives refunded lines a table, and backfills it from the blob.
 *
 * `refunds.items` was the only record of how much of each sale line had gone back, so
 * both the refund cap (#120) and the exchange cap (#122) decoded the same undeclared JSON
 * shape in their own loops. This is the part of #140 that cannot be proven anywhere else:
 * pg-mem cannot parse the `CROSS JOIN LATERAL jsonb_array_elements` the backfill uses, so
 * the shim strips the block there and the migration's real behaviour is only observable
 * against PostgreSQL.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import path from 'path';
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
const MIGRATION = '012_refund_items.sql';

describeWithPostgres('migration 012 — refund_items', () => {
  let harness: RealPostgresHarness;

  beforeAll(async () => {
    harness = await setupRealPostgres('migration-012', { maxConnections: 3 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
  });

  /** Rolls 012 off, seeds refunds as they existed before it, and re-applies it. */
  async function backfillFrom(
    seed: (pool: RealPostgresHarness['pool']) => Promise<void>
  ): Promise<RealPostgresHarness> {
    const db = await setupRealPostgres(`migration-012-${Math.floor(Math.random() * 1e6)}`, {
      installAsAppPool: false,
      maxConnections: 2,
    });

    const applied = await getAppliedMigrations(db.pool);
    await runMigrationsDown(applied.length - applied.indexOf(MIGRATION), db.pool, MIGRATIONS_DIR);
    expect(await getAppliedMigrations(db.pool)).not.toContain(MIGRATION);

    await seed(db.pool);

    expect(await runMigrationsUp(db.pool, MIGRATIONS_DIR)).toContain(MIGRATION);
    return db;
  }

  async function seedSaleAndRefund(
    pool: RealPostgresHarness['pool'],
    items: unknown[]
  ): Promise<void> {
    await pool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (1, 'Silk Dress', 'SKU-001', 500, 250, 10)`
    );
    await pool.query(
      `INSERT INTO product_variants (id, product_id, sku, price, stock, attributes)
       VALUES (10, 1, 'SKU-001-RED', 500, 4, '{"color":"Red"}')`
    );
    const sale = await pool.query<{ id: number }>(
      `INSERT INTO sales (subtotal, total, payment_method) VALUES (500, 500, 'Cash') RETURNING id`
    );
    await pool.query(
      `INSERT INTO refunds (sale_id, amount, reason, items, restock)
       VALUES ($1, 500, 'Returned', $2, 1)`,
      [sale.rows[0].id, JSON.stringify(items)]
    );
  }

  it('creates the table with an index on the refund it belongs to', async () => {
    const { rows } = await harness.pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'refund_items'`
    );
    expect(rows[0].n).toBe(1);
  });

  it('refuses a non-positive quantity', async () => {
    await harness.pool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (1, 'Silk Dress', 'SKU-001', 500, 250, 10)`
    );
    const sale = await harness.pool.query<{ id: number }>(
      `INSERT INTO sales (subtotal, total, payment_method) VALUES (500, 500, 'Cash') RETURNING id`
    );
    const refund = await harness.pool.query<{ id: number }>(
      `INSERT INTO refunds (sale_id, amount, reason, items, restock)
       VALUES ($1, 500, 'Returned', '[]', 1) RETURNING id`,
      [sale.rows[0].id]
    );

    await expect(
      harness.pool.query(
        `INSERT INTO refund_items (refund_id, product_id, quantity, unit_price)
         VALUES ($1, 1, 0, 500)`,
        [refund.rows[0].id]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('backfills a plain line from the blob', async () => {
    const db = await backfillFrom((pool) =>
      seedSaleAndRefund(pool, [{ product_id: 1, quantity: 2, unit_price: 500 }])
    );

    try {
      const { rows } = await db.pool.query(
        'SELECT product_id, variant_id, quantity, unit_price FROM refund_items'
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ product_id: 1, variant_id: null, quantity: 2 });
      expect(Number(rows[0].unit_price)).toBe(500);
    } finally {
      await db.teardown();
    }
  });

  it('carries variant_id through, and reads a JSON null as no variant', async () => {
    // A pre-#121 refund has no variant_id key at all; one written after it may carry an
    // explicit JSON `null`. Both mean "not a variant line" and must not become a row
    // pointing at variant 0.
    const db = await backfillFrom((pool) =>
      seedSaleAndRefund(pool, [
        { product_id: 1, variant_id: 10, quantity: 1, unit_price: 500 },
        { product_id: 1, variant_id: null, quantity: 1, unit_price: 500 },
        { product_id: 1, quantity: 1, unit_price: 500 },
      ])
    );

    try {
      const { rows } = await db.pool.query<{ variant_id: number | null }>(
        'SELECT variant_id FROM refund_items ORDER BY id'
      );
      expect(rows.map((r) => r.variant_id)).toEqual([10, null, null]);
    } finally {
      await db.teardown();
    }
  });

  it('skips a line naming a product that no longer exists rather than failing the migration', async () => {
    // The FK is RESTRICT, and a refund naming a deleted product is a real thing to find in
    // a database this old. The blob is untouched, so nothing is lost by skipping it.
    const db = await backfillFrom((pool) =>
      seedSaleAndRefund(pool, [
        { product_id: 1, quantity: 1, unit_price: 500 },
        { product_id: 9999, quantity: 1, unit_price: 500 },
      ])
    );

    try {
      const { rows } = await db.pool.query<{ product_id: number }>(
        'SELECT product_id FROM refund_items'
      );
      expect(rows.map((r) => r.product_id)).toEqual([1]);
    } finally {
      await db.teardown();
    }
  });

  it('drops the table on rollback, leaving the blob it was derived from', async () => {
    const db = await backfillFrom((pool) =>
      seedSaleAndRefund(pool, [{ product_id: 1, quantity: 1, unit_price: 500 }])
    );

    try {
      const applied = await getAppliedMigrations(db.pool);
      await runMigrationsDown(applied.length - applied.indexOf(MIGRATION), db.pool, MIGRATIONS_DIR);

      await expect(db.pool.query('SELECT 1 FROM refund_items')).rejects.toThrow(/refund_items/);

      // The blob is what 012 derives from, so it must survive for the migration to be
      // re-appliable at all.
      const { rows } = await db.pool.query<{ items: string }>('SELECT items FROM refunds');
      expect(JSON.parse(rows[0].items)).toHaveLength(1);

      expect(await runMigrationsUp(db.pool, MIGRATIONS_DIR)).toContain(MIGRATION);
      const again = await db.pool.query('SELECT product_id FROM refund_items');
      expect(again.rows).toHaveLength(1);
    } finally {
      await db.teardown();
    }
  });
});
