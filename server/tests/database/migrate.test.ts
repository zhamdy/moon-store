import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pool as PgPool } from 'pg';
import path from 'path';
import { createPgMemPool } from '../support/pgMem';
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
    memPool = createPgMemPool();
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
    expect(records).toEqual([
      '001_initial_schema.sql',
      '002_checkout_financial_contract.sql',
      '003_sale_calculation_snapshot.sql',
      '004_concurrency_and_idempotency.sql',
    ]);
  });

  it('should skip already applied migrations on subsequent run', async () => {
    await runMigrationsUp(memPool, migrationsDir);
    const secondRun = await runMigrationsUp(memPool, migrationsDir);
    expect(secondRun).toHaveLength(0);
  });

  it('should rollback migrations with down runner', async () => {
    await runMigrationsUp(memPool, migrationsDir);
    const rolledBack = await runMigrationsDown(4, memPool, migrationsDir);
    expect(rolledBack).toEqual([
      '004_concurrency_and_idempotency.sql',
      '003_sale_calculation_snapshot.sql',
      '002_checkout_financial_contract.sql',
      '001_initial_schema.sql',
    ]);

    const records = await getAppliedMigrations(memPool);
    expect(records).toHaveLength(0);
  });
});

describe('002_checkout_financial_contract: canonical loyalty settings migration', () => {
  let memPool: PgPool;
  const migrationsDir = path.join(__dirname, '../../src/database/migrations');

  beforeEach(() => {
    memPool = createPgMemPool();
  });

  afterEach(async () => {
    await memPool.end();
  });

  async function settingsMap(pool: PgPool): Promise<Record<string, string>> {
    const result = await pool.query<{ key: string; value: string }>(
      'SELECT key, value FROM settings'
    );
    return Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
  }

  it('applies 002 on top of an already-applied 001 (upgrade path)', async () => {
    const firstRun = await runMigrationsUp(memPool, migrationsDir);
    expect(firstRun).toEqual([
      '001_initial_schema.sql',
      '002_checkout_financial_contract.sql',
      '003_sale_calculation_snapshot.sql',
      '004_concurrency_and_idempotency.sql',
    ]);

    const applied = await getAppliedMigrations(memPool);
    expect(applied).toEqual([
      '001_initial_schema.sql',
      '002_checkout_financial_contract.sql',
      '003_sale_calculation_snapshot.sql',
      '004_concurrency_and_idempotency.sql',
    ]);
  });

  it('fresh database: resolves canonical loyalty settings with documented safe defaults', async () => {
    await runMigrationsUp(memPool, migrationsDir);

    const settings = await settingsMap(memPool);
    expect(settings.loyalty_enabled).toBe('false');
    expect(settings.loyalty_points_per_egp).toBe('1');
    expect(settings.loyalty_egp_per_point).toBe('0.1');
  });

  it('compatibility: only legacy alias keys exist -> their configured value is preserved under canonical keys', async () => {
    // Simulate a pre-canonicalization database: apply 001 alone, seed legacy
    // alias settings, then run the remaining migrations (002).
    await memPool.end();

    const upgradePool = createPgMemPool();

    const fs = await import('fs');
    const sql001 = fs.readFileSync(path.join(migrationsDir, '001_initial_schema.sql'), 'utf8');
    await upgradePool.query(sql001);
    await ensureMigrationTable(upgradePool);
    await upgradePool.query("INSERT INTO _migrations (name) VALUES ('001_initial_schema.sql')");

    await upgradePool.query(
      "INSERT INTO settings (key, value) VALUES ('loyalty_earn_rate', '3'), ('loyalty_redeem_value', '0.25')"
    );

    const applied = await runMigrationsUp(upgradePool, migrationsDir);
    expect(applied).toEqual([
      '002_checkout_financial_contract.sql',
      '003_sale_calculation_snapshot.sql',
      '004_concurrency_and_idempotency.sql',
    ]);

    const settings = await settingsMap(upgradePool);
    expect(settings.loyalty_points_per_egp).toBe('3');
    expect(settings.loyalty_egp_per_point).toBe('0.25');
    // Aliases are left in place for read-only compatibility; not deleted.
    expect(settings.loyalty_earn_rate).toBe('3');
    expect(settings.loyalty_redeem_value).toBe('0.25');

    await upgradePool.end();
  });

  it('precedence: canonical and alias both exist -> canonical value wins deterministically', async () => {
    await memPool.end();

    const upgradePool = createPgMemPool();

    const fs = await import('fs');
    const sql001 = fs.readFileSync(path.join(migrationsDir, '001_initial_schema.sql'), 'utf8');
    await upgradePool.query(sql001);
    await ensureMigrationTable(upgradePool);
    await upgradePool.query("INSERT INTO _migrations (name) VALUES ('001_initial_schema.sql')");

    await upgradePool.query(
      `INSERT INTO settings (key, value) VALUES
        ('loyalty_points_per_egp', '2'),
        ('loyalty_earn_rate', '999'),
        ('loyalty_egp_per_point', '0.1'),
        ('loyalty_redeem_value', '999')`
    );

    await runMigrationsUp(upgradePool, migrationsDir);

    const settings = await settingsMap(upgradePool);
    // The pre-existing canonical values must never be overwritten by the alias.
    expect(settings.loyalty_points_per_egp).toBe('2');
    expect(settings.loyalty_egp_per_point).toBe('0.1');

    await upgradePool.end();
  });

  it('down migration preserves a pre-existing canonical value (no destructive rollback)', async () => {
    await memPool.end();

    const upgradePool = createPgMemPool();

    const fs = await import('fs');
    const sql001 = fs.readFileSync(path.join(migrationsDir, '001_initial_schema.sql'), 'utf8');
    await upgradePool.query(sql001);
    await ensureMigrationTable(upgradePool);
    await upgradePool.query("INSERT INTO _migrations (name) VALUES ('001_initial_schema.sql')");
    await upgradePool.query(
      "INSERT INTO settings (key, value) VALUES ('loyalty_points_per_egp', '2'), ('loyalty_egp_per_point', '0.1'), ('loyalty_enabled', 'true')"
    );

    await runMigrationsUp(upgradePool, migrationsDir);
    // Roll back 004 and 003 (both unrelated to loyalty settings) down to and
    // including 002, to exercise 002's down migration specifically.
    const rolledBack = await runMigrationsDown(3, upgradePool, migrationsDir);
    expect(rolledBack).toEqual([
      '004_concurrency_and_idempotency.sql',
      '003_sale_calculation_snapshot.sql',
      '002_checkout_financial_contract.sql',
    ]);

    const settings = await settingsMap(upgradePool);
    expect(settings.loyalty_points_per_egp).toBe('2');
    expect(settings.loyalty_egp_per_point).toBe('0.1');
    expect(settings.loyalty_enabled).toBe('true');

    await upgradePool.end();
  });
});
