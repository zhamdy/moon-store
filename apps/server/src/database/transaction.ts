import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getPool } from './pool';
import logger from '../../lib/logger';

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
}

/** Serialization failure and deadlock detected — the two errors a fresh attempt can fix. */
const RETRYABLE_SQLSTATES = new Set(['40001', '40P01']);

export interface TransactionOptions {
  /**
   * Retry the whole transaction on SQLSTATE 40001/40P01. Opt-in, because it re-runs the
   * callback: it is only safe when the callback performs no non-transactional side
   * effect (no notification, no external call, no write outside this client).
   */
  retryOnSerializationFailure?: boolean;
  /** Additional attempts after the first. Defaults to 2. */
  maxRetries?: number;
}

function sqlState(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function isRetryableTransactionError(error: unknown): boolean {
  const code = sqlState(error);
  return code !== undefined && RETRYABLE_SQLSTATES.has(code);
}

/** Short jittered backoff, so two deadlocked callers do not retry in lockstep. */
function backoffMs(attempt: number): number {
  return attempt * 10 + Math.floor(Math.random() * 10);
}

async function runOnce<T>(pool: Pool, callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Failed to rollback transaction', {
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Executes a callback within a PostgreSQL transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and client release.
 *
 * @param callback The function to execute inside the transaction
 * @param poolOrClient Optional Pool or PoolClient instance. If omitted, uses getPool().
 * @param options Optional retry behavior. Defaults to no retry, matching prior behavior.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  poolOrClient?: Pool | PoolClient,
  options: TransactionOptions = {}
): Promise<T> {
  const isClientProvided = poolOrClient && 'release' in poolOrClient;

  if (isClientProvided) {
    // If a client is already provided (e.g. nested transaction), execute directly
    return callback(poolOrClient as PoolClient);
  }

  const pool = (poolOrClient as Pool) || getPool();

  if (!options.retryOnSerializationFailure) {
    return runOnce(pool, callback);
  }

  const maxRetries = options.maxRetries ?? 2;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runOnce(pool, callback);
    } catch (error) {
      // The whole transaction rolled back, so a retry is a genuinely fresh attempt
      // with no partial side effects to undo.
      if (attempt >= maxRetries || !isRetryableTransactionError(error)) {
        throw error;
      }
      logger.warn('Retrying transaction after a serialization failure', {
        sqlState: sqlState(error),
        attempt: attempt + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt + 1)));
    }
  }
}
