/**
 * Migration 004 — idempotency keys and non-negative invariants.
 *
 * These assertions are about real PostgreSQL behavior (SQLSTATE codes, NOT VALID
 * semantics, JSONB round-tripping), so they run against the real-PostgreSQL harness
 * rather than pg-mem. The pg-mem suites still apply this migration; see
 * `tests/support/pgMem.ts` for the one clause they cannot parse.
 */
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import path from 'path';
import { Pool } from 'pg';
import {
  describeWithPostgres,
  setupRealPostgres,
  TEST_DATABASE_URL,
  type RealPostgresHarness,
} from '../support/realPostgres';
import {
  runMigrationsUp,
  runMigrationsDown,
  getAppliedMigrations,
} from '../../src/database/migrate';

const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');
const MIGRATION = '004_concurrency_and_idempotency.sql';

const NON_NEGATIVE_CONSTRAINTS = [
  ['products', 'products_stock_non_negative'],
  ['product_variants', 'product_variants_stock_non_negative'],
  ['gift_cards', 'gift_cards_balance_non_negative'],
  ['customers', 'customers_loyalty_points_non_negative'],
] as const;

describeWithPostgres('migration 004 — idempotency keys and non-negative invariants', () => {
  let harness: RealPostgresHarness;

  beforeAll(async () => {
    harness = await setupRealPostgres('migration-004');
  });

  afterAll(async () => {
    await harness.teardown();
  });

  afterEach(async () => {
    await harness.truncate();
  });

  it('creates idempotency_keys with the expected columns and a primary key on key', async () => {
    const { rows: columns } = await harness.pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'idempotency_keys'`,
      [harness.schema]
    );

    const byName = Object.fromEntries(columns.map((c) => [c.column_name, c]));

    expect(Object.keys(byName).sort()).toEqual([
      'created_at',
      'endpoint',
      'expires_at',
      'key',
      'request_fingerprint',
      'resource_id',
      'resource_type',
      'response_body',
      'response_status',
      'user_id',
    ]);

    expect(byName.response_body.data_type).toBe('jsonb');
    expect(byName.expires_at.is_nullable).toBe('NO');
    expect(byName.request_fingerprint.is_nullable).toBe('NO');
    expect(byName.endpoint.is_nullable).toBe('NO');
    // Only the outcome columns are nullable: a claim is written before the outcome exists.
    expect(byName.response_status.is_nullable).toBe('YES');

    const { rows: pk } = await harness.pool.query<{ column_name: string }>(
      `SELECT a.attname AS column_name
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = ($1 || '.idempotency_keys')::regclass AND c.contype = 'p'`,
      [harness.schema]
    );
    expect(pk.map((r) => r.column_name)).toEqual(['key']);
  });

  it('rejects a duplicate key with SQLSTATE 23505 — the claim-collision signal', async () => {
    const insert = `INSERT INTO idempotency_keys (key, endpoint, request_fingerprint, expires_at)
                    VALUES ($1, 'POST /api/v1/sales', 'fp', NOW() + INTERVAL '24 hours')`;

    await harness.pool.query(insert, ['dup-key']);

    await expect(harness.pool.query(insert, ['dup-key'])).rejects.toMatchObject({ code: '23505' });
  });

  it('round-trips a stored response body through JSONB unchanged', async () => {
    const body = { success: true, data: { id: 7, total: '199.99', items: [{ product_id: 3 }] } };

    await harness.pool.query(
      `INSERT INTO idempotency_keys
         (key, endpoint, request_fingerprint, response_status, response_body, resource_type, resource_id, expires_at)
       VALUES ('k', 'POST /api/v1/sales', 'fp', 201, $1, 'sale', 7, NOW() + INTERVAL '24 hours')`,
      [JSON.stringify(body)]
    );

    const { rows } = await harness.pool.query<{ response_body: unknown; response_status: number }>(
      'SELECT response_body, response_status FROM idempotency_keys WHERE key = $1',
      ['k']
    );

    expect(rows[0].response_body).toEqual(body);
    expect(rows[0].response_status).toBe(201);
  });

  it('adds all four non-negative constraints as NOT VALID', async () => {
    const { rows } = await harness.pool.query<{ conname: string; convalidated: boolean }>(
      `SELECT conname, convalidated
         FROM pg_constraint
        WHERE connamespace = $1::regnamespace AND contype = 'c'`,
      [harness.schema]
    );
    const byName = Object.fromEntries(rows.map((r) => [r.conname, r]));

    for (const [, constraint] of NON_NEGATIVE_CONSTRAINTS) {
      expect(byName[constraint], `${constraint} should exist`).toBeDefined();
      // NOT VALID is what lets this migration apply over already-negative legacy rows.
      expect(byName[constraint].convalidated, `${constraint} should be NOT VALID`).toBe(false);
    }
  });

  it('enforces the floors on new and updated rows', async () => {
    await harness.pool.query(
      "INSERT INTO products (name, sku, price, stock) VALUES ('Silk scarf', 'SKU-NEG', 100, 5)"
    );

    await expect(
      harness.pool.query("UPDATE products SET stock = -1 WHERE sku = 'SKU-NEG'")
    ).rejects.toMatchObject({ code: '23514', constraint: 'products_stock_non_negative' });

    await expect(
      harness.pool.query(
        "INSERT INTO products (name, sku, price, stock) VALUES ('Bad', 'SKU-BAD', 10, -3)"
      )
    ).rejects.toMatchObject({ code: '23514' });

    // The failed writes changed nothing.
    const { rows } = await harness.pool.query<{ stock: number }>(
      "SELECT stock FROM products WHERE sku = 'SKU-NEG'"
    );
    expect(rows[0].stock).toBe(5);
  });

  it('permits NULL loyalty_points, which the column still allows', async () => {
    // A CHECK passes on NULL. The constraint must not turn a nullable column into a
    // required one, or it would break every customer created without a points balance.
    await harness.pool.query(
      "INSERT INTO customers (name, phone, loyalty_points) VALUES ('No points', '+201000000001', NULL)"
    );

    const { rows } = await harness.pool.query<{ loyalty_points: number | null }>(
      "SELECT loyalty_points FROM customers WHERE phone = '+201000000001'"
    );
    expect(rows[0].loyalty_points).toBeNull();

    await expect(
      harness.pool.query(
        "INSERT INTO customers (name, phone, loyalty_points) VALUES ('Negative', '+201000000002', -1)"
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('applies over pre-existing negative rows because the constraints are NOT VALID', async () => {
    // A database that predates this migration: 001-003 applied, stock already negative
    // because nothing guarded exchanges. Applying 004 must not fail on that legacy row.
    const legacy = await setupRealPostgres('migration-004-legacy', { installAsAppPool: false });

    try {
      await runMigrationsDown(1, legacy.pool, MIGRATIONS_DIR);
      expect(await getAppliedMigrations(legacy.pool)).not.toContain(MIGRATION);

      await legacy.pool.query(
        "INSERT INTO products (name, sku, price, stock) VALUES ('Oversold', 'SKU-LEGACY', 10, -4)"
      );

      const applied = await runMigrationsUp(legacy.pool, MIGRATIONS_DIR);
      expect(applied).toEqual([MIGRATION]);

      // The legacy row survives untouched; only new writes are policed.
      const { rows } = await legacy.pool.query<{ stock: number }>(
        "SELECT stock FROM products WHERE sku = 'SKU-LEGACY'"
      );
      expect(rows[0].stock).toBe(-4);

      await expect(
        legacy.pool.query("UPDATE products SET stock = -5 WHERE sku = 'SKU-LEGACY'")
      ).rejects.toMatchObject({ code: '23514' });
    } finally {
      await legacy.teardown();
    }
  });

  it('rolls back cleanly and re-applies (down then up leaves _migrations consistent)', async () => {
    const cycle = await setupRealPostgres('migration-004-cycle', { installAsAppPool: false });

    try {
      const rolledBack = await runMigrationsDown(1, cycle.pool, MIGRATIONS_DIR);
      expect(rolledBack).toEqual([MIGRATION]);

      const gone = await cycle.pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = 'idempotency_keys'`,
        [cycle.schema]
      );
      expect(gone.rows[0].n).toBe(0);

      const constraints = await cycle.pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM pg_constraint
          WHERE connamespace = $1::regnamespace AND conname = ANY($2)`,
        [cycle.schema, NON_NEGATIVE_CONSTRAINTS.map(([, c]) => c)]
      );
      expect(constraints.rows[0].n).toBe(0);

      // A negative row is writable again once the floors are dropped.
      await cycle.pool.query(
        "INSERT INTO products (name, sku, price, stock) VALUES ('Rolled back', 'SKU-CYCLE', 10, -1)"
      );

      expect(await runMigrationsUp(cycle.pool, MIGRATIONS_DIR)).toEqual([MIGRATION]);
      expect(await getAppliedMigrations(cycle.pool)).toEqual([
        '001_initial_schema.sql',
        '002_checkout_financial_contract.sql',
        '003_sale_calculation_snapshot.sql',
        MIGRATION,
      ]);
    } finally {
      await cycle.teardown();
    }
  });

  it('applies on top of 001-003 in order on a database built from scratch', async () => {
    const schema = `test_m004_chain_${Date.now().toString(36)}`;
    const admin = new Pool({ connectionString: TEST_DATABASE_URL });
    await admin.query(`CREATE SCHEMA "${schema}"`);

    const pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });

    try {
      expect(await runMigrationsUp(pool, MIGRATIONS_DIR)).toEqual([
        '001_initial_schema.sql',
        '002_checkout_financial_contract.sql',
        '003_sale_calculation_snapshot.sql',
        MIGRATION,
      ]);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });
});
