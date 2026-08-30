/**
 * Real-PostgreSQL test harness.
 *
 * The concurrency and idempotency invariants this repo depends on (guarded relative
 * writes, `SELECT ... FOR UPDATE`, unique-claim races) cannot be proven against pg-mem:
 * they need two genuinely concurrent connections and real MVCC. This harness gives a
 * test file an isolated PostgreSQL schema, migrated through the real migration runner.
 *
 * Activated by `TEST_DATABASE_URL`. When it is absent, `describeWithPostgres` skips the
 * suite *loudly* — a concurrency suite that quietly no-ops is worse than no suite.
 */
import { Client, Pool, PoolClient } from 'pg';
import path from 'path';
import { randomBytes } from 'crypto';
import { describe } from 'vitest';
import { runMigrationsUp } from '../../src/database/migrate';
import { setPool } from '../../src/database/pool';

const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasRealPostgres = Boolean(TEST_DATABASE_URL);

const SKIP_REASON =
  'SKIPPED (no real PostgreSQL): set TEST_DATABASE_URL to run this suite. ' +
  'These tests prove concurrency/idempotency invariants and cannot run on pg-mem.';

let announced = false;

/**
 * `describe` that runs only when a real PostgreSQL URL is configured, and otherwise
 * reports the suite as skipped with an explicit reason instead of passing silently.
 */
export function describeWithPostgres(name: string, fn: () => void): void {
  if (!hasRealPostgres) {
    if (!announced) {
      announced = true;
      console.warn(`\n[real-postgres] ${SKIP_REASON}\n`);
    }
    describe.skip(`${name} — ${SKIP_REASON}`, fn);
    return;
  }
  describe(name, fn);
}

export interface RealPostgresHarness {
  /** Pool bound to this file's isolated schema. Also installed as the app pool. */
  pool: Pool;
  /** The isolated schema name, for diagnostics. */
  schema: string;
  /** Checks out a dedicated client. Callers must release it. */
  connect(): Promise<PoolClient>;
  /** Empties every table in the schema and resets identity sequences. */
  truncate(): Promise<void>;
  /** Ends the pool and drops the schema. */
  teardown(): Promise<void>;
}

function schemaNameFor(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  // PostgreSQL identifiers cap at 63 bytes; this stays well under.
  return `test_${slug}_${randomBytes(6).toString('hex')}`;
}

async function withAdminClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export interface RealPostgresOptions {
  /**
   * Install the harness pool as the process-wide application pool via `setPool`.
   * Defaults to true, which is what a suite exercising services wants. Pass false for a
   * secondary harness so it does not displace the primary one.
   */
  installAsAppPool?: boolean;
  /**
   * Pool size. Kept deliberately small by default: vitest runs test files in parallel
   * across every core, and each file (sometimes each test) builds its own harness, so a
   * generous per-harness pool exhausts PostgreSQL's max_connections and surfaces as
   * connection timeouts rather than as an obvious resource error. Suites that need real
   * parallelism — a 10-way oversell race, say — raise this deliberately.
   */
  maxConnections?: number;
}

const DEFAULT_MAX_CONNECTIONS = 5;

/**
 * Creates an isolated schema, migrates it, and installs it as the application pool.
 *
 * `label` only shapes the schema name for readability in `pg_stat_activity`; isolation
 * comes from the random suffix, so two files sharing a label still cannot collide.
 */
export async function setupRealPostgres(
  label: string,
  options: RealPostgresOptions = {}
): Promise<RealPostgresHarness> {
  if (!TEST_DATABASE_URL) {
    throw new Error('setupRealPostgres called without TEST_DATABASE_URL; use describeWithPostgres');
  }

  const schema = schemaNameFor(label);

  await withAdminClient(async (client) => {
    await client.query(`CREATE SCHEMA "${schema}"`);
  });

  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    max: options.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    // Every connection from this pool resolves unqualified names inside the schema,
    // so the unmodified migrations build a private copy of the real schema.
    options: `-c search_path=${schema}`,
  });

  await runMigrationsUp(pool, MIGRATIONS_DIR);

  if (options.installAsAppPool !== false) {
    setPool(pool);
  }

  const harness: RealPostgresHarness = {
    pool,
    schema,
    connect: () => pool.connect(),

    async truncate() {
      const { rows } = await pool.query<{ tablename: string }>(
        'SELECT tablename FROM pg_tables WHERE schemaname = $1',
        [schema]
      );
      const targets = rows
        .map((r) => r.tablename)
        .filter((t) => t !== '_migrations')
        .map((t) => `"${schema}"."${t}"`);

      if (targets.length > 0) {
        await pool.query(`TRUNCATE ${targets.join(', ')} RESTART IDENTITY CASCADE`);
      }
    },

    async teardown() {
      await pool.end();
      await withAdminClient(async (client) => {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      });
    },
  };

  return harness;
}
