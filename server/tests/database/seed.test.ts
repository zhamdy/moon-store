import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import { Pool as PgPool } from 'pg';
import path from 'path';
import { runMigrationsUp } from '../../src/database/migrate';
import { seedDatabase } from '../../src/database/seed';

describe('PostgreSQL Seed System', () => {
  let memPool: PgPool;
  const migrationsDir = path.join(__dirname, '../../src/database/migrations');

  beforeEach(async () => {
    const memDb = newDb({ noAstCoverageCheck: true });
    const { Pool } = memDb.adapters.createPg();
    memPool = new Pool() as unknown as PgPool;
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
    expect(categories.rows.length).toBe(11);

    const products = await memPool.query('SELECT * FROM products');
    expect(products.rows.length).toBe(31);

    const customers = await memPool.query('SELECT * FROM customers');
    expect(customers.rows.length).toBe(15);

    const settings = await memPool.query('SELECT * FROM settings');
    expect(settings.rows.length).toBe(13);
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
