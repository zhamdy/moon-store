/**
 * Direct database access for the assertions the API does not expose — `idempotency_keys`
 * rows and raw `products.stock`.
 *
 * Read-only by contract. The suite mutates only through the real HTTP API, so fixture
 * data passes the same validation and invariants as production data. The two exceptions
 * are the reset and the settings baseline in `globalSetup`, which are setup rather than
 * test behavior and are confined to this module.
 */
import { Pool, type QueryResultRow } from 'pg';
import { requireE2eDatabaseUrl } from './config';

let pool: Pool | null = null;

export function getE2ePool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: requireE2eDatabaseUrl(), max: 4 });
  }
  return pool;
}

export async function closeE2ePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getE2ePool().query<T>(text, params);
  return result.rows;
}

export async function dbOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await dbQuery<T>(text, params);
  return rows[0];
}

/** Raw stock, bypassing any client or service-worker cache. */
export async function readStock(productId: number): Promise<number | undefined> {
  const row = await dbOne<{ stock: string }>('SELECT stock FROM products WHERE id = $1', [
    productId,
  ]);
  return row ? Number(row.stock) : undefined;
}

/** Idempotency rows for a key. The suite's sharpest assertions read this table directly. */
export async function readIdempotencyKeys(key: string): Promise<QueryResultRow[]> {
  return dbQuery('SELECT * FROM idempotency_keys WHERE key = $1', [key]);
}

/**
 * `seedDatabase()` deletes 77 tables but `idempotency_keys` is not among them, and its
 * only user link is `ON DELETE SET NULL`, so nothing else clears it either. Rows
 * accumulate across runs pointing at `resource_id`s of long-deleted sales — while the
 * duplicate-submit and offline specs assert *exactly one* row against this table.
 *
 * Cleared from the E2E side rather than by editing the server's seed list, so the change
 * stays inside the test project.
 */
export async function clearIdempotencyKeys(): Promise<void> {
  await dbQuery('DELETE FROM idempotency_keys');
}

/**
 * The database name the given connection string points at, used by the preflight guard
 * to compare the suite's target against the one the running API actually holds open.
 */
export function databaseNameOf(connectionString: string): string {
  return decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, ''));
}
