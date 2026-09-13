// Set env vars before any test modules load
process.env.JWT_SECRET = 'test-secret-key-for-vitest-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-vitest-32ch';
process.env.NODE_ENV = 'test';

import { setPool } from '../src/database/pool';

/**
 * A test that never injects a pool used to fall through to `getPool()`, which builds a
 * real `pg.Pool` from `DATABASE_URL`. On a machine with `server/.env` (or any reachable
 * local PostgreSQL) that silently *worked*; on a fresh checkout or worktree it failed
 * with `28P01 password authentication failed`, in a test whose subject was nothing to do
 * with the database. See issue #69 — it cost four agents an investigation each.
 *
 * Installing this trap as the default makes the fallthrough loud and self-describing at
 * the first statement, everywhere, instead of dependent on the developer's environment.
 * A suite that wants a database still calls `setPool(createPgMemPool())` (pg-mem) or goes
 * through `describeWithPostgres` (real PostgreSQL); both replace this trap.
 */
const NO_POOL_INJECTED =
  'This test reached the module PostgreSQL pool without injecting one. ' +
  'pg-mem suites must call setPool(createPgMemPool()) — at file scope if any test in ' +
  'the file touches the pool, including indirectly via audit logging. Suites that need ' +
  'a real server use describeWithPostgres from tests/support/realPostgres.';

const trapPool = {
  connect: async () => {
    throw new Error(NO_POOL_INJECTED);
  },
  query: async () => {
    throw new Error(NO_POOL_INJECTED);
  },
  end: async () => {},
  on: () => trapPool,
};

setPool(trapPool as never);
