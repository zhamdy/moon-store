import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import { Pool as PgPool } from 'pg';
import path from 'path';
import {
  runMigrationsUp,
  runMigrationsDown,
  getAppliedMigrations,
  ensureMigrationTable,
} from '../../src/database/migrate';

describe('PostgreSQL Migration Runner', () => {
  let memPool: PgPool;
  const migrationsDir = path.join(__dirname, '../../src/database/migrations');

  beforeEach(() => {
    const memDb = newDb({ noAstCoverageCheck: true });
    const { Pool } = memDb.adapters.createPg();
    memPool = new Pool() as unknown as PgPool;
  });

  afterEach(async () => {
    await memPool.end();
  });

  it('should initialize _migrations table if not exists', async () => {
    await ensureMigrationTable(memPool);
    const result = await memPool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_migrations'`
    );
    expect(result.rows).toHaveLength(1);
  });

  it('should run initial schema migration up successfully', async () => {
    const applied = await runMigrationsUp(memPool, migrationsDir);
    expect(applied).toContain('001_initial_schema.sql');

    const tables = await memPool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tableNames = tables.rows.map((r) => r.table_name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('products');
    expect(tableNames).toContain('sales');
    expect(tableNames).toContain('customers');

    const records = await getAppliedMigrations(memPool);
    expect(records).toEqual(['001_initial_schema.sql']);
  });

  it('should skip already applied migrations on subsequent run', async () => {
    await runMigrationsUp(memPool, migrationsDir);
    const secondRun = await runMigrationsUp(memPool, migrationsDir);
    expect(secondRun).toHaveLength(0);
  });

  it('should rollback migrations with down runner', async () => {
    await runMigrationsUp(memPool, migrationsDir);
    const rolledBack = await runMigrationsDown(1, memPool, migrationsDir);
    expect(rolledBack).toEqual(['001_initial_schema.sql']);

    const records = await getAppliedMigrations(memPool);
    expect(records).toHaveLength(0);
  });
});
