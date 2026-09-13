/**
 * Delivery role authorization (#172).
 *
 * The Delivery role used to be locked out of every one of its own module's routes --
 * `requireRole('Admin')` on `GET /` included, so a driver could not even list deliveries.
 * The 2026-09-13 decision: Delivery sees *every* delivery (no `driver_id` filtering, no
 * migration) and may update a delivery's status, since that is the one write a driver in
 * the field actually needs. Every other write stays Admin-only.
 *
 * These go over a real socket, through the real router and the real auth middleware, so a
 * regression here is caught the same way `postponedWrites.test.ts` catches one -- the
 * manifest's claimed roles are unverified, only the router's real middleware chain counts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from '../support/pgMem';
import { setPool, closePool } from '../../src/database/pool';
import { runMigrationsUp } from '../../src/database/migrate';
import { createTestApp } from '../verification/testApp';
import { getAdminToken, getCashierToken, getDeliveryToken } from '../verification/authHelpers';

const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');

interface Reply {
  status: number;
  body: { data?: unknown; error?: unknown } | null;
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
  await testPool.query('DELETE FROM delivery_status_history');
  await testPool.query('DELETE FROM delivery_orders');
  await testPool.query('DELETE FROM customers');
});

describe('reads: Admin and Delivery, Cashier refused', () => {
  it.each([
    ['GET', '/api/v1/delivery'],
    ['GET', '/api/v1/delivery/1/history'],
  ])('%s %s admits Admin and Delivery, refuses Cashier', async (method, url) => {
    expect((await call(method, url, getAdminToken())).status).toBeLessThan(400);
    expect((await call(method, url, getDeliveryToken())).status).toBeLessThan(400);
    expectForbidden(await call(method, url, getCashierToken()));
  });

  // pg-mem cannot run the analytics aggregate query this route issues (unrelated to
  // authorization), so only the role gate is asserted here -- Admin and Delivery reach the
  // (pg-mem-only) 500, Cashier never gets that far.
  it('GET /api/v1/delivery/analytics/performance clears the role gate for Admin and Delivery, refuses Cashier', async () => {
    expect(
      (await call('GET', '/api/v1/delivery/analytics/performance', getAdminToken())).status
    ).not.toBe(403);
    expect(
      (await call('GET', '/api/v1/delivery/analytics/performance', getDeliveryToken())).status
    ).not.toBe(403);
    expectForbidden(await call('GET', '/api/v1/delivery/analytics/performance', getCashierToken()));
  });
});

describe('GET /api/v1/delivery/:id', () => {
  it('admits Admin and Delivery, refuses Cashier (404 counts as admitted)', async () => {
    expect([200, 404]).toContain((await call('GET', '/api/v1/delivery/1', getAdminToken())).status);
    expect([200, 404]).toContain(
      (await call('GET', '/api/v1/delivery/1', getDeliveryToken())).status
    );
    expectForbidden(await call('GET', '/api/v1/delivery/1', getCashierToken()));
  });
});

describe('POST /api/v1/delivery — Admin-only write', () => {
  it.each([
    ['Cashier', getCashierToken()],
    ['Delivery', getDeliveryToken()],
  ])('refuses a %s token', async (_role, token) => {
    expectForbidden(
      await call('POST', '/api/v1/delivery', token, {
        customer_name: 'Nadia',
        phone: '01000000000',
        address: '12 Nile St',
        items: [],
      })
    );
  });
});

describe('PUT /api/v1/delivery/:id — Admin-only write', () => {
  it.each([
    ['Cashier', getCashierToken()],
    ['Delivery', getDeliveryToken()],
  ])('refuses a %s token', async (_role, token) => {
    expectForbidden(
      await call('PUT', '/api/v1/delivery/1', token, {
        customer_name: 'Nadia',
        phone: '01000000000',
        address: '12 Nile St',
        items: [],
      })
    );
  });
});

describe('PUT /api/v1/delivery/:id/status — a driver may update the delivery it is carrying', () => {
  it('admits Delivery and Admin, refuses Cashier', async () => {
    expect(
      (await call('PUT', '/api/v1/delivery/1/status', getAdminToken(), { status: 'delivered' }))
        .status
    ).toBeLessThan(500);
    expect(
      (await call('PUT', '/api/v1/delivery/1/status', getDeliveryToken(), { status: 'delivered' }))
        .status
    ).toBeLessThan(500);
    expectForbidden(
      await call('PUT', '/api/v1/delivery/1/status', getCashierToken(), { status: 'delivered' })
    );
  });
});
