import { defineConfig, devices } from '@playwright/test';
import {
  API_URL,
  BASE_URL,
  CLIENT_DIR,
  E2E_SERVER_APP_NAME,
  PREVIEW_PORT,
  SERVER_DIR,
  requireE2eDatabaseUrl,
} from './support/config';

/**
 * Resolved at config load, so an unset variable aborts the run before any server starts
 * rather than partway through the first spec. There is deliberately no fallback to
 * `DATABASE_URL`: `globalSetup` deletes every row in 77 tables, and a default that
 * pointed that at a developer's dev database would fail silently and destructively.
 */
const E2E_DATABASE_URL = requireE2eDatabaseUrl();

/**
 * `webServer.env` inherits `process.env`, and `server/index.ts` additionally calls
 * `dotenv/config` — so without explicit overrides the server under test picks up the
 * developer's `server/.env` and writes into their dev database while the assertions read
 * the E2E one. Every variable here is load-bearing; none is a default worth trusting.
 */
const serverEnv: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: E2E_DATABASE_URL,
  // Tags this server's PostgreSQL backends so `globalSetup`'s preflight can identify
  // them by name. Without it the guard could only count anonymous connections, and any
  // idle psql session would let a reused dev server pass as the server under test.
  PGAPPNAME: E2E_SERVER_APP_NAME,
  // The CORS allowlist is `CLIENT_URL` plus localhost:5173/5174/5175 under
  // `credentials: true`, so the preview origin is on no list by default and every API
  // call would fail preflight. The fix is this variable — never widening
  // `allowedOrigins` in `server/index.ts` or setting `origin: true`.
  CLIENT_URL: BASE_URL,
  ALLOWED_ORIGINS: BASE_URL,
  // Both limiters key on `req.ip`, and every worker is 127.0.0.1 sharing one in-process
  // bucket. The binding constraint is the auth ceiling of 10, not the global 200.
  RATE_LIMIT_MAX: '100000',
  AUTH_RATE_LIMIT_MAX: '100000',
  // The same literals `.github/workflows/ci.yml`'s server job uses, so one rotation
  // covers both. Deliberately not repository secrets: this is a throwaway server on a
  // disposable database whose seeded credentials are already published in CLAUDE.md.
  JWT_SECRET: 'ci-jwt-secret-key-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'ci-jwt-refresh-secret-key-at-least-32-chars',
};

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  globalSetup: './support/globalSetup.ts',

  /**
   * Generous next to a unit suite, and deliberately so. Every assertion here waits on a
   * real browser rendering a real production bundle against a real server and database,
   * under whatever parallel load the run has. The default 5s expect timeout produced
   * timeouts that looked like application bugs but were pure contention — a slow machine
   * is not a failing till.
   */
  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Replays failures at the end of the run in a single worker rather than immediately,
  // which is the right shape for a suite sharing one database.
  retryStrategy: 'isolated',
  workers: process.env.CI ? 2 : undefined,

  reporter: process.env.CI ? [['blob'], ['github']] : [['html', { open: 'on-failure' }], ['list']],

  use: {
    baseURL: BASE_URL,
    testIdAttribute: 'data-testid',
    /**
     * The production build registers a Workbox service worker with
     * `StaleWhileRevalidate` on `/api/v1/products` and `NetworkFirst` on `/api/v1/sales`
     * reads. Left active it shadows route mocks on GET and can serve 24-hour-old stock
     * rows into the very assertions this suite exists to make. The service worker's own
     * behavior is explicitly out of scope — see README.md.
     */
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testDir: './fixtures',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'pos-parallel',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /tax-loyalty\.spec\.ts/,
    },
    {
      /**
       * Tax and loyalty are global settings rows, not per-sale inputs. A worker that
       * flips `tax_enabled` changes the totals every other worker is asserting on, so
       * the mode variants are quarantined here: one worker, serial, ordered after the
       * parallel project has finished.
       */
      name: 'pos-settings',
      dependencies: ['setup', 'pos-parallel'],
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
      testMatch: /tax-loyalty\.spec\.ts/,
    },
  ],

  webServer: [
    {
      name: 'API',
      command: 'npm run start',
      cwd: SERVER_DIR,
      // `url` rather than `port`: /api/health does a real `SELECT 1`, so this proves the
      // app answers and reaches its database, not merely that a socket is bound.
      url: `${API_URL}/api/health`,
      env: serverEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      name: 'Web',
      // The client build is deliberately NOT part of this command. Folding it in would
      // let the boot timeout silently cover compilation and report a build failure as a
      // readiness timeout. Run `npm run build --prefix client` as its own step.
      command: `npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      cwd: CLIENT_DIR,
      url: BASE_URL,
      // No `VITE_API_URL` here: `import.meta.env` is substituted at BUILD time, so setting
      // it on the preview process does nothing while reading as though it binds the
      // browser to this API. It belongs on the build step — see README.
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
