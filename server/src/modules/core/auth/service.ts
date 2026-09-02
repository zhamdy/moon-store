import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { IAuthRepository, authRepository as defaultRepo } from './repository';
import { LoginDTO, AuthTokens } from './types';
import { jwtConfig } from './config';
import { digestRefreshToken } from './tokens';
import { PublicError } from '../../../http/errors';

export class AuthService {
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

    const { accessSecret, refreshSecret, accessTtl, refreshTtl, refreshTtlMs } = jwtConfig();

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      accessSecret,
      { expiresIn: accessTtl }
    );

    // `jti` is what makes one login one session. Without it the payload is only the user
    // id plus `iat`/`exp` at one-second resolution, so two logins by the same user in the
    // same second sign byte-identical tokens: the second insert violates
    // `refresh_tokens.token_hash UNIQUE` (500 instead of a login), and a logout by either
    // session deletes the single row both were relying on.
    const refreshToken = jwt.sign({ id: user.id }, refreshSecret, {
      expiresIn: refreshTtl,
      jwtid: randomUUID(),
    });

    // A login starts a new session family. Every rotation of this token stays inside it,
    // so the whole lineage can be revoked as a unit later.
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + refreshTtlMs).toISOString();
    await this.repo.createRefreshToken(
      user.id,
      digestRefreshToken(refreshToken),
      familyId,
      expiresAt
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; user: AuthTokens['user'] }> {
    let decoded: { id: number };
    try {
      decoded = jwt.verify(refreshToken, jwtConfig().refreshSecret) as {
        id: number;
      };
    } catch {
      throw new PublicError('UNAUTHORIZED', 'Invalid refresh token');
    }

    // Lookup is by digest now: the plaintext is not in the database to compare against.
    const locked = await this.repo.lockRefreshTokenByHash(digestRefreshToken(refreshToken));
    if (!locked || locked.token.revoked_at || locked.token.expires_at <= locked.now) {
      throw new PublicError('UNAUTHORIZED', 'Refresh token expired or revoked');
    }

    const user = await this.repo.findUserById(decoded.id);
    if (!user) {
      throw new PublicError('UNAUTHORIZED', 'User not found');
    }

    const { accessSecret, accessTtl } = jwtConfig();
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      accessSecret,
      { expiresIn: accessTtl }
    );

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    const locked = await this.repo.lockRefreshTokenByHash(digestRefreshToken(refreshToken));
    if (!locked) return;

    // Logging out ends the session, not just the one token in hand: any token still live
    // in this lineage descends from the same login and must die with it.
    await this.repo.revokeFamily(locked.token.family_id, 'logout');
  }

  async getMe(userId: number): Promise<AuthTokens['user'] | null> {
    const user = await this.repo.findUserById(userId);
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}

export const authService = new AuthService();
