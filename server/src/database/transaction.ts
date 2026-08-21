import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getPool } from './pool';
import logger from '../../lib/logger';

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
}

/**
 * Executes a callback within a PostgreSQL transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and client release.
 *
 * @param callback The function to execute inside the transaction
 * @param poolOrClient Optional Pool or PoolClient instance. If omitted, uses getPool().
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  poolOrClient?: Pool | PoolClient
): Promise<T> {
  const isClientProvided = poolOrClient && 'release' in poolOrClient;

  if (isClientProvided) {
    // If a client is already provided (e.g. nested transaction), execute directly
    return callback(poolOrClient as PoolClient);
  }

  const pool = (poolOrClient as Pool) || getPool();
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
