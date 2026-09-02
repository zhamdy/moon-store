import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { IAuthRepository, authRepository as defaultRepo } from './repository';
import { AuthTokens, LoginDTO, RefreshTokenRecord, UserRecord, UserSummary } from './types';
import { jwtConfig, rotationGraceMs } from './config';
import { digestRefreshToken } from './tokens';
import { PublicError } from '../../../http/errors';
import { Queryable, withTransaction } from '../../../database/transaction';
import logger from '../../../../lib/logger';

/** What a successful refresh produces. The caller re-issues the cookie from it. */
export interface RefreshResult {
  accessToken: string;
  /** Rotation means every refresh mints a new one; the previous token is now dead. */
  refreshToken: string;
  user: UserSummary;
}

/**
 * One deliberately unhelpful message for every way a refresh can fail.
 *
 * Distinguishing "unknown token" from "revoked token" from "reused token" in the response
 * would tell a caller holding a stolen token which of those it has, and whether its theft
 * has been noticed. The server-side log records the distinction; the client does not get
 * it.
 */
const REFRESH_REJECTED = 'Refresh token expired or revoked';

/** How often, at most, expired session rows are swept. See `purgeExpiredSessions`. */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export class AuthService {
  private lastCleanupAt = 0;

  constructor(private repo: IAuthRepository = defaultRepo) {}

  async login(credentials: LoginDTO): Promise<AuthTokens> {
    const { email, password } = credentials;
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw new PublicError('UNAUTHORIZED', 'Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new PublicError('UNAUTHORIZED', 'Invalid email or password');
    }

    await this.repo.updateLastLogin(user.id);

    const { refreshTtlMs } = jwtConfig();

    // A login opens a new session family. Every rotation of this token stays inside it,
    // so the whole lineage descending from this one login is revocable as a unit.
    const familyId = randomUUID();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + refreshTtlMs);
    const refreshToken = this.signRefreshToken(user.id, expiresAt, issuedAt);

    await this.repo.createRefreshToken(
      user.id,
      digestRefreshToken(refreshToken),
      familyId,
      expiresAt.toISOString()
    );

    await this.purgeExpiredSessions();

    return {
      accessToken: this.signAccessToken(user),
      refreshToken,
      user: this.toSummary(user),
    };
  }

  /**
   * Validates a refresh token and rotates it: the presented token is invalidated and a
   * successor is issued in the same family. A token is therefore usable exactly once.
   *
   * The whole decision runs in one transaction with the presented row locked, because the
   * interesting cases are all races. Two tabs sharing a cookie, or one till retrying after
   * a dropped response, present the same token at the same moment; without serialization
   * both would read a live row and both would rotate it, forking one session into two.
   */
  async refresh(presentedToken: string): Promise<RefreshResult> {
    const claims = this.verifyRefreshToken(presentedToken);
    const presentedHash = digestRefreshToken(presentedToken);

    return withTransaction(async (client) => {
      const locked = await this.repo.lockRefreshTokenByHash(presentedHash, client);
      if (!locked) {
        // A signature-valid token with no row at all: already cleaned up after expiry, or
        // issued by an environment this database has never seen. There is no family to
        // punish, so this is a plain rejection.
        throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
      }

      const { token: presented, now } = locked;

      // Which row this refresh actually rotates. Normally the presented one; on a
      // tolerated replay, the family's current head instead — see `resolveReplay`.
      const target = presented.revoked_at
        ? await this.resolveReplay(presented, now, client)
        : presented;

      if (new Date(target.expires_at) <= now) {
        throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
      }

      // The user is re-read on every refresh, which is what makes a session revocable at
      // all: a deleted user's rows are gone with them, and any future account-status flag
      // is enforced here rather than waiting for the 7-day token to lapse.
      const user = await this.repo.findUserById(presented.user_id, client);
      if (!user) {
        await this.repo.revokeFamily(presented.family_id, 'revoked_all', client);
        throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
      }

      // The token's own subject must still match the row it was found under. These can
      // only disagree if a token were minted for one user and stored against another, but
      // the check costs nothing and the failure mode it guards is total.
      if (claims.id !== presented.user_id) {
        await this.repo.revokeFamily(presented.family_id, 'reuse', client);
        throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
      }

      // The successor inherits the family's original expiry rather than starting a fresh
      // 7 days. Rotation must not quietly turn a bounded session into a perpetual one:
      // a session still ends 7 days after the login that created it.
      const familyExpiresAt = new Date(target.expires_at);
      const successor = this.signRefreshToken(user.id, familyExpiresAt, now);
      const successorHash = digestRefreshToken(successor);

      // Guarded on `revoked_at IS NULL`. Losing this means something invalidated the row
      // between the lock and here, so the safe answer is to issue nothing.
      const rotated = await this.repo.markRotated(target.id, successorHash, client);
      if (!rotated) {
        throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
      }

      await this.repo.createRefreshToken(
        user.id,
        successorHash,
        presented.family_id,
        familyExpiresAt.toISOString(),
        client
      );

      return {
        accessToken: this.signAccessToken(user),
        refreshToken: successor,
        user: this.toSummary(user),
      };
    });
  }

  /**
   * Decides what a presentation of an already-invalidated token means, and returns the
   * row the caller should rotate instead.
   *
   * Two honest clients present an invalidated token routinely: two browser tabs sharing
   * one cookie both fire `/auth/refresh` the moment the access token expires, and a till
   * whose response was dropped retries. Treating those as theft would revoke the user's
   * whole session on the most ordinary interaction there is. Treating theft as honest
   * would make rotation decorative.
   *
   * The line between them is time and cause. Within `REFRESH_ROTATION_GRACE_SECONDS` of
   * the row being *rotated*, the presentation is a replay of an in-flight refresh: it
   * rotates the family's current head, so the caller gets a usable token and the family
   * stays single-lineage. Anything else — a rotated token replayed after the window, or a
   * token invalidated by a logout or an earlier reuse — is treated as compromise and
   * revokes the family.
   *
   * The residual risk is explicit: a thief racing the legitimate holder inside the window
   * gets one session. That window is seconds by configuration and can be set to zero for
   * strict semantics; the alternative is a spurious logout every time a user has two tabs
   * open.
   */
  private async resolveReplay(
    presented: RefreshTokenRecord,
    now: Date,
    client: Queryable
  ): Promise<RefreshTokenRecord> {
    const revokedAt = new Date(presented.revoked_at as Date);
    const withinGrace =
      presented.revoked_reason === 'rotated' &&
      now.getTime() - revokedAt.getTime() <= rotationGraceMs();

    if (!withinGrace) {
      const revokedSessions = await this.repo.revokeFamily(presented.family_id, 'reuse', client);
      // No token material here, in this log line or any other: the digest prefix is
      // enough to correlate with a row, and cannot be presented to anything.
      logger.warn('Refresh token reuse detected; session family revoked', {
        userId: presented.user_id,
        familyId: presented.family_id,
        tokenDigestPrefix: presented.token_hash.slice(0, 12),
        invalidatedBy: presented.revoked_reason,
        revokedSessions,
      });
      throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
    }

    const head = await this.repo.lockFamilyHead(presented.family_id, client);
    if (!head) {
      // The family was rotated within the window but has no live head — a logout or a
      // revocation landed in between. Nothing to issue, and nothing to accuse.
      throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
    }
    return head;
  }

  /** Ends the session the presented token belongs to, including any token still live in it. */
  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    const locked = await this.repo.lockRefreshTokenByHash(digestRefreshToken(refreshToken));
    if (!locked) return;

    // The whole lineage, not just the row in hand: a mid-flight rotation may already have
    // issued a successor, and a logout that leaves it alive is not a logout.
    await this.repo.revokeFamily(locked.token.family_id, 'logout');
  }

  /**
   * Revokes every session a user has, on every device.
   *
   * The lever for "my laptop was stolen", for a password reset, and for an administrator
   * cutting off an account. Access tokens already issued still work until they expire —
   * they are validated by signature alone — which is why that lifetime is short.
   *
   * @returns how many live sessions were revoked.
   */
  async revokeAllSessions(userId: number): Promise<number> {
    return this.repo.revokeAllForUser(userId, 'revoked_all');
  }

  async getMe(userId: number): Promise<UserSummary | null> {
    const user = await this.repo.findUserById(userId);
    if (!user) return null;
    return this.toSummary(user);
  }

  /**
   * Deletes session rows whose tokens have expired anyway.
   *
   * Piggy-backed on login rather than run from a scheduler because the server has no
   * scheduler to hang it off, and login is the one auth operation that is already doing
   * database work, is not latency-critical to the millisecond, and happens at least as
   * often as sessions are created. Throttled per process so a login rush does not run it
   * repeatedly, and non-fatal: a failed sweep must never fail a login.
   *
   * Deliberately keyed on expiry, not on revocation — a revoked row is the evidence that
   * makes reuse detectable, and stays until its token would have expired regardless.
   */
  async purgeExpiredSessions(force = false): Promise<number> {
    const nowMs = Date.now();
    if (!force && nowMs - this.lastCleanupAt < CLEANUP_INTERVAL_MS) {
      return 0;
    }
    this.lastCleanupAt = nowMs;

    try {
      return await this.repo.deleteExpiredRefreshTokens();
    } catch (error) {
      logger.warn('Failed to purge expired refresh tokens', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  private verifyRefreshToken(token: string): { id: number } {
    try {
      return jwt.verify(token, jwtConfig().refreshSecret) as { id: number };
    } catch {
      throw new PublicError('UNAUTHORIZED', 'Invalid refresh token');
    }
  }

  private signAccessToken(user: UserRecord): string {
    const { accessSecret, accessTtl } = jwtConfig();
    return jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      accessSecret,
      { expiresIn: accessTtl }
    );
  }

  /**
   * Signs a refresh token that expires exactly when its row does.
   *
   * `jti` is what makes one token one row. Without it the payload is only the user id
   * plus `iat`/`exp` at one-second resolution, so two tokens minted for the same user in
   * the same second are byte-identical: the second insert violates
   * `refresh_tokens.token_hash UNIQUE`, and either one's revocation kills the row both
   * were relying on.
   */
  private signRefreshToken(userId: number, expiresAt: Date, now: Date): string {
    const { refreshSecret } = jwtConfig();
    // Rounded up so a sub-second remainder never signs `expiresIn: 0`, which
    // jsonwebtoken reads as an already-expired token.
    const remainingSeconds = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)
    );

    return jwt.sign({ id: userId }, refreshSecret, {
      expiresIn: remainingSeconds,
      jwtid: randomUUID(),
    });
  }

  private toSummary(user: UserRecord): UserSummary {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}

export const authService = new AuthService();
