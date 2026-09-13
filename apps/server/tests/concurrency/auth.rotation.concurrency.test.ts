/**
 * Refresh-token rotation under real concurrency (issue #44).
 *
 * Rotation turns every refresh into a read-modify-write on one row, and the interesting
 * cases are all races: two browser tabs sharing one cookie fire `/auth/refresh` at the
 * same instant, and a till whose response was dropped retries. Get the race wrong in one
 * direction and one session silently forks into two live tokens; get it wrong in the
 * other and an honest user's whole session family is revoked for having two tabs open.
 *
 * pg-mem cannot decide any of this. It has no MVCC and its `FOR UPDATE` blocks nobody, so
 * two "concurrent" refreshes there are really sequential and the losing path is never
 * exercised. `tests/auth.rotation.test.ts` covers the sequential contract; what is proven
 * here is specifically what happens when two callers arrive together.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { AuthService } from '../../src/modules/core/auth/service';
import { digestRefreshToken } from '../../src/modules/core/auth/tokens';
import { resetEnvCache } from '../../src/config/env';
import { PublicError } from '../../src/http/errors';

describeWithPostgres('refresh token rotation under concurrency', () => {
  let harness: RealPostgresHarness;
  const service = new AuthService();
  const credentials = { email: 'rotation-till@moon.com', password: 'till123' };

  const originalGrace = process.env.REFRESH_ROTATION_GRACE_SECONDS;

  /** Runs `fn` with a specific grace window, restoring the previous one afterwards. */
  async function withGraceSeconds(seconds: number, fn: () => Promise<void>): Promise<void> {
    process.env.REFRESH_ROTATION_GRACE_SECONDS = String(seconds);
    resetEnvCache();
    try {
      await fn();
    } finally {
      if (originalGrace === undefined) delete process.env.REFRESH_ROTATION_GRACE_SECONDS;
      else process.env.REFRESH_ROTATION_GRACE_SECONDS = originalGrace;
      resetEnvCache();
    }
  }

  async function liveRows(): Promise<{ family_id: string; token_hash: string }[]> {
    const { rows } = await harness.pool.query<{ family_id: string; token_hash: string }>(
      'SELECT family_id, token_hash FROM refresh_tokens WHERE revoked_at IS NULL'
    );
    return rows;
  }

  async function reasonFor(token: string): Promise<string | null | undefined> {
    const { rows } = await harness.pool.query<{ revoked_reason: string | null }>(
      'SELECT revoked_reason FROM refresh_tokens WHERE token_hash = $1',
      [digestRefreshToken(token)]
    );
    return rows[0]?.revoked_reason;
  }

  beforeAll(async () => {
    // Four simultaneous refreshes plus margin; a larger pool competes with the other
    // real-PG files for max_connections.
    harness = await setupRealPostgres('auth-rotation-concurrency', { maxConnections: 8 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    const hash = await bcrypt.hash(credentials.password, 10);
    await harness.pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      ['Rotation Till', credentials.email, hash, 'Cashier']
    );
  });

  afterEach(async () => {
    await harness.pool.query('DELETE FROM refresh_tokens');
  });

  it('converges two simultaneous refreshes of one token on the same successor', async () => {
    const session = await service.login({ ...credentials });

    // The two-tab case: both callers present the same cookie at the same instant.
    const [first, second] = await Promise.all([
      service.refresh(session.refreshToken),
      service.refresh(session.refreshToken),
    ]);

    // Both are answered with the *same* token. Handing the loser a fresh one would
    // invalidate the winner's, and a shared cookie jar keeps whichever Set-Cookie lands
    // last -- see the three-step sequence below.
    expect(second.refreshToken).toBe(first.refreshToken);

    // Exactly one live token, in the original family. A fork here would mean two
    // independently-rotating sessions descending from one login.
    expect(await liveRows()).toHaveLength(1);

    const { rows: families } = await harness.pool.query<{ n: number }>(
      'SELECT COUNT(DISTINCT family_id)::int AS n FROM refresh_tokens'
    );
    expect(families[0].n).toBe(1);

    // Nothing was treated as theft: the honest race must not revoke the family.
    const { rows: reused } = await harness.pool.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM refresh_tokens WHERE revoked_reason = 'reuse'"
    );
    expect(reused[0].n).toBe(0);

    // Only two rows exist: the login's token and its one successor. The replay wrote
    // nothing.
    const { rows: total } = await harness.pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM refresh_tokens'
    );
    expect(total[0].n).toBe(2);
  });

  it('survives the full two-tab sequence, including the refresh after the race', async () => {
    const session = await service.login({ ...credentials });

    // Step 1 and 2: tabs A and B race on T1.
    const [a, b] = await Promise.all([
      service.refresh(session.refreshToken),
      service.refresh(session.refreshToken),
    ]);

    // Step 3 is where the previous design failed. Under it the two tabs held *different*
    // tokens, one of them already revoked; whichever Set-Cookie landed last in the shared
    // jar could be the dead one, and the next refresh -- typically 15 minutes later, well
    // outside any grace window -- was classified as reuse and logged the user out
    // everywhere. Converging on one token removes the choice: there is only one thing the
    // jar can hold.
    for (const jar of [a.refreshToken, b.refreshToken]) {
      expect(jar).toBe(a.refreshToken);
    }

    const third = await service.refresh(a.refreshToken);
    expect(third.refreshToken).not.toBe(a.refreshToken);

    // And a fourth, to show the session simply continues.
    const fourth = await service.refresh(third.refreshToken);
    expect(fourth.refreshToken).not.toBe(third.refreshToken);

    expect(await liveRows()).toHaveLength(1);
    const { rows: reused } = await harness.pool.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM refresh_tokens WHERE revoked_reason = 'reuse'"
    );
    expect(reused[0].n).toBe(0);
  });

  it('keeps one live token through a burst of four simultaneous refreshes', async () => {
    const session = await service.login({ ...credentials });

    const results = await Promise.allSettled([
      service.refresh(session.refreshToken),
      service.refresh(session.refreshToken),
      service.refresh(session.refreshToken),
      service.refresh(session.refreshToken),
    ]);

    // Every caller is answered deterministically -- either the session's one successor
    // or a clean 401, never a 500 from a unique-constraint collision or a lost update.
    const issued = new Set<string>();
    for (const result of results) {
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(PublicError);
      } else {
        issued.add(result.value.refreshToken);
      }
    }
    expect(issued.size).toBe(1);

    expect(await liveRows()).toHaveLength(1);
  });

  it('serializes concurrent refreshes of two different sessions independently', async () => {
    const laptop = await service.login({ ...credentials });
    const till = await service.login({ ...credentials });

    const [a, b] = await Promise.all([
      service.refresh(laptop.refreshToken),
      service.refresh(till.refreshToken),
    ]);

    expect(a.refreshToken).not.toBe(b.refreshToken);
    // One live head per family: two sessions, neither disturbed by the other.
    const live = await liveRows();
    expect(live).toHaveLength(2);
    expect(new Set(live.map((r) => r.family_id)).size).toBe(2);
  });

  it('detects reuse across connections and kills the live successor too', async () => {
    const session = await service.login({ ...credentials });
    const rotated = await service.refresh(session.refreshToken);

    // Age the rotation past the grace window. The window is measured between two
    // database-side instants, so this is the only way to cross it without sleeping.
    await harness.pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() - INTERVAL '1 hour' WHERE token_hash = $1",
      [digestRefreshToken(session.refreshToken)]
    );

    await expect(service.refresh(session.refreshToken)).rejects.toBeInstanceOf(PublicError);

    // The point of family revocation: the thief's replay also invalidates the token the
    // legitimate holder is still carrying, forcing a re-login rather than leaving a
    // shared session running.
    expect(await liveRows()).toHaveLength(0);
    expect(await reasonFor(rotated.refreshToken)).toBe('reuse');
    await expect(service.refresh(rotated.refreshToken)).rejects.toBeInstanceOf(PublicError);
  });

  it('with the grace window closed, a simultaneous replay is treated as reuse', async () => {
    await withGraceSeconds(0, async () => {
      const session = await service.login({ ...credentials });

      const results = await Promise.allSettled([
        service.refresh(session.refreshToken),
        service.refresh(session.refreshToken),
      ]);

      // Strict semantics, chosen deliberately by configuration: exactly one caller is
      // served and the other is treated as theft, which revokes the family. This is the
      // trade the default 10s window buys off -- with it, two tabs cost a logout.
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(1);

      const rejected = results.find((r) => r.status === 'rejected');
      expect(rejected && rejected.reason).toBeInstanceOf(PublicError);

      expect(await liveRows()).toHaveLength(0);
      const { rows } = await harness.pool.query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM refresh_tokens WHERE revoked_reason = 'reuse'"
      );
      expect(rows[0].n).toBeGreaterThan(0);
    });
  });

  it('a logout racing a refresh never leaves the session alive', async () => {
    const session = await service.login({ ...credentials });

    const [refreshed] = await Promise.allSettled([
      service.refresh(session.refreshToken),
      service.logout(session.refreshToken),
    ]);

    // Whichever order the two land in, the session must be gone afterwards: a logout that
    // races a rotation and leaves the successor alive is not a logout.
    expect(await liveRows()).toHaveLength(0);
    if (refreshed.status === 'fulfilled') {
      await expect(service.refresh(refreshed.value.refreshToken)).rejects.toBeInstanceOf(
        PublicError
      );
    }
  });

  it('global revocation racing a refresh leaves no live session', async () => {
    const laptop = await service.login({ ...credentials });
    const till = await service.login({ ...credentials });

    const { rows } = await harness.pool.query<{ id: number }>(
      'SELECT id FROM users WHERE email = $1',
      [credentials.email]
    );

    const [refreshed] = await Promise.allSettled([
      service.refresh(laptop.refreshToken),
      service.revokeAllSessions(rows[0].id),
    ]);

    expect(await liveRows()).toHaveLength(0);
    await expect(service.refresh(till.refreshToken)).rejects.toBeInstanceOf(PublicError);
    if (refreshed.status === 'fulfilled') {
      await expect(service.refresh(refreshed.value.refreshToken)).rejects.toBeInstanceOf(
        PublicError
      );
    }
  });
});
