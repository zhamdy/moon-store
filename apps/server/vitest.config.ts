import { defineConfig } from 'vitest/config';

/**
 * The real-PostgreSQL suites do real work in their hooks: `beforeAll` runs every
 * migration into a fresh schema, and `beforeEach` truncates ~40 tables. Under vitest's
 * default fan-out (one worker per core) that contends hard enough on a single server to
 * blow the 10s default hook timeout, which surfaces as a hook failure in whichever suite
 * loses the race rather than as anything resembling its real cause.
 *
 * Both bounds apply only when those suites actually run, so the ordinary pg-mem run keeps
 * full parallelism and the default timeouts.
 */
const usesRealPostgres = Boolean(process.env.TEST_DATABASE_URL);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    ...(usesRealPostgres
      ? { maxWorkers: 4, minWorkers: 1, hookTimeout: 60_000, testTimeout: 60_000 }
      : {}),
  },
});
