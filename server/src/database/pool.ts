import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import logger from '../../lib/logger';
import { getEnv } from '../config/env';

let poolInstance: Pool | null = null;

export function getPoolConfig() {
  const env = getEnv();
  const isProduction = env.NODE_ENV === 'production';

  return {
    connectionString: env.DATABASE_URL,
    /**
     * Names this process's backends in `pg_stat_activity`. Useful for ordinary ops
     * triage, and load-bearing for the E2E suite: its preflight identifies the server's
     * own connections by this name before it resets the database, so a count of
     * anonymous backends cannot be mistaken for the API being present.
     * `PGAPPNAME` lets a caller override it.
     */
    application_name: process.env.PGAPPNAME || 'moon-api',
    max: isProduction ? 20 : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl:
      isProduction && !env.DATABASE_URL.includes('localhost')
        ? { rejectUnauthorized: false }
        : false,
  };
}

export function getPool(): Pool {
  if (!poolInstance) {
    const config = getPoolConfig();
    poolInstance = new Pool(config);

    poolInstance.on('error', (err: Error) => {
      logger.error('Unexpected PostgreSQL pool error on idle client', {
        message: err.message,
        stack: err.stack,
      });
    });
  }
  return poolInstance;
}

export function setPool(pool: Pool): void {
  poolInstance = pool;
}

/**
 * Pool saturation gauges, or `null` when no pool has been created yet.
 *
 * Deliberately does *not* call `getPool()`: this is read by the metrics reporter and by
 * the readiness probe, and a monitoring read that lazily opens a connection pool would be
 * observation changing the thing observed. `waiting > 0` sustained is the signal that
 * matters — every checkout is then queueing behind a connection rather than a query.
 */
export function poolStats(): { total: number; idle: number; waiting: number } | null {
  if (!poolInstance) return null;
  // Coerced because a test double standing in for `Pool` need not carry the gauges, and
  // a missing gauge should read as zero rather than as `null` in a log line.
  return {
    total: Number(poolInstance.totalCount) || 0,
    idle: Number(poolInstance.idleCount) || 0,
    waiting: Number(poolInstance.waitingCount) || 0,
  };
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export const pool = {
  get connect(): () => Promise<PoolClient> {
    return () => getPool().connect();
  },
  query,
  end: closePool,
};

export default {
  query,
  pool,
  getPool,
  setPool,
  closePool,
};
