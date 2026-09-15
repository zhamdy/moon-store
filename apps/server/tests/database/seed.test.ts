import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pool as PgPool } from 'pg';
import path from 'path';
import { createPgMemPool } from '../support/pgMem';
import { runMigrationsUp } from '../../src/database/migrate';
import { seedDatabase } from '../../src/database/seed';

describe('PostgreSQL Seed System', () => {
  let memPool: PgPool;
  const migrationsDir = path.join(__dirname, '../../src/database/migrations');

  beforeEach(async () => {
    memPool = createPgMemPool();
    await runMigrationsUp(memPool, migrationsDir);
  });

  afterEach(async () => {
    await memPool.end();
  });

  it('should seed categories, users, products, customers, settings properly', async () => {
    await seedDatabase(memPool);

    const users = await memPool.query('SELECT * FROM users');
    expect(users.rows.length).toBe(3);

    const categories = await memPool.query('SELECT * FROM categories');
    expect(categories.rows.length).toBe(12);

    const products = await memPool.query('SELECT * FROM products');
    expect(products.rows.length).toBe(34);

    const customers = await memPool.query('SELECT * FROM customers');
    expect(customers.rows.length).toBe(15);

    const settings = await memPool.query('SELECT * FROM settings');
    // 14 store settings plus the four storefront policy placeholders.
    expect(settings.rows.length).toBe(18);
  });

  it('seeds placeholder policies that promise no area, return or exchange', async () => {
    await seedDatabase(memPool);

    const { rows } = await memPool.query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key IN ('delivery_policy', 'delivery_policy_en', 'returns_policy', 'returns_policy_en')`
    );
    expect(rows).toHaveLength(4);
    for (const { value } of rows) {
      expect(value).not.toMatch(/egypt|return|exchange|مصر|إرجاع|استبدال/i);
    }
  });

  it('should be idempotent and clear previous rows when re-seeded', async () => {
    await seedDatabase(memPool);
    await seedDatabase(memPool);

    const users = await memPool.query('SELECT * FROM users');
    expect(users.rows.length).toBe(3);
  });

  it('should refuse to run in production without FORCE_SEED', async () => {
    const orig = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.FORCE_SEED;
      await expect(seedDatabase(memPool)).rejects.toThrow(/blocked in production/);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });
});
