/**
 * The purchase-orders list projects the column the writer wrote (#129).
 *
 * `purchase_orders` carried both `total` and `total_amount` from migration 009. `create`
 * writes `total`; the list projected `total_amount`, which nothing writes. Every row came
 * back at that column's default, and the client's `accessorKey: 'total'` found no field
 * of that name at all -- so the Total column rendered `NaN EG` for every order.
 *
 * Migration 011 (#139) has since dropped `total_amount`, so the duplication that caused
 * this is gone from the schema as well as from the projection.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { PurchaseOrdersRepository } from '../src/modules/fulfillment/purchaseOrders/repository';
import { PurchaseOrdersService } from '../src/modules/fulfillment/purchaseOrders/service';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

const listFilters = {
  page: 1,
  pageSize: 25,
  sortBy: 'createdAt' as const,
  sortOrder: 'desc' as const,
};

describe('purchase orders list total (#129)', () => {
  let testPool: PgPool;
  const repo = new PurchaseOrdersRepository();
  const service = new PurchaseOrdersService(repo);

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM purchase_order_items');
    await testPool.query('DELETE FROM purchase_orders');
    await testPool.query('DELETE FROM products');
    await testPool.query('DELETE FROM distributors');
    await testPool.query('DELETE FROM users');

    await testPool.query(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (1, 'Admin', 'a@moon.com', 'x', 'Admin')"
    );
    await testPool.query("INSERT INTO distributors (id, name) VALUES (1, 'Acme Textiles')");
    await testPool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (1, 'Silk Dress', 'SKU-001', 500, 250, 10),
              (2, 'Cotton Shirt', 'SKU-002', 200, 100, 10)`
    );
  });

  it('returns the value the order was created with (#129 repro)', async () => {
    // 2 x 200 + 1 x 100 = 500.
    await service.create(
      {
        distributor_id: 1,
        items: [
          { product_id: 1, quantity: 2, cost_price: 200 },
          { product_id: 2, quantity: 1, cost_price: 100 },
        ],
      },
      1
    );

    const { rows } = await service.list(listFilters);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].total)).toBe(500);

    // Not the column nothing writes. It used to be read here to assert it was still at
    // its default; migration 011 (#139) dropped it, so the schema now guarantees what the
    // assertion used to check by hand.
    const stored = await testPool.query<{ total: string }>('SELECT total FROM purchase_orders');
    expect(Number(stored.rows[0].total)).toBe(500);

    await expect(testPool.query('SELECT total_amount FROM purchase_orders')).rejects.toThrow(
      /total_amount/
    );
  });

  it('renders a real number for an order with no items rather than nothing at all', async () => {
    await testPool.query(
      `INSERT INTO purchase_orders (po_number, distributor_id, total, created_by)
       VALUES ('PO-EMPTY', 1, 0, 1)`
    );

    const { rows } = await service.list(listFilters);
    expect(rows[0].total).toBeDefined();
    expect(Number(rows[0].total)).toBe(0);
    expect(Number.isNaN(Number(rows[0].total))).toBe(false);
  });

  it('agrees with the detail view for the same order', async () => {
    const created = await service.create(
      { distributor_id: 1, items: [{ product_id: 1, quantity: 3, cost_price: 150 }] },
      1
    );

    const { rows } = await service.list(listFilters);
    const detail = await service.findById(created.id);

    expect(Number(rows[0].total)).toBe(450);
    expect(Number(detail?.total)).toBe(450);
  });
});
