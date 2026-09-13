/**
 * Refresh-token session isolation under real concurrency (issue #62).
 *
 * The defect is a uniqueness race: two logins by the same user inside the same second
 * used to sign a byte-identical refresh token, so the second `INSERT` hit
 * `refresh_tokens.token UNIQUE` (23505 → 500) and, when both did land, a logout by
 * either session deleted the one row both were using.
 *
 * pg-mem cannot prove this: its "concurrent" writers are really sequential, so two
 * genuinely simultaneous logins — two tills opened together on a shared account at shift
 * start, the realistic trigger — only exist against real PostgreSQL.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { AuthService } from '../../src/modules/core/auth/service';
import { digestRefreshToken } from '../../src/modules/core/auth/tokens';
import { PublicError } from '../../src/http/errors';

describeWithPostgres('refresh token session isolation under concurrency', () => {
  let harness: RealPostgresHarness;
  const service = new AuthService();
  const credentials = { email: 'shared-till@moon.com', password: 'till123' };

  beforeAll(async () => {
    // Four simultaneous logins plus margin; a larger pool competes with the other
    // real-PG files for max_connections.
    harness = await setupRealPostgres('auth-concurrency', { maxConnections: 6 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    // Pin the clock to a whole-second boundary so every login in a case shares one
    // `iat` — that is the collision condition, and leaving it to scheduling luck would
    // make the regression cover intermittent. The boundary is taken from the current
    // wall clock so the stored `expires_at` still sits in the future of the database's
    // own NOW().
    vi.setSystemTime(new Date(Math.floor(Date.now() / 1000) * 1000));

    await harness.truncate();
    const hash = await bcrypt.hash(credentials.password, 10);
    await harness.pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      ['Shared Till', credentials.email, hash, 'Cashier']
    );
  });

  afterEach(async () => {
    vi.useRealTimers();
    await harness.pool.query('DELETE FROM refresh_tokens');
  });

  it('lets the same user log in twice simultaneously, with one row per session', async () => {
    const [first, second] = await Promise.all([
      service.login({ ...credentials }),
      service.login({ ...credentials }),
    ]);

    expect(second.refreshToken).not.toBe(first.refreshToken);

    const { rows } = await harness.pool.query<{ token_hash: string }>(
      'SELECT token_hash FROM refresh_tokens ORDER BY id'
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.token_hash)).size).toBe(2);
  });

  it('survives four simultaneous logins without a unique-constraint failure', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => service.login({ ...credentials }))
    );

    const tokens = new Set(results.map((r) => r.refreshToken));
    expect(tokens.size).toBe(4);

    const { rows } = await harness.pool.query<{ count: string }>(
      'SELECT COUNT(*)::int AS count FROM refresh_tokens'
    );
    expect(Number(rows[0].count)).toBe(4);
  });

  it('logging out of one concurrent session leaves the other one valid', async () => {
    const [till1, till2] = await Promise.all([
      service.login({ ...credentials }),
      service.login({ ...credentials }),
    ]);

    await service.logout(till1.refreshToken);

    await expect(service.refresh(till1.refreshToken)).rejects.toBeInstanceOf(PublicError);

    const refreshed = await service.refresh(till2.refreshToken);
    expect(refreshed.user.email).toBe(credentials.email);

    // Rotation replaces the row behind a live session, so the durable claim is about
    // families, not rows: till1's lineage is entirely dead and till2's still has a head.
    const { rows } = await harness.pool.query<{ family_id: string; live: number }>(
      `SELECT family_id, COUNT(*) FILTER (WHERE revoked_at IS NULL)::int AS live
         FROM refresh_tokens GROUP BY family_id`
    );
    expect(rows).toHaveLength(2);
    const liveFamilies = rows.filter((r) => r.live > 0);
    expect(liveFamilies).toHaveLength(1);

    const { rows: till1Rows } = await harness.pool.query<{ family_id: string }>(
      'SELECT family_id FROM refresh_tokens WHERE token_hash = $1',
      [digestRefreshToken(till1.refreshToken)]
    );
    expect(till1Rows[0].family_id).not.toBe(liveFamilies[0].family_id);
  });
});
