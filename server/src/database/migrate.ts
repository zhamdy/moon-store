import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { getPool, closePool } from './pool';
import { withTransaction } from './transaction';
import logger from '../../lib/logger';

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export async function ensureMigrationTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  /**
   * Realign the id sequence with the rows that are actually there.
   *
   * `_migrations.id` is a SERIAL, so the next insert takes its value from a sequence
   * rather than from the table. Anything that writes rows without advancing that
   * sequence — a `pg_dump`/restore, a `TRUNCATE ... RESTART IDENTITY`, a schema copied
   * between databases — leaves the sequence behind the data. The next migration then
   * fails with `duplicate key value violates unique constraint "_migrations_pkey"`,
   * which names the bookkeeping table and says nothing about the migration being
   * applied or how to recover. It reads like a corrupt migration; it is a stale counter.
   *
   * Observed on a developer database that had been restored: every migration after 001
   * refused to apply, so the API answered 500 on login (`refresh_tokens.token_hash`
   * missing) and the app looked broken from the frontend down.
   *
   * `setval(..., false)` sets the *next* value, so it is correct on an empty table too.
   *
   * Not wrapped in a catch. pg-mem has no sequence object, so `tests/support/pgMem.ts`
   * registers `pg_get_serial_sequence`/`setval` as a no-op pair — there is nothing there
   * to fall out of step, so doing nothing is correct rather than degraded. Swallowing the
   * error here instead would mean a repair that hides its own failure, which is how the
   * original problem stayed invisible.
   */
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('_migrations', 'id'),
      COALESCE((SELECT MAX(id) FROM _migrations), 0) + 1,
      false
    )
  `);
}

export async function getAppliedMigrations(pool: Pool): Promise<string[]> {
  await ensureMigrationTable(pool);
  const result = await pool.query<{ name: string }>('SELECT name FROM _migrations ORDER BY id ASC');
  return result.rows.map((r) => r.name);
}

export async function runMigrationsUp(
  pool?: Pool,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): Promise<string[]> {
  const dbPool = pool || getPool();
  await ensureMigrationTable(dbPool);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && !f.includes('.down.sql'))
    .sort();

  const applied = new Set(await getAppliedMigrations(dbPool));
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    logger.info(`Running migration: ${file}`);

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    }, dbPool);

    newlyApplied.push(file);
    logger.info(`Applied migration: ${file}`);
  }

  return newlyApplied;
}

export async function runMigrationsDown(
  count = 1,
  pool?: Pool,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR
): Promise<string[]> {
  const dbPool = pool || getPool();
  await ensureMigrationTable(dbPool);

  const appliedRows = await dbPool.query<{ id: number; name: string }>(
    'SELECT id, name FROM _migrations ORDER BY id DESC LIMIT $1',
    [count]
  );

  const rolledBack: string[] = [];

  for (const row of appliedRows.rows) {
    const downFile = row.name.replace('.sql', '.down.sql');
    const downPath = path.join(migrationsDir, downFile);

    if (!fs.existsSync(downPath)) {
      logger.warn(`No down migration found for ${row.name} at ${downFile}. Skipping.`);
      continue;
    }

    const sql = fs.readFileSync(downPath, 'utf8');
    logger.info(`Rolling back migration: ${row.name}`);

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('DELETE FROM _migrations WHERE id = $1', [row.id]);
    }, dbPool);

    rolledBack.push(row.name);
    logger.info(`Rolled back migration: ${row.name}`);
  }

  return rolledBack;
}

// CLI Execution
if (require.main === module) {
  (async () => {
    const pool = getPool();
    try {
      const isDown = process.argv.includes('--down') || process.argv.includes('down');
      if (isDown) {
        const downIndex =
          process.argv.indexOf('--down') !== -1
            ? process.argv.indexOf('--down')
            : process.argv.indexOf('down');
        const count = parseInt(process.argv[downIndex + 1], 10) || 1;
        const rolledBack = await runMigrationsDown(count, pool);
        console.log(`Rolled back ${rolledBack.length} migration(s).`);
      } else {
        const applied = await runMigrationsUp(pool);
        console.log(`Applied ${applied.length} migration(s).`);
      }
    } catch (err) {
      console.error('Migration failed:', err);
      process.exitCode = 1;
    } finally {
      await closePool();
    }
  })();
}
