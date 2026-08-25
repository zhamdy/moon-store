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
