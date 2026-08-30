import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { describeWithPostgres, setupRealPostgres, type RealPostgresHarness } from './realPostgres';

describeWithPostgres('real-PostgreSQL harness', () => {
  let harness: RealPostgresHarness;

  beforeAll(async () => {
    harness = await setupRealPostgres('harness-self-test');
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
  });

  it('applies every migration into an isolated schema and round-trips a query', async () => {
    const ping = await harness.pool.query<{ one: number }>('SELECT 1 AS one');
    expect(ping.rows[0].one).toBe(1);

    const { rows } = await harness.pool.query<{ tablename: string }>(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1',
      [harness.schema]
    );
    const tables = rows.map((r) => r.tablename);

    expect(tables).toEqual(expect.arrayContaining(['users', 'products', 'sales', 'sale_items']));
    expect(tables).toContain('_migrations');
  });

  it('records every migration file exactly once', async () => {
    const { rows } = await harness.pool.query<{ name: string; count: string }>(
      'SELECT name, COUNT(*) AS count FROM _migrations GROUP BY name'
    );

    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const row of rows) {
      expect(row.count).toBe('1');
    }
  });

  it('supports two genuinely concurrent transactions (proves this is not pg-mem)', async () => {
    const a = await harness.connect();
    const b = await harness.connect();

    try {
      await a.query('BEGIN');
      await b.query('BEGIN');

      await a.query(
        "INSERT INTO users (name, email, password_hash) VALUES ('A', 'a@moon.com', 'x')"
      );

      // B's snapshot cannot see A's uncommitted row.
      const beforeCommit = await b.query('SELECT COUNT(*)::int AS n FROM users');
      expect(beforeCommit.rows[0].n).toBe(0);

      await a.query('COMMIT');

      // READ COMMITTED takes a fresh snapshot per statement, so B sees it now.
      const afterCommit = await b.query('SELECT COUNT(*)::int AS n FROM users');
      expect(afterCommit.rows[0].n).toBe(1);

      await b.query('COMMIT');
    } finally {
      a.release();
      b.release();
    }
  });

  it('blocks a second writer on a locked row until the first transaction ends', async () => {
    await harness.pool.query(
      "INSERT INTO products (name, sku, price, stock) VALUES ('Lock target', 'LOCK-1', 10, 5)"
    );

    const a = await harness.connect();
    const b = await harness.connect();

    try {
      await a.query('BEGIN');
      await a.query("SELECT id FROM products WHERE sku = 'LOCK-1' FOR UPDATE");

      let bAcquired = false;
      await b.query('BEGIN');
      const bLock = b.query("SELECT id FROM products WHERE sku = 'LOCK-1' FOR UPDATE").then(() => {
        bAcquired = true;
      });

      // Give B a real chance to acquire the lock; it must not.
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(bAcquired).toBe(false);

      await a.query('COMMIT');
      await bLock;
      expect(bAcquired).toBe(true);

      await b.query('COMMIT');
    } finally {
      a.release();
      b.release();
    }
  });

  it('isolates one harness from another so parallel test files cannot cross-contaminate', async () => {
    const other = await setupRealPostgres('harness-isolation', { installAsAppPool: false });

    try {
      await harness.pool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ('Only here', 'here@moon.com', 'x')"
      );

      const mine = await harness.pool.query('SELECT COUNT(*)::int AS n FROM users');
      const theirs = await other.pool.query('SELECT COUNT(*)::int AS n FROM users');

      expect(mine.rows[0].n).toBe(1);
      expect(theirs.rows[0].n).toBe(0);
      expect(other.schema).not.toBe(harness.schema);
    } finally {
      await other.teardown();
    }
  });

  it('truncate empties tables and resets identity sequences', async () => {
    await harness.pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ('First', 'first@moon.com', 'x')"
    );
    await harness.truncate();
    const reinserted = await harness.pool.query<{ id: number }>(
      "INSERT INTO users (name, email, password_hash) VALUES ('Second', 'second@moon.com', 'x') RETURNING id"
    );

    expect(reinserted.rows[0].id).toBe(1);

    const migrations = await harness.pool.query('SELECT COUNT(*)::int AS n FROM _migrations');
    expect(migrations.rows[0].n).toBeGreaterThanOrEqual(3);
  });
});
