import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { IAuthRepository, authRepository as defaultRepo } from './repository';
import {
  AuthTokens,
  LoginDTO,
  RefreshRevocationReason,
  RefreshTokenRecord,
  UserRecord,
  UserSummary,
} from './types';
import { jwtConfig, rotationGraceMs } from './config';
import { deriveSuccessorJti, digestRefreshToken } from './tokens';
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

/**
 * A rejection that must also revoke a session family. Carried out of the rotation
 * transaction rather than thrown from inside it: throwing rolls the transaction back, and
 * a revocation that disappears with the rejection protects nobody.
 */
interface RevokeOutcome {
  kind: 'revoke';
  reason: RefreshRevocationReason;
  familyId: string;
  userId: number;
  /** What had already invalidated the presented token, for the log line. */
  invalidatedBy: RefreshRevocationReason | null;
}

type RotationOutcome = { kind: 'rotated'; result: RefreshResult } | RevokeOutcome;

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
   * The whole decision runs in one transaction with the user row and the presented token
   * row locked, because the interesting cases are all races. Two tabs sharing a cookie,
   * or one till retrying after a dropped response, present the same token at the same
   * moment; without serialization both would read a live row and both would rotate it,
   * forking one session into two.
   */
  async refresh(presentedToken: string): Promise<RefreshResult> {
    const claims = this.verifyRefreshToken(presentedToken);
    const presentedHash = digestRefreshToken(presentedToken);

    const outcome = await withTransaction((client) =>
      this.rotateWithinTransaction(client, claims.id, presentedHash)
    );

    if (outcome.kind === 'rotated') {
      return outcome.result;
    }

    // Revocation cannot live in the transaction that rejects: throwing from inside rolls
    // it back, and the family the server just decided was compromised would quietly stay
    // alive. It runs in its own transaction, after the first one has committed.
    const revokedSessions = await withTransaction(async (client) => {
      await this.repo.lockUserForSessionChange(outcome.userId, client);
      return this.repo.revokeFamily(outcome.familyId, outcome.reason, client);
    });

    if (outcome.reason === 'reuse') {
      // No token material in this log line or any other: a digest prefix is enough to
      // correlate with a row and cannot be presented to anything.
      logger.warn('Refresh token reuse detected; session family revoked', {
        userId: outcome.userId,
        familyId: outcome.familyId,
        tokenDigestPrefix: presentedHash.slice(0, 12),
        invalidatedBy: outcome.invalidatedBy,
        revokedSessions,
      });
    }

    throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
  }

  /**
   * The rotation itself. Returns rather than throws for the cases that must revoke a
   * family, because the caller has to do that outside this transaction.
   */
  private async rotateWithinTransaction(
    client: Queryable,
    claimedUserId: number,
    presentedHash: string
  ): Promise<RotationOutcome> {
    // The user row is locked first, always, and by every path that changes this user's
    // sessions. It is what orders a rotation against a concurrent global revocation --
    // see `lockUserForSessionChange`. The id comes from the token's verified signature,
    // and is cross-checked against the row below.
    const user = await this.repo.lockUserForSessionChange(claimedUserId, client);

    const locked = await this.repo.lockRefreshTokenByHash(presentedHash, client);
    if (!locked) {
      // A signature-valid token with no row at all: already swept after expiry, or issued
      // by an environment this database has never seen. There is no family to punish.
      throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
    }

    const { token: presented, now } = locked;

    // The token's subject must still match the row it was found under. These can only
    // disagree if a token minted for one user were stored against another, but the check
    // costs nothing and the failure it guards against is total.
    if (claimedUserId !== presented.user_id) {
      return {
        kind: 'revoke',
        reason: 'reuse',
        familyId: presented.family_id,
        userId: presented.user_id,
        invalidatedBy: presented.revoked_reason,
      };
    }

    // Re-read on every refresh is what makes a session revocable at all: a deleted user's
    // rows are gone with them, and any future account-status flag is enforced here rather
    // than waiting for the 7-day token to lapse.
    if (!user) {
      return {
        kind: 'revoke',
        reason: 'revoked_all',
        familyId: presented.family_id,
        userId: presented.user_id,
        invalidatedBy: presented.revoked_reason,
      };
    }

    // The successor a token rotates into is a pure function of that token (see
    // `deriveSuccessorJti`), so it is the same whether it is being minted now or
    // recovered by a replay moments later.
    const familyExpiresAt = new Date(presented.expires_at);
    const successor = this.deriveSuccessor(presented.user_id, presentedHash, familyExpiresAt);
    const successorHash = digestRefreshToken(successor);

    if (presented.revoked_at) {
      return this.resolveReplay(presented, user, now, successor, successorHash, client);
    }

    if (familyExpiresAt <= now) {
      throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
    }

    // Guarded on `revoked_at IS NULL`. Losing this means something invalidated the row
    // between the lock and here, so the safe answer is to issue nothing.
    const rotated = await this.repo.markRotated(presented.id, successorHash, client);
    if (!rotated) {
      throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
    }

    // The successor inherits the family's original expiry rather than starting a fresh 7
    // days. Rotation must not quietly turn a bounded session into a perpetual one: a
    // session still ends 7 days after the login that created it.
    await this.repo.createRefreshToken(
      user.id,
      successorHash,
      presented.family_id,
      familyExpiresAt.toISOString(),
      client
    );

    return {
      kind: 'rotated',
      result: {
        accessToken: this.signAccessToken(user),
        refreshToken: successor,
        user: this.toSummary(user),
      },
    };
  }

  /**
   * Decides what a presentation of an already-invalidated token means.
   *
   * Two honest clients present an invalidated token routinely: two browser tabs sharing
   * one cookie jar both fire `/auth/refresh` the moment the access token expires, and a
   * till whose response was dropped retries. Treating those as theft would revoke the
   * user's whole session on the most ordinary interaction there is. Treating theft as
   * honest would make rotation decorative.
   *
   * The line between them is time and cause. Within `REFRESH_ROTATION_GRACE_SECONDS` of
   * the row being *rotated*, the presentation is a replay of a refresh that already
   * happened, and it is answered **idempotently: with the very token that rotation
   * issued**, recomputed rather than stored. Anything else -- a rotated token replayed
   * after the window, or one invalidated by a logout or an earlier reuse -- is treated as
   * compromise.
   *
   * Answering with the existing successor rather than rotating again is the whole point.
   * Minting a fresh token for the second caller would invalidate the one the first caller
   * was already handed; in a shared cookie jar the loser's `Set-Cookie` can land last, and
   * the next request would then carry a token revoked minutes ago, be classified as reuse,
   * and revoke the family -- the exact logout this window exists to prevent, merely moved
   * one refresh later. Because no live token is invalidated here, a replay is now a pure
   * read: nothing is written at all.
   *
   * Handing an already-issued token to a second caller is safe in a way a fresh one is
   * not: it is the same token this session already holds, and a caller able to present its
   * predecessor could obtain it by presenting that predecessor a moment earlier in any
   * case. Reuse detection is not weakened, only deferred -- a thief and the legitimate
   * holder both end up on the same token, and the first of them to fall outside the window
   * trips detection then.
   */
  private async resolveReplay(
    presented: RefreshTokenRecord,
    user: UserRecord,
    now: Date,
    successor: string,
    successorHash: string,
    client: Queryable
  ): Promise<RotationOutcome> {
    const revokedAt = new Date(presented.revoked_at as Date);
    const withinGrace =
      presented.revoked_reason === 'rotated' &&
      now.getTime() - revokedAt.getTime() <= rotationGraceMs();

    if (!withinGrace) {
      return {
        kind: 'revoke',
        reason: 'reuse',
        familyId: presented.family_id,
        userId: presented.user_id,
        invalidatedBy: presented.revoked_reason,
      };
    }

    // The recomputed successor must be the one actually recorded at rotation time. A
    // mismatch means the row was rotated by something that derived it differently -- a
    // token predating this scheme, say -- so there is no issued token to hand back. That
    // is a rejection, not an accusation.
    if (presented.replaced_by_hash !== successorHash) {
      throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
    }

    const issued = await this.repo.lockRefreshTokenByHash(successorHash, client);
    if (
      !issued ||
      issued.token.revoked_at ||
      issued.token.family_id !== presented.family_id ||
      new Date(issued.token.expires_at) <= now
    ) {
      // The successor has itself been rotated onwards, revoked, or has expired. The caller
      // is simply behind; the live head of this family is somewhere else and this replay
      // has nothing valid to return. No revocation: nothing here is evidence of theft.
      throw new PublicError('UNAUTHORIZED', REFRESH_REJECTED);
    }

    return {
      kind: 'rotated',
      result: {
        accessToken: this.signAccessToken(user),
        refreshToken: successor,
        user: this.toSummary(user),
      },
    };
  }

  /**
   * Ends the session the presented token belongs to, including any token still live in it.
   *
   * Takes the user lock first, in the same order as a rotation, for the same reason: a
   * logout whose revoking statement started before an in-flight rotation committed simply
   * does not see the successor row that rotation inserted, and the session survives its
   * own logout. Ordering the two makes the loser either see the successor or find its own
   * target already gone.
   */
  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    let claimedUserId: number | null = null;
    try {
      claimedUserId = this.verifyRefreshToken(refreshToken).id;
    } catch {
      // An expired or unparseable token still deserves a best-effort revocation: there is
      // no verified user to lock on, but the digest may still match a row, and the family
      // behind an expired token cannot be rotated anyway.
      claimedUserId = null;
    }

    const tokenHash = digestRefreshToken(refreshToken);

    await withTransaction(async (client) => {
      if (claimedUserId !== null) {
        await this.repo.lockUserForSessionChange(claimedUserId, client);
      }

      const locked = await this.repo.lockRefreshTokenByHash(tokenHash, client);
      if (!locked) return;

      // The whole lineage, not just the row in hand: a mid-flight rotation may already
      // have issued a successor, and a logout that leaves it alive is not a logout.
      await this.repo.revokeFamily(locked.token.family_id, 'logout', client);
    });
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
    return withTransaction(async (client) => {
      // Same lock, same order as a rotation. Without it a refresh already in flight
      // commits its successor after this statement's snapshot was taken, and the session
      // an administrator just killed is alive again a millisecond later.
      await this.repo.lockUserForSessionChange(userId, client);
      return this.repo.revokeAllForUser(userId, 'revoked_all', client);
    });
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
  /**
   * The token a given refresh token rotates into.
   *
   * Byte-identical for identical inputs, which is what lets a replay be answered with the
   * token already issued instead of a new one. That requires the signature to carry no
   * wall-clock input at all: `iat` is suppressed and `exp` is taken from the family's
   * fixed expiry rather than computed from "now", so two callers milliseconds apart
   * produce the same string.
   */
  private deriveSuccessor(userId: number, presentedDigest: string, expiresAt: Date): string {
    const { refreshSecret } = jwtConfig();

    return jwt.sign({ id: userId, exp: Math.floor(expiresAt.getTime() / 1000) }, refreshSecret, {
      jwtid: deriveSuccessorJti(refreshSecret, presentedDigest),
      noTimestamp: true,
    });
  }

  private signRefreshToken(userId: number, expiresAt: Date, now: Date): string {
    const { refreshSecret } = jwtConfig();
    // Rounded up so a sub-second remainder never signs `expiresIn: 0`, which
    // jsonwebtoken reads as an already-expired token.
    const remainingSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));

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
