import { Queryable } from '../../database/transaction';
import pool from '../../database/pool';
import { UserRecord } from './types';

export interface IAuthRepository {
  findUserByEmail(email: string, queryable?: Queryable): Promise<UserRecord | null>;
  findUserById(id: number, queryable?: Queryable): Promise<UserRecord | null>;
  updateLastLogin(userId: number, queryable?: Queryable): Promise<void>;
  createRefreshToken(
    userId: number,
    token: string,
    expiresAt: string,
    queryable?: Queryable
  ): Promise<void>;
  findValidRefreshToken(token: string, queryable?: Queryable): Promise<Record<string, any> | null>;
  deleteRefreshToken(token: string, queryable?: Queryable): Promise<void>;
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

  async updateLastLogin(userId: number, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
  }

  async createRefreshToken(
    userId: number,
    token: string,
    expiresAt: string,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );
  }

  async findValidRefreshToken(
    token: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const result = await this.q(queryable).query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    return result.rows[0] || null;
  }

  async deleteRefreshToken(token: string, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
  }
}

export const authRepository = new AuthRepository();
