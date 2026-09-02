import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { RefreshTokenRecord, RefreshRevocationReason, UserRecord } from './types';

/**
 * A locked refresh-token row plus the database's own clock.
 *
 * The clock travels with the row deliberately. Every freshness decision made about the
 * row -- has it expired, was it rotated within the replay grace window -- compares two
 * instants, and one of them (`expires_at`, `revoked_at`) is written by PostgreSQL. Comparing
 * those against the Node process's `Date.now()` would fold clock skew between the app host
 * and the database into a security boundary. Reading both from the same statement removes
 * the skew entirely.
 *
 * It is `clock_timestamp()` and emphatically not `NOW()`: `NOW()` is fixed at transaction
 * start, so for the caller that *loses* the lock race — the one that started its
 * transaction before the winner committed — it reads as earlier than the revocation it is
 * being compared against. Elapsed time would come out negative, and every replay would
 * look like it landed inside the grace window no matter how wide that window was set.
 */
export interface LockedRefreshToken {
  token: RefreshTokenRecord;
  now: Date;
}

export interface IAuthRepository {
  findUserByEmail(email: string, queryable?: Queryable): Promise<UserRecord | null>;
  findUserById(id: number, queryable?: Queryable): Promise<UserRecord | null>;
  lockUserForSessionChange(id: number, queryable?: Queryable): Promise<UserRecord | null>;
  updateLastLogin(userId: number, queryable?: Queryable): Promise<void>;
  createRefreshToken(
    userId: number,
    tokenHash: string,
    familyId: string,
    expiresAt: string,
    queryable?: Queryable
  ): Promise<void>;
  lockRefreshTokenByHash(
    tokenHash: string,
    queryable?: Queryable
  ): Promise<LockedRefreshToken | null>;
  markRotated(id: number, replacedByHash: string, queryable?: Queryable): Promise<boolean>;
  lockFamilyHead(familyId: string, queryable?: Queryable): Promise<RefreshTokenRecord | null>;
  revokeFamily(
    familyId: string,
    reason: RefreshRevocationReason,
    queryable?: Queryable
  ): Promise<number>;
  revokeAllForUser(
    userId: number,
    reason: RefreshRevocationReason,
    queryable?: Queryable
  ): Promise<number>;
  deleteExpiredRefreshTokens(queryable?: Queryable): Promise<number>;
}

export class AuthRepository implements IAuthRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findUserByEmail(email: string, queryable?: Queryable): Promise<UserRecord | null> {
    const result = await this.q(queryable).query<UserRecord>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findUserById(id: number, queryable?: Queryable): Promise<UserRecord | null> {
    const result = await this.q(queryable).query<UserRecord>(
      'SELECT id, name, email, password_hash, role, created_at, last_login FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Reads a user with `FOR UPDATE`, as the serialization point for every change to that
   * user's sessions.
   *
   * Row locks on `refresh_tokens` alone cannot order a rotation against a global
   * revocation: "revoke everything live for this user" is a single statement whose
   * snapshot is fixed when it starts, so a successor row inserted by a rotation that
   * commits a moment later is simply not in it -- the session the administrator just
   * killed comes back. Both paths taking this lock first makes the two mutually
   * exclusive: whichever arrives second either sees its target already revoked, or
   * revokes the successor the first one inserted.
   *
   * Lock order is always user-then-token. Logout deliberately does not take this lock,
   * because it locks its token row first and adding the user lock afterwards would
   * invert the order and open a deadlock against refresh.
   */
  async lockUserForSessionChange(id: number, queryable?: Queryable): Promise<UserRecord | null> {
    const result = await this.q(queryable).query<UserRecord>(
      `SELECT id, name, email, password_hash, role, created_at, last_login
         FROM users WHERE id = $1
         FOR UPDATE`,
      [id]
    );
    return result.rows[0] || null;
  }

  async updateLastLogin(userId: number, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
  }

  async createRefreshToken(
    userId: number,
    tokenHash: string,
    familyId: string,
    expiresAt: string,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, tokenHash, familyId, expiresAt]
    );
  }

  /**
   * Takes a row lock on the presented token's row and returns it in whatever state it is
   * in -- live, rotated, revoked, expired.
   *
   * `FOR UPDATE` is what makes the rotation race decidable rather than lucky. Two callers
   * presenting the same token are serialized here: the second one blocks until the first
   * commits and then reads the row the first *left behind*, so it sees `revoked_reason =
   * 'rotated'` and can tell a same-instant replay from a token stolen an hour ago.
   * Without the lock both would read a live row, both would rotate it, and the family
   * would silently branch into two live sessions.
   */
  async lockRefreshTokenByHash(
    tokenHash: string,
    queryable?: Queryable
  ): Promise<LockedRefreshToken | null> {
    const result = await this.q(queryable).query<RefreshTokenRecord & { db_now: Date }>(
      'SELECT *, clock_timestamp() AS db_now FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE',
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row) return null;

    const { db_now: now, ...token } = row;
    return { token: token as RefreshTokenRecord, now: new Date(now) };
  }

  /**
   * Marks one live row as rotated. Guarded on `revoked_at IS NULL` so it is a no-op if
   * anything invalidated the row in between -- the caller treats `false` as "lost the
   * race" rather than assuming its rotation happened.
   */
  async markRotated(id: number, replacedByHash: string, queryable?: Queryable): Promise<boolean> {
    const result = await this.q(queryable).query(
      `UPDATE refresh_tokens
          SET revoked_at = NOW(), revoked_reason = 'rotated', replaced_by_hash = $2
        WHERE id = $1 AND revoked_at IS NULL
        RETURNING id`,
      [id, replacedByHash]
    );
    return result.rows.length > 0;
  }

  /**
   * Locks whichever row is currently the family's live head.
   *
   * Used by the grace-window replay path: that caller is holding a token which has
   * already been rotated away, so rotating *it* would fork the lineage into two live
   * tokens. Rotating the head instead keeps the invariant this whole design rests on --
   * at most one live row per family, always.
   */
  async lockFamilyHead(
    familyId: string,
    queryable?: Queryable
  ): Promise<RefreshTokenRecord | null> {
    const result = await this.q(queryable).query<RefreshTokenRecord>(
      `SELECT * FROM refresh_tokens
        WHERE family_id = $1 AND revoked_at IS NULL
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE`,
      [familyId]
    );
    return result.rows[0] || null;
  }

  /** Revokes every still-live row in one session lineage. Returns how many it killed. */
  async revokeFamily(
    familyId: string,
    reason: RefreshRevocationReason,
    queryable?: Queryable
  ): Promise<number> {
    const result = await this.q(queryable).query(
      `UPDATE refresh_tokens
          SET revoked_at = NOW(), revoked_reason = $2
        WHERE family_id = $1 AND revoked_at IS NULL
        RETURNING id`,
      [familyId, reason]
    );
    return result.rows.length;
  }

  /** Revokes every still-live session a user has, across all their devices. */
  async revokeAllForUser(
    userId: number,
    reason: RefreshRevocationReason,
    queryable?: Queryable
  ): Promise<number> {
    const result = await this.q(queryable).query(
      `UPDATE refresh_tokens
          SET revoked_at = NOW(), revoked_reason = $2
        WHERE user_id = $1 AND revoked_at IS NULL
        RETURNING id`,
      [userId, reason]
    );
    return result.rows.length;
  }

  /**
   * Cleanup, keyed on expiry rather than on revocation.
   *
   * A revoked row is not dead weight: it is the evidence that lets a later presentation
   * of that token be recognised as reuse instead of as an unknown token. Deleting it
   * early would silently downgrade reuse detection to a plain 401 with no family
   * revocation. Past `expires_at` the JWT's own `exp` rejects the token before the
   * database is consulted at all, so the row has no remaining value.
   */
  async deleteExpiredRefreshTokens(queryable?: Queryable): Promise<number> {
    const result = await this.q(queryable).query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() RETURNING id'
    );
    return result.rows.length;
  }
}

export const authRepository = new AuthRepository();
