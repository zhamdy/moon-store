import fs from 'node:fs';
import path from 'node:path';
import { parse as parseConnectionString } from 'pg-connection-string';

// Playwright transpiles config and support files to CommonJS, so `__dirname` is
// available and `import.meta.url` is not.
const here = __dirname;

export const REPO_ROOT = path.resolve(here, '../..');
export const SERVER_DIR = path.join(REPO_ROOT, 'server');
export const CLIENT_DIR = path.join(REPO_ROOT, 'client');

export const PREVIEW_PORT = 4173;
export const BASE_URL = `http://localhost:${PREVIEW_PORT}`;
export const API_URL = 'http://localhost:3001';

/**
 * `application_name` the E2E server's PostgreSQL backends carry, set via `PGAPPNAME` in
 * `webServer.env`. The preflight looks for exactly this, so a reused dev server — which
 * carries the plain `moon-api` default — cannot be mistaken for the server under test.
 */
export const E2E_SERVER_APP_NAME = 'moon-e2e-server';

/** Set to `1` to allow pointing the suite at the same database the dev server uses. */
const ALLOW_SHARED_DB = 'E2E_ALLOW_SHARED_DB';

const GUIDANCE = [
  'E2E_DATABASE_URL is required and has no default.',
  '',
  'This suite deletes every row in 77 tables and restarts their sequences. Defaulting to',
  'DATABASE_URL would point that reset at a developer’s dev database, and the loss would',
  'be silent. Point it at a disposable database instead, e.g.',
  '',
  '  E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/moon_store_e2e',
  '',
  'See e2e/README.md.',
].join('\n');

/**
 * The database a connection string names.
 *
 * Parsed with pg's own parser rather than `new URL`, because this value gates a
 * destructive reset: a password containing `@`, `/` or `#` makes the URL parser yield a
 * wrong host and an empty database, and the guard would then abort with a message
 * blaming the wrong thing — or compare the wrong name.
 */
export function databaseNameOf(connectionString: string): string {
  let database: string | null | undefined;
  try {
    database = parseConnectionString(connectionString).database;
  } catch (err) {
    throw new Error(`E2E_DATABASE_URL is not a valid PostgreSQL connection string: ${String(err)}`);
  }
  if (!database) {
    throw new Error(
      'E2E_DATABASE_URL names no database. Expected postgresql://user:pass@host:port/<dbname>.'
    );
  }
  return database;
}

/** Host:port/database identity, for comparing two connection strings. */
function targetOf(connectionString: string): string | null {
  try {
    const { host, port, database } = parseConnectionString(connectionString);
    if (!database) return null;
    return `${host ?? 'localhost'}:${port ?? '5432'}/${database}`;
  } catch {
    return null;
  }
}

/** The dev `DATABASE_URL`, from the environment or `server/.env`, if discoverable. */
function developerDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  try {
    const envFile = fs.readFileSync(path.join(SERVER_DIR, '.env'), 'utf8');
    const match = envFile.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
    return match?.[1]?.trim().replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
}

/**
 * The database this suite owns. Resolved at config load so an unset variable aborts the
 * run before any server starts, rather than partway through the first spec.
 *
 * Having no default protects against *forgetting* to set it. It protects against nothing
 * once it is set to the wrong value — and the obvious wrong value is the developer's own
 * `DATABASE_URL`, copied out of `server/.env` because a database already existed and the
 * `createdb` step looked skippable. The preflight cannot catch that case either: the dev
 * server genuinely is on that database, so its identity check would pass by construction.
 * Hence the explicit comparison here.
 */
export function requireE2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL?.trim();
  if (!url) throw new Error(GUIDANCE);

  if (process.env[ALLOW_SHARED_DB] === '1') return url;

  const devUrl = developerDatabaseUrl();
  const target = targetOf(url);
  if (devUrl && target && targetOf(devUrl) === target) {
    throw new Error(
      [
        `E2E_DATABASE_URL points at "${target}", which is also this machine’s`,
        'DATABASE_URL — the database the dev server uses.',
        '',
        'The suite deletes every row in 77 tables and restarts their sequences. Running',
        'would destroy your local products, sales, customers and users with no prompt and',
        'no backup.',
        '',
        'Point it at a disposable database (e.g. moon_store_e2e). If sharing really is',
        `what you want, set ${ALLOW_SHARED_DB}=1.`,
      ].join('\n')
    );
  }

  return url;
}
