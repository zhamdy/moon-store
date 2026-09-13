/**
 * The migration runner against a real sequence.
 *
 * `_migrations.id` is a SERIAL, so the next insert takes its value from a sequence rather
 * than from the table. Anything that writes rows without advancing that sequence — a
 * `pg_dump`/restore, a `TRUNCATE ... RESTART IDENTITY`, a schema copied between databases
 * — leaves the counter behind the data, and the next migration dies on
 * `duplicate key value violates unique constraint "_migrations_pkey"`. That message names
 * the bookkeeping table and says nothing about which migration or how to recover; it
 * reads like corruption and is a stale counter.
 *
 * Seen on a developer database restored from a dump: every migration after 001 refused to
 * apply, so `refresh_tokens.token_hash` was missing, `POST /auth/login` answered 500, and
 * the app looked broken from the frontend down — pages crashing on undefined data because
 * every request was failing.
 *
 * This lives here rather than beside the other migration tests because pg-mem implements
 * SERIAL without exposing a sequence object: `tests/support/pgMem.ts` registers
 * `setval` as a no-op, so the desync being guarded against cannot be created there. A
 * test that cannot reproduce the fault cannot prove the fix.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import path from 'path';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { ensureMigrationTable, runMigrationsUp } from '../../src/database/migrate';

const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');

describeWithPostgres('migration bookkeeping against a real sequence', () => {
  let harness: RealPostgresHarness;

  beforeAll(async () => {
    harness = await setupRealPostgres('migrations-sequence', { maxConnections: 3 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  it('applies a migration when the id sequence has been left behind the rows', async () => {
    // The harness already migrated this schema. Reproduce a restored dump: the rows are
    // there, the counter is not.
    await harness.pool.query(
      `SELECT setval(pg_get_serial_sequence('_migrations', 'id'), 1, false)`
    );

    // Make one migration pending again so an INSERT actually has to happen.
    await harness.pool.query(`DELETE FROM _migrations WHERE name = '008_collection_year.sql'`);
    await harness.pool.query('ALTER TABLE collections DROP COLUMN IF EXISTS year');

    const applied = await runMigrationsUp(harness.pool, MIGRATIONS_DIR);

    expect(applied).toEqual(['008_collection_year.sql']);
    const { rows } = await harness.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'collections' AND column_name = 'year'
       ) AS exists`
    );
    expect(rows[0].exists, 'the migration actually ran, not just its bookkeeping').toBe(true);
  });

  it('realigns the sequence rather than leaving it for the next caller', async () => {
    await harness.pool.query(
      `SELECT setval(pg_get_serial_sequence('_migrations', 'id'), 1, false)`
    );

    await ensureMigrationTable(harness.pool);

    // The repair is idempotent and does not depend on a migration being pending, so a
    // plain insert succeeds immediately afterwards.
    await expect(
      harness.pool.query(`INSERT INTO _migrations (name) VALUES ('sequence-probe.sql')`)
    ).resolves.toBeTruthy();
    await harness.pool.query(`DELETE FROM _migrations WHERE name = 'sequence-probe.sql'`);
  });
});
