import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { describeWithPostgres, TEST_DATABASE_URL } from '../support/realPostgres';
import {
  ensureMigrationTable,
  runMigrationsDown,
  runMigrationsUp,
} from '../../src/database/migrate';
import production from './fixtures/production-schema-2026-09-05.json';

const dir = path.join(__dirname, '../../src/database/migrations');
const migration = '009_legacy_schema_alignment.sql';
const sql = fs.readFileSync(path.join(dir, migration), 'utf8');
// 010 narrows purchase_orders_status_check further than 009 does. Both files are
// idempotent on their own (DROP CONSTRAINT IF EXISTS / ADD CONSTRAINT), but replaying
// 009's raw text alone, after the tracked runner has already applied both, would widen
// the constraint back to 009's list and undo 010's narrowing -- so the idempotency check
// below replays both, in order, to land on the same final state the runner produced.
const nextMigration = '010_purchase_order_status_vocabulary.sql';
const nextSql = fs.readFileSync(path.join(dir, nextMigration), 'utf8');

describeWithPostgres('009 legacy production schema repair', () => {
  const prefix = `test_repair_${randomBytes(5).toString('hex')}`;
  const admin = new Pool({ connectionString: TEST_DATABASE_URL });
  const pools: Pool[] = [];
  const schemas: string[] = [];

  async function database(legacy: boolean): Promise<Pool> {
    const schema = `${prefix}_${pools.length}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    schemas.push(schema);
    const pool = new Pool({
      connectionString: TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    pools.push(pool);
    if (!legacy) {
      await runMigrationsUp(pool, dir);
      return pool;
    }
    // Exact exported column types/defaults/nullability, with serial primary keys.
    // The CSV does not contain constraints; representative legacy FKs/checks below
    // exercise the dangerous rename and insert paths without claiming a full dump.
    for (const table of new Set(production.map((r) => r.table_name))) {
      const columns = production
        .filter((r) => r.table_name === table)
        .map((r) => {
          if (r.column_default.startsWith('nextval('))
            return `"${r.column_name}" SERIAL PRIMARY KEY`;
          return `"${r.column_name}" ${r.data_type}${r.is_nullable === 'NO' ? ' NOT NULL' : ''}${r.column_default === 'NULL' ? '' : ` DEFAULT ${r.column_default}`}`;
        });
      await pool.query(`CREATE TABLE "${table}" (${columns.join(', ')})`);
    }
    await pool.query(`
      ALTER TABLE bundle_items ADD FOREIGN KEY (bundle_id) REFERENCES bundles(id);
      ALTER TABLE layaway_payments ADD FOREIGN KEY (layaway_id) REFERENCES layaway(id);
      ALTER TABLE purchase_order_items ADD FOREIGN KEY (po_order_id) REFERENCES purchase_orders(id);
      ALTER TABLE stock_count_items ADD FOREIGN KEY (stock_count_id) REFERENCES stock_counts(id);
      ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status IN ('pending','received','cancelled'));
      ALTER TABLE shifts ADD CONSTRAINT shifts_status_check CHECK (status IN ('active','completed'));
      ALTER TABLE warranty_claims ADD CONSTRAINT warranty_claims_status_check CHECK (status IN ('pending','approved','rejected','completed'));
    `);
    await ensureMigrationTable(pool);
    for (const name of fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql') && !f.includes('.down.') && f < migration)) {
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
    }
    return pool;
  }

  beforeAll(async () => {
    await admin.query('SELECT 1');
  });
  afterAll(async () => {
    await Promise.all(pools.map((p) => p.end()));
    for (const schema of schemas) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });

  it('reproduces the reported errors, upgrades all exported columns and preserves legacy records and FKs', async () => {
    const pool = await database(true);
    await expect(pool.query('SELECT favorites FROM users')).rejects.toMatchObject({
      code: '42703',
    });
    await expect(pool.query('SELECT * FROM product_bundles')).rejects.toMatchObject({
      code: '42P01',
    });
    await pool.query(`
      INSERT INTO users (id,name,email,password_hash,role) VALUES (21,'Migration test','migration@example.invalid','unused','Admin');
      INSERT INTO customers (id,name,phone) VALUES (31,'Migration customer','migration-test');
      INSERT INTO products (id,name,sku,price) VALUES (41,'Migration product','MIG-41',25);
      INSERT INTO bundles (id,name,sku,price) VALUES (51,'Legacy bundle','B-51',40);
      INSERT INTO bundle_items (bundle_id,product_id) VALUES (51,41);
      INSERT INTO layaway (id,customer_id,total_amount,deposit_amount,balance_remaining,items,expires_at)
      VALUES (61,31,50,10,40,'[{"product_id":41,"quantity":2,"unit_price":25}]','2030-01-01');
      INSERT INTO layaway_payments (layaway_id,amount,payment_method) VALUES (61,10,'Cash');
      INSERT INTO notifications (title,message,is_read) VALUES ('Legacy','Kept',1);
      INSERT INTO purchase_orders (id,po_number,total_cost) VALUES (71,'PO-71',75);
      INSERT INTO purchase_order_items (po_order_id,product_id,quantity,unit_cost) VALUES (71,41,3,25);
      INSERT INTO shifts (user_id,start_time) VALUES (21,'2026-01-01');
    `);
    // Only 001-008 were pre-marked applied, so this call also runs every migration after
    // 009 that exists today (010 narrows purchase_orders_status_check; 011 drops the two
    // duplicate value columns; 012 adds refund_items). This list is deliberately exact
    // rather than a length check -- a migration landing without anyone considering its
    // effect on the legacy upgrade path is the thing worth failing on.
    expect(await runMigrationsUp(pool, dir)).toEqual([
      migration,
      '010_purchase_order_status_vocabulary.sql',
      '011_retire_duplicate_value_columns.sql',
      '012_refund_items.sql',
      '013_customer_credit_ledger.sql',
    ]);
    expect(await runMigrationsUp(pool, dir)).toEqual([]);

    // Replaying the raw SQL is how this test proves 009 and 010 are re-runnable. 011 has
    // to come back off first -- and everything above it with it. 009 backfills
    // `product_bundles.bundle_price` from `price`, and 011 drops `price`, so replaying
    // 009 on top of 011 fails on a column the schema no longer has. That is inherent to
    // replaying an older migration after a newer one removes what it referenced -- the same shape as 009 re-adding its own wider CHECK
    // over 010's narrowed one -- and not a fault in either file.
    expect(await runMigrationsDown(3, pool, dir)).toEqual([
      '013_customer_credit_ledger.sql',
      '012_refund_items.sql',
      '011_retire_duplicate_value_columns.sql',
    ]);
    await pool.query(sql);
    await pool.query(nextSql);
    expect(await runMigrationsUp(pool, dir)).toEqual([
      '011_retire_duplicate_value_columns.sql',
      '012_refund_items.sql',
      '013_customer_credit_ledger.sql',
    ]);
    expect((await pool.query('SELECT favorites FROM users')).rows[0].favorites).toBe('[]');
    expect(
      (await pool.query('SELECT bundle_price FROM product_bundles WHERE id=51')).rows[0]
        .bundle_price
    ).toBe('40');
    expect(
      (await pool.query('SELECT remaining_balance FROM layaway_plans WHERE id=61')).rows[0]
        .remaining_balance
    ).toBe('40');
    expect(
      (await pool.query('SELECT quantity,price FROM layaway_items WHERE plan_id=61')).rows
    ).toEqual([{ quantity: 2, price: '25' }]);
    expect((await pool.query('SELECT plan_id FROM layaway_payments')).rows[0].plan_id).toBe(61);
    expect((await pool.query('SELECT read,user_id FROM notifications')).rows[0]).toEqual({
      read: 1,
      user_id: null,
    });
    expect((await pool.query('SELECT po_id,cost_price FROM purchase_order_items')).rows[0]).toEqual(
      { po_id: 71, cost_price: '25' }
    );
    await expect(
      pool.query('INSERT INTO bundle_items (bundle_id,product_id) VALUES (9999,41)')
    ).rejects.toMatchObject({ code: '23503' });
    await pool.query(`INSERT INTO product_bundles (name,bundle_price) VALUES ('New bundle',30);
      INSERT INTO shifts (user_id,status) VALUES (21,'on_break');
      INSERT INTO purchase_orders (po_number,status) VALUES ('NEW-PO','Sent');
      SELECT user_id FROM notifications WHERE read=0;
      SELECT contact_info FROM distributors;
      SELECT image_url,season,is_featured,status,updated_at FROM collections;
      SELECT rules_json FROM customer_segments;
      SELECT * FROM storefront_banners;`);
    const fresh = await database(false);
    const columns = `SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() ORDER BY table_name,column_name`;
    const actual = (await pool.query(columns)).rows;
    for (const expected of (await fresh.query(columns)).rows)
      expect(actual).toContainEqual(expected);
  });

  it('rolls back the entire repair on malformed legacy items', async () => {
    const pool = await database(true);
    await pool.query(`INSERT INTO layaway (customer_id,total_amount,deposit_amount,balance_remaining,items,expires_at)
      VALUES (1,10,1,9,'invalid JSON','2030-01-01')`);
    await expect(runMigrationsUp(pool, dir)).rejects.toMatchObject({ code: '22P02' });
    expect(
      (
        await pool.query(
          "SELECT to_regclass('layaway')::text AS old, to_regclass('layaway_plans')::text AS renamed"
        )
      ).rows[0]
    ).toEqual({ old: 'layaway', renamed: null });
    expect(
      (await pool.query('SELECT name FROM _migrations WHERE name=$1', [migration])).rows
    ).toHaveLength(0);
  });

  it('refuses ambiguous duplicate tables without discarding either copy', async () => {
    const pool = await database(true);
    await pool.query('CREATE TABLE product_bundles (id integer)');
    await expect(pool.query(sql)).rejects.toThrow('both bundles and product_bundles exist');
  });
});
