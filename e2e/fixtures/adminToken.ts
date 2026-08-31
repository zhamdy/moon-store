import fs from 'node:fs';
import { BASE_URL } from '../support/config';
import { adminStatePath } from './authPaths';
import { AUTH_STORAGE_KEY } from './storage';

interface StorageStateFile {
  origins?: { origin: string; localStorage: { name: string; value: string }[] }[];
}

/**
 * The admin access token, read from the setup project's `storageState` — **not** by
 * logging in again.
 *
 * This is not an optimization. Refresh tokens are `jwt.sign({ id }, …, { expiresIn: '7d' })`:
 * user id plus second-resolution `iat`/`exp`, no jti, stored in
 * `refresh_tokens.token UNIQUE`. Two logins as the same user inside one second produce a
 * byte-identical token, the second insert fails on 23505, and the endpoint returns 500.
 * Worker startup is exactly that burst, and it reproduces reliably at two workers.
 *
 * Worse than the 500: because the tokens are identical, a logout by one holder revokes
 * every holder's session. This is a pre-existing server defect (issue #62), not one the
 * suite introduces — the suite routes around it by logging the shared admin in exactly
 * once, in the setup project, for the whole run.
 */
export function readAdminAccessToken(): string {
  if (!fs.existsSync(adminStatePath)) {
    throw new Error(
      `No admin storage state at ${adminStatePath}. The \`setup\` project writes it; run ` +
        'the whole suite rather than a single project, or check that `setup` passed.'
    );
  }

  const state = JSON.parse(fs.readFileSync(adminStatePath, 'utf8')) as StorageStateFile;
  const origin = state.origins?.find((o) => o.origin === BASE_URL);
  const entry = origin?.localStorage.find((item) => item.name === AUTH_STORAGE_KEY);
  if (!entry) {
    throw new Error(
      `Admin storage state at ${adminStatePath} has no "${AUTH_STORAGE_KEY}" entry for ` +
        `${BASE_URL}. The persist key or the preview origin changed.`
    );
  }

  const parsed = JSON.parse(entry.value) as { state?: { accessToken?: string } };
  const token = parsed.state?.accessToken;
  if (!token) {
    throw new Error(
      `Admin storage state holds no accessToken. Shape of ${AUTH_STORAGE_KEY} changed.`
    );
  }
  return token;
}
