/**
 * Shared pg-mem pool factory.
 *
 * pg-mem is the fast in-memory engine behind most suites here. It covers nearly all the
 * SQL this schema uses — `ON CONFLICT DO NOTHING`, guarded `UPDATE ... RETURNING`,
 * `FOR UPDATE`, `JSONB`, `CHECK` enforcement — but its parser rejects `NOT VALID`.
 *
 * Migration 004 needs `NOT VALID` against real PostgreSQL so it cannot fail on legacy
 * rows that are already negative. Rather than weaken the production SQL to suit the test
 * engine, this shim strips the clause on the way into pg-mem. The result is a *stricter*
 * constraint there, which is harmless: a pg-mem database is always freshly created, so
 * there are no legacy rows for a validating constraint to reject.
 *
 * Suites that need genuine concurrency use `./realPostgres` instead — pg-mem has no MVCC.
 *
 * It is also missing `clock_timestamp()`, which the refresh-token rotation path uses to
 * measure elapsed time inside a transaction (`NOW()` is fixed at transaction start, so it
 * cannot measure anything that happens during one). Registering it here keeps the
 * production SQL honest rather than degrading it to a function the test engine happens to
 * implement.
 */
import { DataType, newDb, type IMemoryDb } from 'pg-mem';
import type { Pool as PgPool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/** Matches a trailing `NOT VALID` on an ALTER TABLE ... ADD CONSTRAINT statement. */
const TRAILING_NOT_VALID = /\s+NOT\s+VALID(?=\s*;|\s*$)/gi;

export function toPgMemCompatibleSql(sql: string): string {
  return sql.replace(TRAILING_NOT_VALID, '');
}

type QueryArgs = [string | { text: string }, unknown[]?];

function rewriteQueryArgs(args: QueryArgs): QueryArgs {
  const [first, params] = args;

  if (typeof first === 'string') {
    return [toPgMemCompatibleSql(first), params];
  }
  if (first && typeof first === 'object' && typeof first.text === 'string') {
    return [{ ...first, text: toPgMemCompatibleSql(first.text) }, params];
  }
  return args;
}

function patchQueryable<T extends { query: (...args: never[]) => unknown }>(target: T): T {
  const original = target.query.bind(target) as (
    ...args: QueryArgs
  ) => Promise<QueryResult<QueryResultRow>>;

  Object.defineProperty(target, 'query', {
    configurable: true,
    writable: true,
    value: (...args: QueryArgs) => original(...rewriteQueryArgs(args)),
  });

  return target;
}

/**
 * Registers the PostgreSQL functions pg-mem lacks but the production SQL uses.
 *
 * Exported separately because a suite that needs its own `newDb()` (the endpoint-health
 * verification suite registers a further dozen shims of its own) would otherwise take
 * `toPgMemCompatibleSql` alone and inherit none of this — which is how
 * `POST /auth/logout` came to 500 on `clock_timestamp() does not exist` in a report
 * everyone had learned to read past. Take this, or take `pgMemPoolFrom`; never the SQL
 * rewriter by itself.
 */
export function registerPgMemFunctions(memDb: IMemoryDb): void {
  memDb.public.registerFunction({
    name: 'clock_timestamp',
    args: [],
    returns: DataType.timestamptz,
    // Impure: it must be re-evaluated per row/statement, not folded into a constant.
    impure: true,
    implementation: () => new Date(),
  });
}

/**
 * Wraps an existing pg-mem database in a pool that speaks the dialect the migrations are
 * written in. Migrations run through `pool.connect()`, so pooled clients are patched too.
 */
export function pgMemPoolFrom(memDb: IMemoryDb): PgPool {
  registerPgMemFunctions(memDb);

  const { Pool } = memDb.adapters.createPg();
  const pool = patchQueryable(new Pool() as unknown as PgPool);

  const originalConnect = pool.connect.bind(pool) as () => Promise<PoolClient>;
  pool.connect = (async () => patchQueryable(await originalConnect())) as PgPool['connect'];

  return pool;
}

/** Convenience for the common case: a fresh in-memory database and its pool. */
export function createPgMemPool(): PgPool {
  return pgMemPoolFrom(newDb({ noAstCoverageCheck: true }));
}
