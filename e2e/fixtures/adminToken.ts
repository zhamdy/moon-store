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

  assertNotExpired(token);
  return token;
}

/** Seconds of remaining life below which the token is treated as unusable. */
const EXPIRY_MARGIN_SECONDS = 120;

/**
 * Access tokens live 15 minutes. This token is minted once by the setup project and held
 * for a worker's entire lifetime, so a run longer than that — a full suite, or a CI run
 * whose `retryStrategy: 'isolated'` replays failures at the end — would start seeing 401s
 * from `createProduct` and friends. That surfaces inside whichever spec happens to be
 * running, and reads as an application bug rather than an expired fixture.
 *
 * A stale `playwright/.auth/admin.json` left by an earlier run is the same failure with no
 * elapsed time at all, which is why `fs.existsSync` alone is not a sufficient guard.
 *
 * Failing loudly here is the Phase 1 answer. If runs grow past 15 minutes, the fix is to
 * build `adminApi` from the admin `storageState` so it carries the refresh cookie — not
 * to re-login per worker, which collides on `refresh_tokens.token UNIQUE` (issue #62).
 */
function assertNotExpired(token: string): void {
  const payload = token.split('.')[1];
  if (!payload) return;

  let exp: number | undefined;
  try {
    exp = (JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number }).exp;
  } catch {
    return; // Not our business to validate the token's shape; the server will reject it.
  }
  if (exp === undefined) return;

  const secondsLeft = exp - Math.floor(Date.now() / 1000);
  if (secondsLeft > EXPIRY_MARGIN_SECONDS) return;

  throw new Error(
    [
      `The admin access token from ${adminStatePath} expires in ${secondsLeft}s.`,
      '',
      secondsLeft <= 0
        ? 'It is already expired — usually a stale .auth file from an earlier run, since'
        : 'It is about to expire mid-run, so seeding calls would start returning 401 in',
      secondsLeft <= 0
        ? 'that directory is not cleaned between runs.'
        : 'whichever spec happened to be running.',
      '',
      'Re-run the full suite so the `setup` project mints a fresh one.',
    ].join('\n')
  );
}
