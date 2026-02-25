import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, 'test-auth.db');
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

let testDb: InstanceType<typeof Database>;

beforeAll(async () => {
  // Clean up any leftover DB from previous runs
  for (const ext of ['', '-wal', '-shm']) {
    const f = TEST_DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  testDb = new Database(TEST_DB_PATH);
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');

  testDb.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Cashier',
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );
    CREATE TABLE refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  // Seed test users
  const adminHash = await bcrypt.hash('admin123', 10);
  testDb
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('Admin', 'admin@moon.com', adminHash, 'Admin');

  const cashierHash = await bcrypt.hash('cashier123', 10);
  testDb
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('Sarah', 'sarah@moon.com', cashierHash, 'Cashier');
});

afterAll(() => {
  testDb.close();
  for (const ext of ['', '-wal', '-shm']) {
    const f = TEST_DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
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
  it('should find user by email', () => {
    const user = testDb
      .prepare('SELECT * FROM users WHERE email = ?')
      .get('admin@moon.com') as Record<string, unknown>;
    expect(user).toBeDefined();
    expect(user.name).toBe('Admin');
    expect(user.role).toBe('Admin');
  });

  it('should return undefined for non-existent email', () => {
    const user = testDb.prepare('SELECT * FROM users WHERE email = ?').get('nobody@moon.com');
    expect(user).toBeUndefined();
  });

  it('should validate correct password', async () => {
    const user = testDb
      .prepare('SELECT * FROM users WHERE email = ?')
      .get('admin@moon.com') as Record<string, unknown>;
    expect(await bcrypt.compare('admin123', user.password_hash as string)).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const user = testDb
      .prepare('SELECT * FROM users WHERE email = ?')
      .get('admin@moon.com') as Record<string, unknown>;
    expect(await bcrypt.compare('wrongpass', user.password_hash as string)).toBe(false);
  });
});

describe('Auth - Refresh Token Storage', () => {
  it('should store and retrieve refresh tokens', () => {
    const token = jwt.sign({ id: 1 }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    testDb
      .prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(1, token, expiresAt);

    const stored = testDb
      .prepare("SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime('now')")
      .get(token) as Record<string, unknown>;

    expect(stored).toBeDefined();
    expect(stored.user_id).toBe(1);
  });

  it('should delete refresh token on logout', () => {
    const token = jwt.sign({ id: 2 }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    testDb
      .prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')
      .run(2, token, expiresAt);

    testDb.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);

    const stored = testDb.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token);
    expect(stored).toBeUndefined();
  });
});

describe('Auth - Role Checking', () => {
  it('should enforce Admin role correctly', () => {
    const user = testDb
      .prepare('SELECT role FROM users WHERE email = ?')
      .get('admin@moon.com') as Record<string, unknown>;
    expect(['Admin'].includes(user.role as string)).toBe(true);
  });

  it('should distinguish Cashier from Admin', () => {
    const user = testDb
      .prepare('SELECT role FROM users WHERE email = ?')
      .get('sarah@moon.com') as Record<string, unknown>;
    expect(user.role).toBe('Cashier');
    expect(['Admin'].includes(user.role as string)).toBe(false);
    expect(['Admin', 'Cashier'].includes(user.role as string)).toBe(true);
  });
});
