import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { IAuthRepository, authRepository as defaultRepo } from './repository';
import { LoginDTO, AuthTokens } from './types';
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

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET as string, {
      expiresIn: '7d',
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.repo.createRefreshToken(user.id, refreshToken, expiresAt);

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
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as {
        id: number;
      };
    } catch {
      throw new PublicError('UNAUTHORIZED', 'Invalid refresh token');
    }

    const tokenRecord = await this.repo.findValidRefreshToken(refreshToken);
    if (!tokenRecord) {
      throw new PublicError('UNAUTHORIZED', 'Refresh token expired or revoked');
    }

    const user = await this.repo.findUserById(decoded.id);
    if (!user) {
      throw new PublicError('UNAUTHORIZED', 'User not found');
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' }
    );

    return {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.repo.deleteRefreshToken(refreshToken);
    }
  }

  async getMe(userId: number): Promise<AuthTokens['user'] | null> {
    const user = await this.repo.findUserById(userId);
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}

export const authService = new AuthService();
