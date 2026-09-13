/**
 * Refresh-token rotation, reuse detection, revocation and cleanup (issue #44).
 *
 * These are the deterministic, sequential halves of the contract: one caller at a time,
 * so pg-mem is enough. The genuinely concurrent halves — two tills presenting the same
 * token at the same instant, and what the grace window does to that race — cannot be
 * proven here because pg-mem has no MVCC and no row locks that block. They live in
 * `tests/concurrency/auth.rotation.concurrency.test.ts` against real PostgreSQL.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { Pool as PgPool } from 'pg';
import path from 'path';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { AuthService } from '../src/modules/core/auth/service';
import { AuthRepository } from '../src/modules/core/auth/repository';
import { digestRefreshToken } from '../src/modules/core/auth/tokens';
import {
  DEFAULT_ACCESS_TTL,
  DEFAULT_COOKIE_SAMESITE,
  DEFAULT_ROTATION_GRACE_SECONDS,
  MAX_ACCESS_TTL_SECONDS,
  clearRefreshCookieOptions,
  durationToSeconds,
  jwtConfig,
  refreshCookieOptions,
  resetAuthConfigWarnings,
  resolveAccessTtl,
  resolveRefreshTtlDays,
  resolveRotationGraceSeconds,
  resolveSameSite,
  rotationGraceMs,
} from '../src/modules/core/auth/config';
import { resetEnvCache } from '../src/config/env';
import { PublicError } from '../src/http/errors';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

let testPool: PgPool;
let service: AuthService;
let userId: number;

const credentials = { email: 'till@moon.com', password: 'till123' };

interface TokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: string | null;
  replaced_by_hash: string | null;
}

async function rows(where = ''): Promise<TokenRow[]> {
  const result = await testPool.query<TokenRow>(
    `SELECT * FROM refresh_tokens ${where} ORDER BY id`
  );
  return result.rows;
}

async function rowFor(token: string): Promise<TokenRow | undefined> {
  const result = await testPool.query<TokenRow>(
    'SELECT * FROM refresh_tokens WHERE token_hash = $1',
    [digestRefreshToken(token)]
  );
  return result.rows[0];
}

/**
 * Ages a revocation past the replay grace window.
 *
 * The window is measured between two database-side instants, so no amount of faking the
 * Node clock moves it. Rewriting `revoked_at` is the only way to get a deterministic
 * "this was rotated a while ago" without sleeping through the real window.
 */
async function backdateRevocation(token: string, msAgo: number): Promise<void> {
  await testPool.query('UPDATE refresh_tokens SET revoked_at = $2 WHERE token_hash = $1', [
    digestRefreshToken(token),
    new Date(Date.now() - msAgo),
  ]);
}

beforeAll(async () => {
  testPool = createPgMemPool();
  setPool(testPool);
  await runMigrationsUp(testPool, path.join(__dirname, '../src/database/migrations'));

  const hash = await bcrypt.hash(credentials.password, 10);
  const inserted = await testPool.query<{ id: number }>(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    ['Till', credentials.email, hash, 'Cashier']
  );
  userId = inserted.rows[0].id;
});

afterAll(async () => {
  await closePool();
});

beforeEach(async () => {
  service = new AuthService();
  await testPool.query('DELETE FROM refresh_tokens');
});

describe('refresh token rotation', () => {
  it('issues a different token on every refresh and retires the presented one', async () => {
    const session = await service.login({ ...credentials });
    const rotated = await service.refresh(session.refreshToken);

    expect(rotated.refreshToken).not.toBe(session.refreshToken);

    const previous = await rowFor(session.refreshToken);
    const successor = await rowFor(rotated.refreshToken);

    expect(previous?.revoked_reason).toBe('rotated');
    expect(previous?.revoked_at).not.toBeNull();
    expect(previous?.replaced_by_hash).toBe(digestRefreshToken(rotated.refreshToken));

    expect(successor?.revoked_at).toBeNull();
    // Same lineage: this is one session that rotated, not a second session.
    expect(successor?.family_id).toBe(previous?.family_id);

    // The invariant the whole design rests on: at most one live token per family.
    expect(await rows('WHERE revoked_at IS NULL')).toHaveLength(1);
  });

  it('rotates repeatedly, each successor usable exactly once', async () => {
    const session = await service.login({ ...credentials });

    let current = session.refreshToken;
    const seen = new Set([current]);
    for (let i = 0; i < 3; i += 1) {
      const next = await service.refresh(current);
      expect(seen.has(next.refreshToken)).toBe(false);
      seen.add(next.refreshToken);
      current = next.refreshToken;
    }

    expect(await rows('WHERE revoked_at IS NULL')).toHaveLength(1);
    expect(await rows()).toHaveLength(4);
  });

  it('never lets a rotation extend the session past the login that created it', async () => {
    const session = await service.login({ ...credentials });
    const originalExpiry = (await rowFor(session.refreshToken))!.expires_at;

    const rotated = await service.refresh(session.refreshToken);
    const successorExpiry = (await rowFor(rotated.refreshToken))!.expires_at;

    // A sliding expiry would make a stolen-and-kept-warm session immortal.
    expect(new Date(successorExpiry).getTime()).toBe(new Date(originalExpiry).getTime());

    // The JWT's own exp tracks the row, so neither outlives the other.
    const claims = jwt.verify(rotated.refreshToken, JWT_REFRESH_SECRET) as { exp: number };
    expect(claims.exp * 1000).toBeLessThanOrEqual(new Date(successorExpiry).getTime() + 1000);
  });

  it('keeps the access-token contract unchanged across a rotation', async () => {
    const session = await service.login({ ...credentials });
    const rotated = await service.refresh(session.refreshToken);

    const claims = jwt.verify(rotated.accessToken, process.env.JWT_SECRET!) as Record<
      string,
      unknown
    >;
    expect(claims).toMatchObject({ id: userId, email: credentials.email, role: 'Cashier' });
    expect(rotated.user).toEqual({
      id: userId,
      name: 'Till',
      email: credentials.email,
      role: 'Cashier',
    });
  });
});

describe('refresh token reuse detection', () => {
  it('revokes the whole family when a retired token is replayed after the grace window', async () => {
    const session = await service.login({ ...credentials });
    const rotated = await service.refresh(session.refreshToken);
    await backdateRevocation(session.refreshToken, 10 * 60_000);

    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(PublicError);

    // Not just the replayed token: the live successor the thief did not have is dead too,
    // which is the point — the legitimate holder is forced back through login.
    expect(await rows('WHERE revoked_at IS NULL')).toHaveLength(0);
    expect((await rowFor(session.refreshToken))?.revoked_reason).toBe('rotated');
    expect((await rowFor(rotated.refreshToken))?.revoked_reason).toBe('reuse');

    await expect(service.refresh(rotated.refreshToken)).rejects.toBeInstanceOf(PublicError);
  });

  it('still rejects when the revocation that follows detection fails', async () => {
    const session = await service.login({ ...credentials });
    await service.refresh(session.refreshToken);
    await backdateRevocation(session.refreshToken, 10 * 60_000);

    const repo = new AuthRepository();
    const revokeFamily = vi
      .spyOn(repo, 'revokeFamily')
      .mockRejectedValue(Object.assign(new Error('deadlock detected'), { code: '40P01' }));
    const failing = new AuthService(repo);

    // A database fault while revoking must not turn the 401 into a 500. A 500 invites the
    // caller to retry a credential that is exactly as invalid as it was, and reads as a
    // server fault rather than as a rejected token.
    await expect(failing.refresh(session.refreshToken)).rejects.toBeInstanceOf(PublicError);
    expect(revokeFamily).toHaveBeenCalled();
    revokeFamily.mockRestore();
  });

  it('rejects without naming the reason', async () => {
    const session = await service.login({ ...credentials });
    await service.refresh(session.refreshToken);
    await backdateRevocation(session.refreshToken, 10 * 60_000);

    const reuse = await service.refresh(session.refreshToken).catch((e) => e);
    const unknown = await service
      .refresh(jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d', jwtid: 'ghost' }))
      .catch((e) => e);

    // A caller holding a stolen token must not be able to learn which failure it hit, or
    // whether its theft has been noticed.
    expect(reuse.code).toBe('UNAUTHORIZED');
    expect(reuse.message).toBe(unknown.message);
  });

  it('answers a replay inside the grace window with the token already issued', async () => {
    const session = await service.login({ ...credentials });
    const first = await service.refresh(session.refreshToken);

    // The dropped-response retry, and the second browser tab: the same token presented
    // again moments later. This must not look like theft -- and, just as importantly, it
    // must not invalidate the token the first caller was already handed.
    const replay = await service.refresh(session.refreshToken);

    expect(replay.refreshToken).toBe(first.refreshToken);
    // A replay writes nothing at all: no new row, no new revocation.
    expect(await rows()).toHaveLength(2);
    expect(await rows('WHERE revoked_at IS NULL')).toHaveLength(1);
    expect((await rowFor(first.refreshToken))?.revoked_at).toBeNull();

    // A fresh access token is still issued -- that is what the caller came for.
    expect(replay.accessToken).toEqual(expect.any(String));
  });

  it('leaves the session usable after a replay, through the next refresh', async () => {
    const session = await service.login({ ...credentials });
    const first = await service.refresh(session.refreshToken);
    const replay = await service.refresh(session.refreshToken);

    // The step the previous design got wrong: whichever token the shared cookie jar ends
    // up holding, the next refresh must succeed rather than be read as reuse. Both
    // callers hold the same token, so there is only one thing the jar can hold.
    const third = await service.refresh(replay.refreshToken);

    expect(third.refreshToken).not.toBe(first.refreshToken);
    expect(await rows('WHERE revoked_at IS NULL')).toHaveLength(1);
    const { rows: reused } = await testPool.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM refresh_tokens WHERE revoked_reason = 'reuse'"
    );
    expect(reused[0].n).toBe(0);
  });

  it('rejects a replay whose successor has itself been rotated onwards', async () => {
    const session = await service.login({ ...credentials });
    const first = await service.refresh(session.refreshToken);
    await service.refresh(first.refreshToken);

    // Two rotations behind: there is no live token to hand back. A rejection, but not an
    // accusation -- the family's live head is untouched.
    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(PublicError);
    expect(await rows('WHERE revoked_at IS NULL')).toHaveLength(1);
    const { rows: reused } = await testPool.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM refresh_tokens WHERE revoked_reason = 'reuse'"
    );
    expect(reused[0].n).toBe(0);
  });

  it('does not tolerate a replay of a token killed by logout, however recent', async () => {
    const session = await service.login({ ...credentials });
    await service.logout(session.refreshToken);

    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(PublicError);
    expect((await rowFor(session.refreshToken))?.revoked_reason).toBe('logout');
  });

  it('rejects a signature-valid token that has no row, without accusing anyone', async () => {
    const session = await service.login({ ...credentials });
    const ghost = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, {
      expiresIn: '7d',
      jwtid: 'never-stored',
    });

    await expect(service.refresh(ghost)).rejects.toBeInstanceOf(PublicError);
    // There is no family behind an unknown token, so the real session is untouched.
    const still = await service.refresh(session.refreshToken);
    expect(still.accessToken).toEqual(expect.any(String));
  });

  it('rejects a token signed with the wrong secret before touching the database', async () => {
    const forged = jwt.sign({ id: userId }, 'a-different-secret-of-sufficient-length', {
      expiresIn: '7d',
    });
    await expect(service.refresh(forged)).rejects.toBeInstanceOf(PublicError);
  });
});

describe('refresh token expiry', () => {
  it('rejects a token whose row has expired even if the JWT has not', async () => {
    const session = await service.login({ ...credentials });
    await testPool.query('UPDATE refresh_tokens SET expires_at = $2 WHERE token_hash = $1', [
      digestRefreshToken(session.refreshToken),
      new Date(Date.now() - 1000),
    ]);

    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(PublicError);
  });

  it('rejects an expired JWT without a database round trip', async () => {
    const expired = jwt.sign({ id: userId }, JWT_REFRESH_SECRET, {
      expiresIn: '-1s',
      jwtid: 'expired',
    });
    await expect(service.refresh(expired)).rejects.toBeInstanceOf(PublicError);
  });
});

describe('session revocation', () => {
  it('logout ends the lineage, including a successor issued mid-flight', async () => {
    const session = await service.login({ ...credentials });
    const rotated = await service.refresh(session.refreshToken);

    // Logging out with the token the client happens to be holding — which may be the one
    // already retired by an in-flight rotation — must still kill the live successor.
    await service.logout(session.refreshToken);

    expect(await rows('WHERE revoked_at IS NULL')).toHaveLength(0);
    await expect(service.refresh(rotated.refreshToken)).rejects.toBeInstanceOf(PublicError);
  });

  it("logout of one session leaves the user's other sessions alone", async () => {
    const laptop = await service.login({ ...credentials });
    const till = await service.login({ ...credentials });

    await service.logout(laptop.refreshToken);

    await expect(service.refresh(laptop.refreshToken)).rejects.toBeInstanceOf(PublicError);
    const stillWorking = await service.refresh(till.refreshToken);
    expect(stillWorking.refreshToken).toEqual(expect.any(String));
  });

  it('logout of an unknown token is a no-op, not an error', async () => {
    await expect(service.logout('not-even-a-jwt')).resolves.toBeUndefined();
    await expect(service.logout(undefined)).resolves.toBeUndefined();
  });

  it('global revocation ends every session the user has', async () => {
    const laptop = await service.login({ ...credentials });
    const till = await service.login({ ...credentials });
    const phone = await service.login({ ...credentials });

    const revoked = await service.revokeAllSessions(userId);
    expect(revoked).toBe(3);

    for (const session of [laptop, till, phone]) {
      await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(PublicError);
    }
    expect(await rows('WHERE revoked_at IS NULL')).toHaveLength(0);
  });

  it('global revocation does not touch another user', async () => {
    const otherHash = await bcrypt.hash('other123', 10);
    const other = await testPool.query<{ id: number }>(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Other', `other-${Date.now()}@moon.com`, otherHash, 'Cashier']
    );
    await service.login({ ...credentials });

    expect(await service.revokeAllSessions(other.rows[0].id)).toBe(0);
    expect(await rows('WHERE revoked_at IS NULL')).toHaveLength(1);
  });

  it('a deleted user cannot refresh an existing session', async () => {
    const deletableHash = await bcrypt.hash('gone123', 10);
    const email = `gone-${Date.now()}@moon.com`;
    const created = await testPool.query<{ id: number }>(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
      ['Gone', email, deletableHash, 'Cashier']
    );
    const session = await service.login({ email, password: 'gone123' });

    await testPool.query('DELETE FROM users WHERE id = $1', [created.rows[0].id]);

    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(PublicError);
  });
});

describe('session cleanup', () => {
  it('deletes expired rows and keeps revoked ones that could still prove reuse', async () => {
    const live = await service.login({ ...credentials });
    const retired = await service.login({ ...credentials });
    await service.logout(retired.refreshToken);

    const stale = await service.login({ ...credentials });
    await testPool.query('UPDATE refresh_tokens SET expires_at = $2 WHERE token_hash = $1', [
      digestRefreshToken(stale.refreshToken),
      new Date(Date.now() - 1000),
    ]);

    const deleted = await service.purgeExpiredSessions(true);

    expect(deleted).toBe(1);
    expect(await rowFor(stale.refreshToken)).toBeUndefined();
    // Revoked but unexpired: still the evidence that makes a later replay detectable.
    expect(await rowFor(retired.refreshToken)).toBeDefined();
    expect(await rowFor(live.refreshToken)).toBeDefined();
  });

  it('throttles itself so a login rush does not re-sweep on every login', async () => {
    await service.purgeExpiredSessions(true);

    const stale = await service.login({ ...credentials });
    await testPool.query('UPDATE refresh_tokens SET expires_at = $2 WHERE token_hash = $1', [
      digestRefreshToken(stale.refreshToken),
      new Date(Date.now() - 1000),
    ]);

    expect(await service.purgeExpiredSessions()).toBe(0);
    expect(await rowFor(stale.refreshToken)).toBeDefined();
  });
});

describe('refresh cookie settings', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSameSite = process.env.COOKIE_SAMESITE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSameSite === undefined) delete process.env.COOKIE_SAMESITE;
    else process.env.COOKIE_SAMESITE = originalSameSite;
    resetEnvCache();
  });

  it('is httpOnly, Secure and SameSite in production', () => {
    process.env.NODE_ENV = 'production';
    resetEnvCache();

    expect(refreshCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it('clears with exactly the attributes it was set with', () => {
    process.env.NODE_ENV = 'production';
    resetEnvCache();

    const { maxAge, ...setAttributes } = refreshCookieOptions();
    expect(maxAge).toBeGreaterThan(0);
    // A browser only drops a cookie when the clearing attributes match. Drift here is a
    // logout that leaves a live refresh cookie in the browser.
    expect(clearRefreshCookieOptions()).toEqual(setAttributes);
  });

  it('forces Secure when SameSite=None, which browsers reject without it', () => {
    process.env.NODE_ENV = 'development';
    process.env.COOKIE_SAMESITE = 'none';
    resetEnvCache();

    expect(refreshCookieOptions()).toMatchObject({ sameSite: 'none', secure: true });
  });

  it('accepts the spelling operators actually use: SameSite=None', () => {
    process.env.NODE_ENV = 'development';
    // The attribute is capitalised in every spec, devtool and blog post. A case-sensitive
    // match here would refuse to boot the server over letter case.
    process.env.COOKIE_SAMESITE = 'None';
    resetEnvCache();

    expect(refreshCookieOptions()).toMatchObject({ sameSite: 'none', secure: true });
  });

  it('falls back to lax on an unrecognised SameSite rather than failing to boot', () => {
    process.env.COOKIE_SAMESITE = 'sometimes';
    resetEnvCache();

    expect(refreshCookieOptions()).toMatchObject({ sameSite: 'lax' });
  });

  it('does not set Secure in development, where there is no TLS to satisfy it', () => {
    process.env.NODE_ENV = 'development';
    resetEnvCache();

    expect(refreshCookieOptions()).toMatchObject({ secure: false, httpOnly: true });
  });
});

describe('auth configuration resolvers', () => {
  const saved = {
    accessTtl: process.env.JWT_ACCESS_TTL,
    refreshDays: process.env.JWT_REFRESH_TTL_DAYS,
    grace: process.env.REFRESH_ROTATION_GRACE_SECONDS,
  };

  function restore(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  afterEach(() => {
    restore('JWT_ACCESS_TTL', saved.accessTtl);
    restore('JWT_REFRESH_TTL_DAYS', saved.refreshDays);
    restore('REFRESH_ROTATION_GRACE_SECONDS', saved.grace);
    resetEnvCache();
    resetAuthConfigWarnings();
  });

  it('reads jsonwebtoken duration syntax, bare seconds included', () => {
    expect(durationToSeconds('900')).toBe(900);
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('2h')).toBe(7200);
    expect(durationToSeconds('7d')).toBe(604800);
    expect(durationToSeconds('fifteen minutes')).toBeUndefined();
  });

  it('caps the access TTL, because revocation cannot reach an access token', () => {
    // JWT_ACCESS_TTL=7d would make logout-all, family revocation and reuse detection
    // no-ops for a week. Over the ceiling the value is a misconfiguration, not an intent.
    expect(resolveAccessTtl('7d')).toBe(DEFAULT_ACCESS_TTL);
    expect(resolveAccessTtl(`${MAX_ACCESS_TTL_SECONDS + 1}s`)).toBe(DEFAULT_ACCESS_TTL);
    expect(resolveAccessTtl(`${MAX_ACCESS_TTL_SECONDS}s`)).toBe(`${MAX_ACCESS_TTL_SECONDS}s`);
    expect(resolveAccessTtl('30m')).toBe('30m');
  });

  it('falls back rather than failing the parse on a malformed value', () => {
    expect(resolveAccessTtl('15 minutes')).toBe(DEFAULT_ACCESS_TTL);
    expect(resolveAccessTtl('0')).toBe(DEFAULT_ACCESS_TTL);
    expect(resolveRefreshTtlDays('seven')).toBe(7);
    expect(resolveRefreshTtlDays('0')).toBe(7);
    expect(resolveRefreshTtlDays('4000')).toBe(7);
    expect(resolveRotationGraceSeconds('-1')).toBe(DEFAULT_ROTATION_GRACE_SECONDS);
    expect(resolveRotationGraceSeconds('99999')).toBe(DEFAULT_ROTATION_GRACE_SECONDS);
  });

  it('honours a zero grace window, which is strict rotation and not a missing value', () => {
    expect(resolveRotationGraceSeconds('0')).toBe(0);
    expect(resolveSameSite(undefined)).toBe(DEFAULT_COOKIE_SAMESITE);
  });

  it('is wired through to the effective configuration', () => {
    process.env.JWT_ACCESS_TTL = '30d';
    process.env.REFRESH_ROTATION_GRACE_SECONDS = '5';
    resetEnvCache();

    expect(jwtConfig().accessTtl).toBe(DEFAULT_ACCESS_TTL);
    expect(rotationGraceMs()).toBe(5000);
  });
});

describe('successor derivation', () => {
  it('derives the same successor for the same token, and a different one per token', async () => {
    const session = await service.login({ ...credentials });
    const other = await service.login({ ...credentials });

    const a = await service.refresh(session.refreshToken);
    const b = await service.refresh(session.refreshToken);
    const c = await service.refresh(other.refreshToken);

    expect(b.refreshToken).toBe(a.refreshToken);
    expect(c.refreshToken).not.toBe(a.refreshToken);
  });

  it('carries no wall-clock input, so two callers milliseconds apart agree', async () => {
    const session = await service.login({ ...credentials });
    const first = await service.refresh(session.refreshToken);

    const claims = jwt.verify(first.refreshToken, JWT_REFRESH_SECRET) as Record<string, unknown>;
    // `iat` is what would otherwise differ between two callers; the successor must not
    // carry it, and its `exp` comes from the family's fixed expiry.
    expect(claims.iat).toBeUndefined();
    expect(claims.jti).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('stored representation', () => {
  it('stores a SHA-256 digest and nothing that can be presented', async () => {
    const session = await service.login({ ...credentials });
    const [row] = await rows();

    expect(row.token_hash).toBe(
      createHash('sha256').update(session.refreshToken, 'utf8').digest('hex')
    );
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    // Nothing in the row, in any column, reconstructs the token.
    expect(JSON.stringify(row)).not.toContain(session.refreshToken);
    expect(JSON.stringify(row)).not.toContain(session.refreshToken.split('.')[2]);
  });
});
