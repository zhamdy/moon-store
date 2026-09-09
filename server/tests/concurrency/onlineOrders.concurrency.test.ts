/**
 * Online orders against real PostgreSQL: the guarded stock write, transaction
 * atomicity, and the document-number retry (#125, #128).
 *
 * None of these can be shown on pg-mem. The oversell race needs two genuinely concurrent
 * connections and real MVCC; the rollback assertions need a ROLLBACK that actually undoes
 * writes (pg-mem accepts the statement and keeps the rows); and the number retry keys on
 * `err.constraint`, which pg-mem does not populate.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { OnlineOrdersRepository } from '../../src/modules/commerce/onlineOrders/repository';
import { OnlineOrdersService } from '../../src/modules/commerce/onlineOrders/service';

const order = (overrides: Record<string, unknown> = {}) => ({
  customer_name: 'Nadia',
  customer_phone: '01000000000',
  shipping_address: '12 Nile St',
  city: 'Cairo',
  items: [{ product_id: 1, quantity: 1, price: 500 }],
  shipping_fee: 0,
  ...overrides,
});

describeWithPostgres('online orders under concurrency (#125, #128)', () => {
  let harness: RealPostgresHarness;
  const repo = new OnlineOrdersRepository();
  const service = new OnlineOrdersService(repo);

  beforeAll(async () => {
    // Four connections: the oversell race runs three orders at once, each holding one.
    harness = await setupRealPostgres('online-orders-concurrency', { maxConnections: 6 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    await harness.pool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (1, 'Silk Dress', 'SKU-001', 500, 250, 1)`
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function stockOf(productId: number): Promise<number> {
    const { rows } = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return Number(rows[0].stock);
  }

  async function countRows(table: string): Promise<number> {
    const { rows } = await harness.pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${table}`
    );
    return rows[0].n;
  }

  it('lets exactly one of three concurrent orders take the last unit', async () => {
    const outcomes = await Promise.allSettled([
      service.createOrder(order()),
      service.createOrder(order()),
      service.createOrder(order()),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    for (const outcome of rejected) {
      expect((outcome as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' });
    }

    // Never negative, and never oversold: the guard is in the WHERE clause, so the two
    // losers' updates matched no row rather than reading a stale count.
    expect(await stockOf(1)).toBe(0);
    expect(await countRows('online_orders')).toBe(1);
  });

  it('rolls the order and its items back when a later line is out of stock', async () => {
    await harness.pool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (2, 'Cotton Shirt', 'SKU-002', 200, 100, 0)`
    );

    await expect(
      service.createOrder(
        order({
          items: [
            { product_id: 1, quantity: 1, price: 500 },
            { product_id: 2, quantity: 1, price: 200 },
          ],
        })
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    // The first line's deduction happened before the second line refused; only a real
    // rollback puts it back.
    expect(await stockOf(1)).toBe(1);
    expect(await countRows('online_orders')).toBe(0);
    expect(await countRows('online_order_items')).toBe(0);
  });

  /** Seeds an order that already owns `number`, so the next attempt at it collides. */
  async function occupyOrderNumber(number: string): Promise<void> {
    await harness.pool.query(
      `INSERT INTO online_orders (order_number, customer_name, customer_phone, shipping_address, city, subtotal, total)
       VALUES ($1, 'Someone', '0100', 'x', 'Cairo', 0, 0)`,
      [number]
    );
  }

  it('re-rolls a colliding order number instead of surfacing a 500 (#128)', async () => {
    await harness.pool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (3, 'Wool Coat', 'SKU-003', 900, 400, 10)`
    );

    // The first number is already taken. A generator that cannot see that -- which is
    // every random one -- must be allowed to try again.
    const taken = 'WEB-20260909-0001';
    await occupyOrderNumber(taken);

    const numbers = [taken, 'WEB-20260909-0002'];
    let calls = 0;
    const colliding = new OnlineOrdersService(repo, () => numbers[calls++] ?? 'WEB-FALLBACK');

    const created = await colliding.createOrder(
      order({ items: [{ product_id: 3, quantity: 1, price: 900 }] })
    );

    expect(created.order_number).toBe('WEB-20260909-0002');
    expect(calls).toBe(2);
    expect(await countRows('online_orders')).toBe(2);
  });

  it('gives up with a typed conflict, never a 500, when every number collides', async () => {
    await harness.pool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (4, 'Linen Shirt', 'SKU-004', 300, 100, 10)`
    );

    const taken = 'WEB-20260909-9999';
    await occupyOrderNumber(taken);

    const alwaysColliding = new OnlineOrdersService(repo, () => taken);

    await expect(
      alwaysColliding.createOrder(order({ items: [{ product_id: 4, quantity: 1, price: 300 }] }))
    ).rejects.toMatchObject({ name: 'PublicError', code: 'CONFLICT' });

    // The bounded retry gave up rather than spinning, and wrote nothing.
    expect(await countRows('online_orders')).toBe(1);
  });

  it('does not retry a unique violation on a different column of the same insert', async () => {
    // A retry loop that re-rolled on any 23505 would spin against, say, a duplicate
    // customer phone and then blame the order number for it.
    await harness.pool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (5, 'Silk Scarf', 'SKU-005', 150, 60, 10)`
    );
    await harness.pool.query(
      `CREATE UNIQUE INDEX online_orders_city_unique ON online_orders (city)`
    );
    await occupyOrderNumber('WEB-20260909-7777');

    let calls = 0;
    const service2 = new OnlineOrdersService(repo, () => {
      calls += 1;
      return `WEB-20260909-${8000 + calls}`;
    });

    // 'Cairo' is already taken by the seeded row, so this fails on the OTHER index.
    await expect(
      service2.createOrder(order({ items: [{ product_id: 5, quantity: 1, price: 150 }] }))
    ).rejects.toMatchObject({ code: '23505' });

    // Surfaced on the first attempt rather than re-rolled four more times.
    expect(calls).toBe(1);

    await harness.pool.query('DROP INDEX online_orders_city_unique');
  });
});
