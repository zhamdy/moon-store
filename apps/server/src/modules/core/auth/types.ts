export interface UserRecord {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
  last_login?: string | null;
}

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

/**
 * Why a refresh token stopped being usable. Stored rather than inferred, because the
 * reason changes what a later presentation of the same token means: replaying a
 * `'rotated'` token moments after its successor was issued is an honest double-submit,
 * while replaying one revoked by a logout is not.
 */
export type RefreshRevocationReason = 'rotated' | 'logout' | 'reuse' | 'revoked_all';

export interface RefreshTokenRecord {
  id: number;
  user_id: number;
  /** SHA-256 hex digest of the token. The plaintext is never stored. */
  token_hash: string;
  /** Lineage shared by every rotation descending from one login. */
  family_id: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
  revoked_reason: RefreshRevocationReason | null;
  replaced_by_hash: string | null;
}
