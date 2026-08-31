import path from 'node:path';

// Playwright transpiles config and support files to CommonJS, so `__dirname` is
// available and `import.meta.url` is not.
const here = __dirname;

export const REPO_ROOT = path.resolve(here, '../..');
export const SERVER_DIR = path.join(REPO_ROOT, 'server');
export const CLIENT_DIR = path.join(REPO_ROOT, 'client');

export const PREVIEW_PORT = 4173;
export const BASE_URL = `http://localhost:${PREVIEW_PORT}`;
export const API_URL = 'http://localhost:3001';

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
 * The database this suite owns. Resolved at config load so an unset variable aborts the
 * run before any server starts, rather than partway through the first spec.
 */
export function requireE2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL?.trim();
  if (!url) throw new Error(GUIDANCE);
  return url;
}

/** True when the URL is resolvable, for callers that must not throw (e.g. `--list`). */
export function hasE2eDatabaseUrl(): boolean {
  return Boolean(process.env.E2E_DATABASE_URL?.trim());
}
