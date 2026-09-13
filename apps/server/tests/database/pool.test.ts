import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import { Pool as PgPool } from 'pg';
import { setPool, closePool, query } from '../../src/database/pool';
import { getEnv, resetEnvCache } from '../../src/config/env';

describe('Database Pool & Config', () => {
  beforeEach(() => {
    resetEnvCache();
  });

  afterEach(async () => {
    await closePool();
  });

  it('should validate environment variables properly', () => {
    const env = getEnv();
    expect(env.PORT).toBeDefined();
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.JWT_REFRESH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('should reject invalid environment configuration', () => {
    const orig = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = 'short';
      resetEnvCache();
      expect(() => getEnv()).toThrow(/Environment validation failed/);
    } finally {
      process.env.JWT_SECRET = orig;
      resetEnvCache();
    }
  });

  it('should execute queries via pool wrapper using PostgreSQL adapter', async () => {
    const memDb = newDb();
    const { Pool } = memDb.adapters.createPg();
    const memPool = new Pool();

    setPool(memPool as unknown as PgPool);

    const result = await query('SELECT 1 as num');
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as { num: number }).num).toBe(1);
  });
});
