/**
 * Postponed features' writes, and stock reservations, are Admin-only.
 *
 * `POST /online-orders` used to take no token and hold stock for 48 hours, `POST /feedback`
 * took no token either, and any authenticated role -- Delivery included -- could hold or
 * release stock through `/reservations` or read an online order's customer details.
 *
 * Nothing else would notice a regression: `check:api-docs` compares endpoint sets and
 * request shapes, and endpoint-health picks its token from the manifest's own roles. So
 * these requests go over a real socket, through the real routers and the real auth
 * middleware, and every "nothing was written" claim is read back from the database.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from '../support/pgMem';
import { setPool, closePool } from '../../src/database/pool';
import { runMigrationsUp } from '../../src/database/migrate';
import { onlineOrdersService } from '../../src/modules/commerce/onlineOrders/service';
import { createTestApp } from '../verification/testApp';
import { getAdminToken, getCashierToken, getDeliveryToken } from '../verification/authHelpers';

const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');
const HOUR_MS = 60 * 60 * 1000;

const NON_ADMIN = [
  ['Cashier', getCashierToken()],
  ['Delivery', getDeliveryToken()],
] as const;

const order = {
  customer_name: 'Nadia',
  customer_phone: '01000000000',
  shipping_address: '12 Nile St',
  city: 'Cairo',
  items: [{ product_id: 1, quantity: 2, price: 500 }],
};

const feedback = { rating: 5, category: 'service', comment: 'Lovely fitting room' };

interface Reply {
  status: number;
  body: { data?: Record<string, unknown>; error?: unknown } | null;
}

let testPool: PgPool;
let server: Server;
let baseUrl: string;

async function call(method: string, url: string, token?: string, body?: unknown): Promise<Reply> {
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function count(table: string): Promise<number> {
  const { rows } = await testPool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return Number(rows[0].n);
}

async function seedReservation(sourceId: string): Promise<number> {
  const { rows } = await testPool.query(
    `INSERT INTO stock_reservations (product_id, quantity, source_type, source_id, expires_at)
     VALUES (1, 1, 'cart', $1, $2) RETURNING id`,
    [sourceId, new Date(Date.now() + HOUR_MS)]
  );
  return rows[0].id;
}

function expectUnauthorized(res: Reply) {
  expect(res.status).toBe(401);
  expect(res.body).toEqual({
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
  });
}

function expectForbidden(res: Reply) {
  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
}

beforeAll(async () => {
  testPool = createPgMemPool();
  setPool(testPool);
  await runMigrationsUp(testPool, MIGRATIONS_DIR);

  const app = createTestApp();
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
  await closePool();
});

beforeEach(async () => {
  await testPool.query('DELETE FROM stock_reservations');
  await testPool.query('DELETE FROM online_order_items');
  await testPool.query('DELETE FROM online_orders');
  await testPool.query('DELETE FROM customer_feedback');
  await testPool.query('DELETE FROM product_variants');
  await testPool.query('DELETE FROM products');
  await testPool.query('DELETE FROM customers');

  await testPool.query(
    `INSERT INTO products (id, name, sku, price, cost_price, stock)
     VALUES (1, 'Silk Dress', 'SKU-001', 500, 250, 5)`
  );
});

describe('POST /api/v1/online-orders', () => {
  it('refuses an anonymous caller before any stock is held or customer created', async () => {
    expectUnauthorized(await call('POST', '/api/v1/online-orders', undefined, order));

    expect(await count('stock_reservations')).toBe(0);
    expect(await count('customers')).toBe(0);
    expect(await count('online_orders')).toBe(0);
  });

  it.each(NON_ADMIN)('refuses a %s token and writes nothing', async (_role, token) => {
    expectForbidden(await call('POST', '/api/v1/online-orders', token, order));

    expect(await count('stock_reservations')).toBe(0);
    expect(await count('customers')).toBe(0);
    expect(await count('online_orders')).toBe(0);
  });

  it('lets an Admin place an order, which holds the stock for 48 hours', async () => {
    const res = await call('POST', '/api/v1/online-orders', getAdminToken(), order);

    expect(res.status).toBe(201);
    const { rows } = await testPool.query(
      'SELECT product_id, quantity, source_type, source_id, expires_at FROM stock_reservations'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      product_id: 1,
      quantity: 2,
      source_type: 'online_order',
      source_id: String(res.body?.data?.id),
    });
    const heldFor = new Date(rows[0].expires_at).getTime() - Date.now();
    expect(heldFor).toBeGreaterThan(47.9 * HOUR_MS);
    expect(heldFor).toBeLessThanOrEqual(48 * HOUR_MS);
  });
});

describe('POST /api/v1/feedback', () => {
  it('refuses an anonymous caller and stores no rating', async () => {
    expectUnauthorized(await call('POST', '/api/v1/feedback', undefined, feedback));

    expect(await count('customer_feedback')).toBe(0);
  });

  it.each(NON_ADMIN)('refuses a %s token and stores no rating', async (_role, token) => {
    expectForbidden(await call('POST', '/api/v1/feedback', token, feedback));

    expect(await count('customer_feedback')).toBe(0);
  });

  it('lets an Admin submit feedback', async () => {
    const res = await call('POST', '/api/v1/feedback', getAdminToken(), feedback);

    expect(res.status).toBe(201);
    expect(await count('customer_feedback')).toBe(1);
  });
});

describe('GET /api/v1/online-orders/:id', () => {
  let orderId: number;

  beforeEach(async () => {
    const created = await onlineOrdersService.createOrder({ ...order, shipping_fee: 0 });
    orderId = created.id;
  });

  it.each(NON_ADMIN)("refuses a %s token the customer's details", async (_role, token) => {
    expectForbidden(await call('GET', `/api/v1/online-orders/${orderId}`, token));
  });

  it('lets an Admin read the order', async () => {
    const res = await call('GET', `/api/v1/online-orders/${orderId}`, getAdminToken());

    expect(res.status).toBe(200);
    expect(res.body?.data).toMatchObject({ id: orderId, customer_phone: order.customer_phone });
  });
});

describe('GET /api/v1/online-orders', () => {
  it.each(NON_ADMIN)('refuses a %s token the order list', async (_role, token) => {
    expectForbidden(await call('GET', '/api/v1/online-orders', token));
  });

  it('lets an Admin list orders', async () => {
    const res = await call('GET', '/api/v1/online-orders', getAdminToken());

    expect(res.status).toBe(200);
  });
});

describe('PUT /api/v1/online-orders/:id/status', () => {
  let orderId: number;

  beforeEach(async () => {
    const created = await onlineOrdersService.createOrder({ ...order, shipping_fee: 0 });
    orderId = created.id;
  });

  it.each(NON_ADMIN)('refuses a %s token and leaves the status unchanged', async (_role, token) => {
    expectForbidden(
      await call('PUT', `/api/v1/online-orders/${orderId}/status`, token, { status: 'processing' })
    );

    const { rows } = await testPool.query('SELECT status FROM online_orders WHERE id = $1', [
      orderId,
    ]);
    expect(rows[0].status).toBe('pending');
  });

  it('lets an Admin update the status', async () => {
    const res = await call('PUT', `/api/v1/online-orders/${orderId}/status`, getAdminToken(), {
      status: 'processing',
    });

    expect(res.status).toBe(200);
    const { rows } = await testPool.query('SELECT status FROM online_orders WHERE id = $1', [
      orderId,
    ]);
    expect(rows[0].status).toBe('processing');
  });
});

describe('/api/v1/reservations', () => {
  const hold = { product_id: 1, quantity: 1, source_type: 'cart', source_id: 'cart-1' };

  it.each(NON_ADMIN)('refuses a %s token a new hold', async (_role, token) => {
    expectForbidden(await call('POST', '/api/v1/reservations', token, hold));

    expect(await count('stock_reservations')).toBe(0);
  });

  it.each(NON_ADMIN)('refuses a %s token the release of one hold', async (_role, token) => {
    const id = await seedReservation('cart-1');

    expectForbidden(await call('DELETE', `/api/v1/reservations/${id}`, token));

    const { rows } = await testPool.query('SELECT id FROM stock_reservations WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
  });

  it.each(NON_ADMIN)("refuses a %s token the release of a source's holds", async (_r, token) => {
    await seedReservation('cart-1');
    await seedReservation('cart-1');

    expectForbidden(await call('DELETE', '/api/v1/reservations/source/cart-1', token));

    expect(await count('stock_reservations')).toBe(2);
  });

  it('lets an Admin hold stock', async () => {
    const res = await call('POST', '/api/v1/reservations', getAdminToken(), hold);

    expect(res.status).toBe(201);
    const { rows } = await testPool.query('SELECT source_id, quantity FROM stock_reservations');
    expect(rows).toEqual([{ source_id: 'cart-1', quantity: 1 }]);
  });

  it('lets an Admin release one hold', async () => {
    const id = await seedReservation('cart-1');

    const res = await call('DELETE', `/api/v1/reservations/${id}`, getAdminToken());

    expect(res.status).toBe(204);
    expect(await count('stock_reservations')).toBe(0);
  });

  it("lets an Admin release a source's holds", async () => {
    await seedReservation('cart-1');
    await seedReservation('cart-1');

    const res = await call('DELETE', '/api/v1/reservations/source/cart-1', getAdminToken());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { released: 2 } });
    expect(await count('stock_reservations')).toBe(0);
  });
});
