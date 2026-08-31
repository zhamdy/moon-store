/**
 * Brings the E2E database to a known state before any spec runs: migrate, seed (which
 * doubles as the reset), clear the one table the seed misses, and pin the settings
 * baseline.
 *
 * Runs in the Playwright process, but the process that writes almost all test data is the
 * Express server. A guard that only checked *this* process's configuration would guard
 * the wrong one — hence the preflight below.
 */
import { spawn } from 'node:child_process';
import { Client } from 'pg';
import { API_URL, SERVER_DIR, requireE2eDatabaseUrl } from './config';
import { clearIdempotencyKeys, closeE2ePool, databaseNameOf, dbQuery } from './db';
import { BASELINE_KEYS, SETTINGS_BASELINE } from './settingsBaseline';

const PREFLIGHT_APP_NAME = 'moon-e2e-preflight';

/**
 * Asserts the *running* API is on the database this setup is about to reset.
 *
 * The API exposes no database identity, so this asks PostgreSQL instead: after
 * `/api/health` (a real `SELECT 1`) succeeds, the server's pool holds at least one
 * connection, and it will be visible in `pg_stat_activity` for the target database. Zero
 * connections there means the server answered from somewhere else — a stale
 * `reuseExistingServer` attach to a dev server being the realistic case — and the reset
 * would then destroy a database nothing under test is even reading.
 */
async function preflightServerDatabase(connectionString: string): Promise<void> {
  const dbName = databaseNameOf(connectionString);

  const health = await fetch(`${API_URL}/api/health`).catch((err: unknown) => {
    throw new Error(
      `E2E preflight: the API at ${API_URL} is not answering (${String(err)}). ` +
        'Playwright starts it via the webServer config; check its output above.'
    );
  });
  if (!health.ok) {
    throw new Error(`E2E preflight: ${API_URL}/api/health returned ${health.status}.`);
  }

  const client = new Client({ connectionString, application_name: PREFLIGHT_APP_NAME });
  await client.connect();
  let connections = 0;
  try {
    const { rows } = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
          AND (application_name IS DISTINCT FROM $2)`,
      [dbName, PREFLIGHT_APP_NAME]
    );
    connections = Number(rows[0]?.n ?? '0');
  } finally {
    await client.end();
  }

  if (connections === 0) {
    throw new Error(
      [
        `E2E preflight FAILED — refusing to reset "${dbName}".`,
        '',
        `The API answered /api/health but holds no connection to "${dbName}", so it is`,
        'connected to a different database. Resetting now would delete every row in 77',
        'tables of a database nothing under test is reading.',
        '',
        'The usual cause is `reuseExistingServer` attaching to a dev server already',
        'listening on port 3001. Stop it and re-run, or set E2E_DATABASE_URL to the',
        'database that server actually uses.',
      ].join('\n')
    );
  }
}

async function pinSettingsBaseline(): Promise<void> {
  // Written directly rather than through `PUT /api/v1/settings`: the HTTP route needs an
  // admin session, which entangles setup with webServer boot ordering for no benefit.
  // Settings are plain key/value rows.
  for (const [key, value] of Object.entries(SETTINGS_BASELINE)) {
    await dbQuery(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value]
    );
  }

  const rows = await dbQuery<{ key: string; value: string }>(
    'SELECT key, value FROM settings WHERE key = ANY($1)',
    [BASELINE_KEYS]
  );
  const written = new Map(rows.map((r) => [r.key, r.value]));
  for (const [key, expected] of Object.entries(SETTINGS_BASELINE)) {
    if (written.get(key) !== expected) {
      throw new Error(
        `E2E setup: settings baseline "${key}" is ${String(written.get(key))}, expected ${expected}.`
      );
    }
  }
}

/**
 * Runs the server's own migration and seed scripts as child processes with
 * `DATABASE_URL` overridden.
 *
 * Deliberately a subprocess rather than a cross-project import: those modules are
 * TypeScript compiled by the server's own toolchain, and importing them into the
 * Playwright process would couple two build setups for no gain. Shelling out also means
 * the E2E database is migrated by exactly the command a developer runs by hand.
 */
function runServerScript(script: 'migrate' | 'seed', connectionString: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        NODE_ENV: 'test',
      },
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`E2E setup: \`npm run ${script}\` exited ${code}.\n${output}`));
    });
  });
}

export default async function globalSetup(): Promise<void> {
  const connectionString = requireE2eDatabaseUrl();

  await preflightServerDatabase(connectionString);

  try {
    await runServerScript('migrate', connectionString);
    // `seed` deletes every row in 77 tables and restarts every public sequence before
    // reseeding, so it is both the seed and the reset. Note the sequence restart:
    // primary keys are reused between runs, so any browser profile or storage state
    // captured before a reseed may reference an id that now belongs to a different row.
    await runServerScript('seed', connectionString);
    await clearIdempotencyKeys();
    await pinSettingsBaseline();
  } finally {
    await closeE2ePool();
  }
}
