import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool as PgPool } from 'pg';
import path from 'path';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { AuthController } from '../src/modules/core/auth/controller';
import { authService } from '../src/modules/core/auth/service';
import { PublicError } from '../src/http/errors';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

let testPool: PgPool;

beforeAll(async () => {
  testPool = createPgMemPool();
  setPool(testPool);

  const migrationsDir = path.join(__dirname, '../src/database/migrations');
  await runMigrationsUp(testPool, migrationsDir);

  // Seed test users
  const adminHash = await bcrypt.hash('admin123', 10);
  await testPool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    ['Admin', 'admin@moon.com', adminHash, 'Admin']
  );

  const cashierHash = await bcrypt.hash('cashier123', 10);
  await testPool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    ['Sarah', 'sarah@moon.com', cashierHash, 'Cashier']
  );
});

afterAll(async () => {
  await closePool();
});

describe('Auth - JWT Token Generation', () => {
  it('should hash passwords correctly with bcrypt', async () => {
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });

  it('should generate a valid access token', () => {
    const payload = { id: 1, email: 'admin@moon.com', name: 'Admin', role: 'Admin' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    expect(decoded.id).toBe(1);
    expect(decoded.email).toBe('admin@moon.com');
    expect(decoded.role).toBe('Admin');
  });

  it('should reject tokens signed with wrong secret', () => {
    const token = jwt.sign({ id: 1 }, 'wrong-secret', { expiresIn: '15m' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it('should reject expired tokens', () => {
    const token = jwt.sign({ id: 1 }, JWT_SECRET, { expiresIn: '0s' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(/expired/i);
  });

  it('should generate valid refresh tokens', () => {
    const token = jwt.sign({ id: 1 }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as Record<string, unknown>;
    expect(decoded.id).toBe(1);
  });
});

describe('Auth - User Lookup', () => {
  it('should find user by email using PostgreSQL parameterized query', async () => {
    const result = await testPool.query('SELECT * FROM users WHERE email = $1', ['admin@moon.com']);
    const user = result.rows[0];
    expect(user).toBeDefined();
    expect(user.name).toBe('Admin');
    expect(user.role).toBe('Admin');
  });

  it('should return empty for non-existent email', async () => {
    const result = await testPool.query('SELECT * FROM users WHERE email = $1', [
      'nobody@moon.com',
    ]);
    expect(result.rows).toHaveLength(0);
  });

  it('should validate correct password', async () => {
    const result = await testPool.query('SELECT * FROM users WHERE email = $1', ['admin@moon.com']);
    const user = result.rows[0];
    expect(await bcrypt.compare('admin123', user.password_hash as string)).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const result = await testPool.query('SELECT * FROM users WHERE email = $1', ['admin@moon.com']);
    const user = result.rows[0];
    expect(await bcrypt.compare('wrongpass', user.password_hash as string)).toBe(false);
  });
});

describe('Auth - Refresh Token Storage', () => {
  it('should store and retrieve refresh tokens in PostgreSQL', async () => {
    const token = jwt.sign({ id: 1 }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await testPool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [1, token, expiresAt]
    );

    const storedResult = await testPool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    expect(storedResult.rows).toHaveLength(1);
    expect(storedResult.rows[0].user_id).toBe(1);
  });

  it('should delete refresh token on logout', async () => {
    const token = jwt.sign({ id: 2 }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await testPool.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [2, token, expiresAt]
    );

    await testPool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);

    const storedResult = await testPool.query('SELECT * FROM refresh_tokens WHERE token = $1', [
      token,
    ]);
    expect(storedResult.rows).toHaveLength(0);
  });
});

/**
 * Regression cover for issue #62. The collision itself is a concurrency defect and its
 * real proof lives in `tests/concurrency/auth.concurrency.test.ts`; these cases pin the
 * claim that makes the fix work — one login is one session, even when the clock (which
 * `iat`/`exp` resolve to whole seconds) cannot tell two logins apart.
 */
describe('Auth - refresh tokens are unique per session', () => {
  // Frozen on a whole-second boundary at the current wall clock: freezing at a fixed
  // literal instead would date the stored `expires_at` against the database's own NOW().
  const sameSecond = new Date(Math.floor(Date.now() / 1000) * 1000);

  it('signs different refresh tokens for two logins in the same second', async () => {
    vi.setSystemTime(sameSecond);
    try {
      const first = await authService.login({ email: 'admin@moon.com', password: 'admin123' });
      const second = await authService.login({ email: 'admin@moon.com', password: 'admin123' });

      const firstClaims = jwt.verify(first.refreshToken, JWT_REFRESH_SECRET) as Record<
        string,
        unknown
      >;
      const secondClaims = jwt.verify(second.refreshToken, JWT_REFRESH_SECRET) as Record<
        string,
        unknown
      >;

      // Same user, same `iat` — the exact condition that used to produce equal tokens.
      expect(firstClaims.id).toBe(secondClaims.id);
      expect(firstClaims.iat).toBe(secondClaims.iat);

      expect(firstClaims.jti).toEqual(expect.any(String));
      expect(secondClaims.jti).not.toBe(firstClaims.jti);
      expect(second.refreshToken).not.toBe(first.refreshToken);
    } finally {
      vi.useRealTimers();
    }
  });

  it('logging out of one same-second session leaves the other usable', async () => {
    vi.setSystemTime(sameSecond);
    try {
      const till1 = await authService.login({ email: 'sarah@moon.com', password: 'cashier123' });
      const till2 = await authService.login({ email: 'sarah@moon.com', password: 'cashier123' });

      await authService.logout(till1.refreshToken);

      await expect(authService.refresh(till1.refreshToken)).rejects.toBeInstanceOf(PublicError);
      const refreshed = await authService.refresh(till2.refreshToken);
      expect(refreshed.user.email).toBe('sarah@moon.com');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Auth - Role Checking', () => {
  it('should enforce Admin role correctly', async () => {
    const result = await testPool.query('SELECT role FROM users WHERE email = $1', [
      'admin@moon.com',
    ]);
    const user = result.rows[0];
    expect(['Admin'].includes(user.role as string)).toBe(true);
  });

  it('should distinguish Cashier from Admin', async () => {
    const result = await testPool.query('SELECT role FROM users WHERE email = $1', [
      'sarah@moon.com',
    ]);
    const user = result.rows[0];
    expect(user.role).toBe('Cashier');
    expect(['Admin'].includes(user.role as string)).toBe(false);
    expect(['Admin', 'Cashier'].includes(user.role as string)).toBe(true);
  });
});

describe('Auth HTTP contract', () => {
  it('returns login data without the legacy success flag', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
    });
    const json = vi.fn();
    const cookie = vi.fn();
    const next = vi.fn();

    await new AuthController().login(
      {
        body: { email: 'admin@moon.com', password: 'admin123' },
        socket: {},
      } as Request,
      { json, cookie } as unknown as Response,
      next
    );

    expect(json).toHaveBeenCalledWith({
      data: {
        accessToken: 'access-token',
        user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards missing credentials as a standard public validation error', async () => {
    const next = vi.fn();

    await new AuthController().login({ body: {} } as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(PublicError));
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns refresh data without the legacy success flag', async () => {
    vi.spyOn(authService, 'refresh').mockResolvedValue({
      accessToken: 'new-access-token',
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
    });
    const json = vi.fn();
    const next = vi.fn();

    await new AuthController().refresh(
      { cookies: { refreshToken: 'refresh-token' } } as Request,
      { json } as unknown as Response,
      next
    );

    expect(json).toHaveBeenCalledWith({
      data: {
        accessToken: 'new-access-token',
        user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      },
    });
  });

  it('forwards a missing refresh token as a standard unauthorized error', async () => {
    const next = vi.fn();

    await new AuthController().refresh({ cookies: {} } as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(PublicError));
    expect(next.mock.calls[0][0]).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('clears the refresh cookie and returns 204 on logout', async () => {
    vi.spyOn(authService, 'logout').mockResolvedValue();
    const clearCookie = vi.fn();
    const sendStatus = vi.fn();

    await new AuthController().logout(
      { cookies: { refreshToken: 'refresh-token' } } as Request,
      { clearCookie, sendStatus } as unknown as Response,
      vi.fn()
    );

    expect(clearCookie).toHaveBeenCalledWith('refreshToken', { path: '/' });
    expect(sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns the current user in the canonical data envelope', async () => {
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      id: 1,
      name: 'Admin',
      email: 'admin@moon.com',
      role: 'Admin',
    });
    const json = vi.fn();

    await new AuthController().getMe(
      { user: { id: 1 } } as unknown as Request,
      { json } as unknown as Response,
      vi.fn()
    );

    expect(json).toHaveBeenCalledWith({
      data: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
    });
  });
});
