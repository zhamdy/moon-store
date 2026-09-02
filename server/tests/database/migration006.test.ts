/**
 * Migration 006 — `collection_products.position`.
 *
 * The assertions here are about real PostgreSQL semantics: catalog shape, NOT NULL,
 * SQLSTATE 23505 from the unique constraint, and a backfill applied over rows that
 * predate the column. pg-mem models none of those faithfully, so this file runs on the
 * real-PostgreSQL harness. The ordering behaviour the application relies on is covered
 * on pg-mem in `tests/collections.test.ts`.
 */
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import path from 'path';
import fs from 'fs';
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
const MIGRATION = '006_collection_product_position.sql';
const CONSTRAINT = 'collection_products_position_unique';

/**
 * How many migrations sit on top of (and including) `name`. Other migrations land in this
 * directory over time, so `runMigrationsDown(1)` would eventually roll back somebody
 * else's file instead of this one.
 */
async function depthOf(pool: Pool, name: string): Promise<number> {
  const applied = await getAppliedMigrations(pool);
  const index = applied.indexOf(name);
  expect(index, `${name} should be applied`).toBeGreaterThanOrEqual(0);
  return applied.length - index;
}

describeWithPostgres('migration 006 — collection product position', () => {
  let harness: RealPostgresHarness;

  beforeAll(async () => {
    harness = await setupRealPostgres('migration-006', { maxConnections: 3 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  afterEach(async () => {
    await harness.truncate();
  });

  it('adds position as a NOT NULL integer on collection_products', async () => {
    const { rows } = await harness.pool.query<{
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'collection_products' AND column_name = 'position'`,
      [harness.schema]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('integer');
    expect(rows[0].is_nullable).toBe('NO');
    // No default on purpose: every writer states the slot it is claiming, so a caller
    // that forgets fails loudly instead of silently landing on 0.
    expect(rows[0].column_default).toBeNull();
  });

  it('adds a non-deferrable unique constraint on (collection_id, position)', async () => {
    const { rows } = await harness.pool.query<{
      condeferrable: boolean;
      columns: string[];
    }>(
      `SELECT c.condeferrable,
              ARRAY(SELECT a.attname FROM unnest(c.conkey) k
                      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k)::text[] AS columns
         FROM pg_constraint c
        WHERE c.conname = $1 AND c.connamespace = $2::regnamespace`,
      [CONSTRAINT, harness.schema]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].columns.sort()).toEqual(['collection_id', 'position']);
    expect(rows[0].condeferrable).toBe(false);
  });

  it('rejects two products claiming the same slot with SQLSTATE 23505', async () => {
    const { rows: collections } = await harness.pool.query<{ id: number }>(
      "INSERT INTO collections (name) VALUES ('Window') RETURNING id"
    );
    const collectionId = collections[0].id;
    const { rows: products } = await harness.pool.query<{ id: number }>(
      `INSERT INTO products (name, sku, price, stock)
       VALUES ('A', 'SKU-A', 10, 1), ('B', 'SKU-B', 10, 1) RETURNING id`
    );

    await harness.pool.query(
      'INSERT INTO collection_products (collection_id, product_id, position) VALUES ($1, $2, 0)',
      [collectionId, products[0].id]
    );

    await expect(
      harness.pool.query(
        'INSERT INTO collection_products (collection_id, product_id, position) VALUES ($1, $2, 0)',
        [collectionId, products[1].id]
      )
    ).rejects.toMatchObject({ code: '23505', constraint: CONSTRAINT });

    // The same slot in a *different* collection is fine — the constraint is scoped.
    const { rows: other } = await harness.pool.query<{ id: number }>(
      "INSERT INTO collections (name) VALUES ('Other window') RETURNING id"
    );
    await expect(
      harness.pool.query(
        'INSERT INTO collection_products (collection_id, product_id, position) VALUES ($1, $2, 0)',
        [other[0].id, products[1].id]
      )
    ).resolves.toBeDefined();
  });

  it('backfills pre-existing rows deterministically by product_id, dense from zero', async () => {
    // A database that predates this migration: the join table has rows, and none of them
    // carries an order. Roll 006 back, write legacy rows, and re-apply it.
    const legacy = await setupRealPostgres('migration-006-legacy', {
      installAsAppPool: false,
      maxConnections: 2,
    });

    try {
      await runMigrationsDown(await depthOf(legacy.pool, MIGRATION), legacy.pool, MIGRATIONS_DIR);
      expect(await getAppliedMigrations(legacy.pool)).not.toContain(MIGRATION);

      const { rows: collections } = await legacy.pool.query<{ id: number }>(
        `INSERT INTO collections (name) VALUES ('Legacy A'), ('Legacy B') RETURNING id`
      );
      const [a, b] = collections.map((c) => c.id);
      const { rows: products } = await legacy.pool.query<{ id: number }>(
        `INSERT INTO products (name, sku, price, stock)
         VALUES ('p1','SKU-1',10,1), ('p2','SKU-2',10,1), ('p3','SKU-3',10,1) RETURNING id`
      );
      const [p1, p2, p3] = products.map((p) => p.id);

      // Inserted in descending product_id order, so a backfill that merely preserved
      // physical order would produce the opposite of the expected result.
      await legacy.pool.query(
        `INSERT INTO collection_products (collection_id, product_id)
         VALUES ($1,$4), ($1,$3), ($1,$2), ($5,$3), ($5,$2)`,
        [a, p1, p2, p3, b]
      );

      const applied = await runMigrationsUp(legacy.pool, MIGRATIONS_DIR);
      expect(applied).toContain(MIGRATION);

      const { rows } = await legacy.pool.query<{
        collection_id: number;
        product_id: number;
        position: number;
      }>(
        'SELECT collection_id, product_id, position FROM collection_products ORDER BY collection_id, position'
      );

      expect(rows).toEqual([
        { collection_id: a, product_id: p1, position: 0 },
        { collection_id: a, product_id: p2, position: 1 },
        { collection_id: a, product_id: p3, position: 2 },
        // Each collection is numbered independently and densely from zero, so B does
        // not continue A's numbering.
        { collection_id: b, product_id: p1, position: 0 },
        { collection_id: b, product_id: p2, position: 1 },
      ]);
    } finally {
      await legacy.teardown();
    }
  });

  it('rolls back cleanly and re-applies', async () => {
    const cycle = await setupRealPostgres('migration-006-cycle', {
      installAsAppPool: false,
      maxConnections: 2,
    });

    try {
      const depth = await depthOf(cycle.pool, MIGRATION);
      const rolledBack = await runMigrationsDown(depth, cycle.pool, MIGRATIONS_DIR);
      expect(rolledBack).toContain(MIGRATION);

      const { rows: gone } = await cycle.pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'collection_products' AND column_name = 'position'`,
        [cycle.schema]
      );
      expect(gone[0].n).toBe(0);

      const { rows: constraints } = await cycle.pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM pg_constraint
          WHERE connamespace = $1::regnamespace AND conname = $2`,
        [cycle.schema, CONSTRAINT]
      );
      expect(constraints[0].n).toBe(0);

      expect(await runMigrationsUp(cycle.pool, MIGRATIONS_DIR)).toContain(MIGRATION);
    } finally {
      await cycle.teardown();
    }
  });

  it('applies on a database built from an empty schema, in file order', async () => {
    // Not the same claim as the harness above: this asserts the whole chain runs against
    // a schema that has never held a table, which is what a first deployment does.
    const schema = `test_m006_chain_${Date.now().toString(36)}`;
    const admin = new Pool({ connectionString: TEST_DATABASE_URL });
    await admin.query(`CREATE SCHEMA "${schema}"`);

    const pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 2,
      options: `-c search_path=${schema}`,
    });

    try {
      const expected = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql') && !f.includes('.down.sql'))
        .sort();

      expect(await runMigrationsUp(pool, MIGRATIONS_DIR)).toEqual(expected);
      expect(expected).toContain(MIGRATION);

      const { rows } = await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = 'collection_products' AND column_name = 'position'`,
        [schema]
      );
      expect(rows[0].n).toBe(1);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });
});
