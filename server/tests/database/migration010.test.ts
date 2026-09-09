/**
 * Migration 010 — narrows `purchase_orders_status_check` to the application vocabulary.
 *
 * 009 widened the CHECK to tolerate every legacy spelling it found, including three
 * ('pending', 'received', 'cancelled') for states the application already names in
 * TitleCase, and it never actually admitted 'Sent' or 'Partially Received' — the two
 * values the server, the client and the i18n catalogs have used since before 009 shipped.
 * A status write past 'Draft' has therefore been an unmapped SQLSTATE 23514 since 009.
 *
 * The backfill/CHECK-narrowing behaviour needs real PostgreSQL semantics (SQLSTATE,
 * constraint validation against existing rows), so this runs on the real-PostgreSQL
 * harness rather than pg-mem.
 */
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
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
const MIGRATION = '010_purchase_order_status_vocabulary.sql';
const CONSTRAINT = 'purchase_orders_status_check';

async function depthOf(pool: Pool, name: string): Promise<number> {
  const applied = await getAppliedMigrations(pool);
  const index = applied.indexOf(name);
  expect(index, `${name} should be applied`).toBeGreaterThanOrEqual(0);
  return applied.length - index;
}

async function insertPO(pool: Pool, status: string): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    'INSERT INTO purchase_orders (po_number, total, status) VALUES ($1, 0, $2) RETURNING id',
    [`PO-${status}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, status]
  );
  return rows[0].id;
}

async function statusOf(pool: Pool, id: number): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(
    'SELECT status FROM purchase_orders WHERE id = $1',
    [id]
  );
  return rows[0].status;
}

describeWithPostgres('migration 010 — purchase order status vocabulary', () => {
  let harness: RealPostgresHarness;

  beforeAll(async () => {
    harness = await setupRealPostgres('migration-010', { maxConnections: 3 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  afterEach(async () => {
    await harness.truncate();
  });

  it('accepts exactly the five application-vocabulary statuses', async () => {
    for (const status of ['Draft', 'Sent', 'Partially Received', 'Received', 'Cancelled']) {
      await expect(insertPO(harness.pool, status)).resolves.toBeTypeOf('number');
    }
  });

  it('rejects the 009-era legacy spellings with SQLSTATE 23514', async () => {
    for (const status of ['Ordered', 'Partial', 'pending', 'received', 'cancelled']) {
      await expect(insertPO(harness.pool, status)).rejects.toMatchObject({
        code: '23514',
        constraint: CONSTRAINT,
      });
    }
  });

  it('backfills legacy rows written before this migration to their canonical spelling', async () => {
    const legacy = await setupRealPostgres('migration-010-legacy', {
      installAsAppPool: false,
      maxConnections: 2,
    });

    try {
      const depth = await depthOf(legacy.pool, MIGRATION);
      await runMigrationsDown(depth, legacy.pool, MIGRATIONS_DIR);
      expect(await getAppliedMigrations(legacy.pool)).not.toContain(MIGRATION);

      const ordered = await insertPO(legacy.pool, 'Ordered');
      const partial = await insertPO(legacy.pool, 'Partial');
      const pending = await insertPO(legacy.pool, 'pending');
      const received = await insertPO(legacy.pool, 'received');
      const cancelled = await insertPO(legacy.pool, 'cancelled');
      const draft = await insertPO(legacy.pool, 'Draft');

      expect(await runMigrationsUp(legacy.pool, MIGRATIONS_DIR)).toContain(MIGRATION);

      expect(await statusOf(legacy.pool, ordered)).toBe('Sent');
      expect(await statusOf(legacy.pool, partial)).toBe('Partially Received');
      expect(await statusOf(legacy.pool, pending)).toBe('Draft');
      expect(await statusOf(legacy.pool, received)).toBe('Received');
      expect(await statusOf(legacy.pool, cancelled)).toBe('Cancelled');
      expect(await statusOf(legacy.pool, draft)).toBe('Draft');
    } finally {
      await legacy.teardown();
    }
  });

  it('rolls back to the 009 constraint list and re-applies (round trip)', async () => {
    const cycle = await setupRealPostgres('migration-010-cycle', {
      installAsAppPool: false,
      maxConnections: 2,
    });

    try {
      const sent = await insertPO(cycle.pool, 'Sent');
      const partiallyReceived = await insertPO(cycle.pool, 'Partially Received');

      const depth = await depthOf(cycle.pool, MIGRATION);
      expect(await runMigrationsDown(depth, cycle.pool, MIGRATIONS_DIR)).toContain(MIGRATION);

      // The down migration maps the application spellings back to their 009 equivalents.
      expect(await statusOf(cycle.pool, sent)).toBe('Ordered');
      expect(await statusOf(cycle.pool, partiallyReceived)).toBe('Partial');

      // The 009 list accepts a legacy spelling again post-rollback.
      await expect(insertPO(cycle.pool, 'pending')).resolves.toBeTypeOf('number');

      expect(await runMigrationsUp(cycle.pool, MIGRATIONS_DIR)).toContain(MIGRATION);
      expect(await statusOf(cycle.pool, sent)).toBe('Sent');
      expect(await statusOf(cycle.pool, partiallyReceived)).toBe('Partially Received');
    } finally {
      await cycle.teardown();
    }
  });
});
