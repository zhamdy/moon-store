/**
 * Proves every migration's `.down.sql` actually reverses its `.sql`.
 *
 * Nothing else checks this. Migrations run implicitly inside `tests/support/realPostgres.ts`
 * when a suite asks for a schema, which exercises `up` on an empty database and nothing
 * else — so a down migration that quietly fails to undo its up is invisible until someone
 * needs to roll back a deploy, which is the worst possible moment to find out.
 *
 * ## Why this steps through one migration at a time
 *
 * The obvious test — migrate all the way up, all the way down, then up again — is close
 * to worthless here, and it is worth saying why so nobody "simplifies" it back. The first
 * migration creates every core table, so its down drops them; any object a *later* down
 * migration forgot to remove is destroyed by that anyway, and the re-apply then succeeds.
 * Confirmed empirically: blanking `008_collection_year.down.sql` entirely still passed a
 * full-stack round trip.
 *
 * So instead each migration is rolled back and re-applied on its own, against the schema
 * as it stands at that point, and the schema is compared before and after. That is the
 * comparison a broken down migration cannot survive: the leftover column, index or
 * constraint is still there when the same migration runs again.
 *
 * Deliberately destructive: it drops and recreates its own scratch schema, and refuses to
 * run against a database whose name does not look disposable.
 *
 * Usage: MIGRATION_TEST_DATABASE_URL=postgres://... tsx scripts/verifyMigrations.ts
 */
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { runMigrationsUp, runMigrationsDown, getAppliedMigrations } from '../src/database/migrate';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');
const url = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const SCHEMA = 'migration_verify';

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!url) {
  fail(
    'MIGRATION_TEST_DATABASE_URL (or TEST_DATABASE_URL) is required. This script DROPs a schema; point it at a disposable database.'
  );
}
if (!/test|ci|tmp|scratch/i.test(url)) {
  fail(
    `Refusing to run against "${url.replace(/:[^:@]+@/, ':***@')}" — the name does not look disposable.`
  );
}

const expected = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
  .sort();

if (expected.length === 0) {
  fail('Found no migrations to verify. This gate would otherwise pass while proving nothing.');
}

/**
 * Everything a migration can leave behind: columns and their types, constraints, and
 * indexes. Compared as one sorted string so a difference reports as a readable diff
 * rather than a deep-equality failure on an object nobody can read.
 */
async function snapshot(pool: Pool): Promise<string> {
  const columns = await pool.query<{ line: string }>(
    `SELECT table_name || '.' || column_name || ' ' || data_type ||
            CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
            COALESCE(' DEFAULT ' || column_default, '') AS line
       FROM information_schema.columns
      WHERE table_schema = $1
      ORDER BY table_name, column_name`,
    [SCHEMA]
  );
  const constraints = await pool.query<{ line: string }>(
    `SELECT rel.relname || ' ' || con.conname || ' ' || pg_get_constraintdef(con.oid) AS line
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = $1
      ORDER BY rel.relname, con.conname`,
    [SCHEMA]
  );
  const indexes = await pool.query<{ line: string }>(
    `SELECT indexdef AS line FROM pg_indexes WHERE schemaname = $1 ORDER BY indexname`,
    [SCHEMA]
  );

  return [
    ...columns.rows.map((r) => `col  ${r.line}`),
    ...constraints.rows.map((r) => `con  ${r.line}`),
    ...indexes.rows.map((r) => `idx  ${r.line}`),
  ].join('\n');
}

/**
 * A down migration may legitimately change no schema at all — 002 inserts a settings row
 * and cannot prove on rollback which row was its own, so it deliberately does nothing.
 * That is a decision, and it has to be written down to be told apart from an oversight.
 */
function isDeclaredNoop(migration: string): boolean {
  const downFile = path.join(MIGRATIONS_DIR, migration.replace(/\.sql$/, '.down.sql'));
  if (!fs.existsSync(downFile)) return false;
  return /intentionally a no-op/i.test(fs.readFileSync(downFile, 'utf8'));
}

function diff(before: string, after: string): string {
  const b = new Set(before.split('\n'));
  const a = new Set(after.split('\n'));
  const lines = [
    ...[...b].filter((l) => !a.has(l)).map((l) => `  - ${l}`),
    ...[...a].filter((l) => !b.has(l)).map((l) => `  + ${l}`),
  ];
  return lines.slice(0, 20).join('\n');
}

async function main(): Promise<void> {
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await admin.query(`CREATE SCHEMA ${SCHEMA}`);
  await admin.end();

  // Every connection from this pool resolves unqualified names inside the scratch schema,
  // so nothing here can touch what is already in the database.
  const pool = new Pool({ connectionString: url, max: 2, options: `-c search_path=${SCHEMA}` });

  try {
    console.log(`Verifying ${expected.length} migrations in schema "${SCHEMA}".\n`);

    const applied = await runMigrationsUp(pool, MIGRATIONS_DIR);
    if (applied.length !== expected.length) {
      fail(`up on an empty database applied ${applied.length} of ${expected.length} migrations.`);
    }
    console.log(`✓ up   applied all ${applied.length} migrations to an empty database`);

    const canonical = await snapshot(pool);

    // Roll back the top k and re-apply them, for every k. Always returning to the full
    // state before the next round is not tidiness — `runMigrationsUp` applies everything
    // pending, so leaving a migration rolled back would make the next round's re-apply
    // cover two migrations and blame the wrong one.
    //
    // Rolling back only as far as k means a migration whose down left something behind is
    // caught: nothing below it runs to destroy the evidence, and re-applying it meets its
    // own leftover.
    let previous = canonical;
    for (let k = 1; k <= expected.length; k += 1) {
      const name = expected[expected.length - k];

      const rolledBack = await runMigrationsDown(k, pool, MIGRATIONS_DIR);
      if (rolledBack.length !== k) {
        fail(
          `${name}: rolling back the top ${k} rolled back ${rolledBack.length}. A migration with no .down.sql is skipped rather than failed, so it would otherwise pass here silently.`
        );
      }
      const rolledBackTo = await snapshot(pool);

      // A down that changes nothing is the defect a schema comparison cannot see on its
      // own, because an idempotent up (`ADD COLUMN IF NOT EXISTS`) will happily re-apply
      // over the leftover and match. A down that means to change nothing has to say so.
      if (rolledBackTo === previous && !isDeclaredNoop(name)) {
        fail(
          `${name}: rolling it back changed nothing in the schema. If that is correct, say so in its .down.sql with the line "Intentionally a no-op." — as 002 does — so the next reader knows it was a decision.`
        );
      }
      previous = rolledBackTo;

      const reapplied = await runMigrationsUp(pool, MIGRATIONS_DIR);
      if (reapplied.length !== k) {
        fail(`${name}: re-applying after that rollback applied ${reapplied.length} of ${k}.`);
      }

      const restored = await snapshot(pool);
      if (restored !== canonical) {
        fail(`${name}: down + up does not restore the schema.\n\n${diff(canonical, restored)}`);
      }
      console.log(`✓ ${name} — down reverses up`);
    }

    const applied2 = await getAppliedMigrations(pool);
    if (applied2.length !== expected.length) {
      fail(`ended with ${applied2.length} of ${expected.length} applied.`);
    }
    console.log(`\nAll ${expected.length} migrations round-trip.`);
  } finally {
    await pool.end();
    const cleanup = new Pool({ connectionString: url, max: 1 });
    await cleanup.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await cleanup.end();
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
