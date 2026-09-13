/**
 * Cashier access and gating (#172).
 *
 * `GET /customers` was Admin-only while `POST /` and `GET /:id/loyalty` already let a
 * Cashier through -- so a cashier could create a customer at checkout but not search for
 * one that already existed. `GET /shifts`, `GET /sales`, and the gift-card and store-credit
 * redeem routes had **no role check at all**, open to any authenticated role including
 * Delivery. The 2026-09-13 decision: open `GET /customers` to Cashier, and gate the four
 * unchecked routes to `requireRole('Admin', 'Cashier')`.
 *
 * Real socket, real router, real auth middleware -- the same shape as
 * `postponedWrites.test.ts` and `deliveryRoleAuth.test.ts`, since the manifest's claimed
 * roles are unverified and only the router's actual middleware chain counts.
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
  await testPool.query('DELETE FROM customers');
  await testPool.query('DELETE FROM shifts');
  await testPool.query('DELETE FROM sales');
  await testPool.query('DELETE FROM gift_cards');
});

describe('GET /api/v1/customers — now open to Cashier (search at checkout)', () => {
  it('admits Admin and Cashier, refuses Delivery', async () => {
    expect((await call('GET', '/api/v1/customers', getAdminToken())).status).toBeLessThan(400);
    expect((await call('GET', '/api/v1/customers', getCashierToken())).status).toBeLessThan(400);
    expectForbidden(await call('GET', '/api/v1/customers', getDeliveryToken()));
  });
});

describe('GET /api/v1/shifts — had no role check at all', () => {
  it('admits Admin and Cashier, refuses Delivery', async () => {
    expect((await call('GET', '/api/v1/shifts', getAdminToken())).status).toBeLessThan(400);
    expect((await call('GET', '/api/v1/shifts', getCashierToken())).status).toBeLessThan(400);
    expectForbidden(await call('GET', '/api/v1/shifts', getDeliveryToken()));
  });
});

describe('GET /api/v1/sales — had no role check at all', () => {
  it('admits Admin and Cashier, refuses Delivery', async () => {
    expect((await call('GET', '/api/v1/sales', getAdminToken())).status).toBeLessThan(400);
    expect((await call('GET', '/api/v1/sales', getCashierToken())).status).toBeLessThan(400);
    expectForbidden(await call('GET', '/api/v1/sales', getDeliveryToken()));
  });
});

describe('POST /api/v1/gift-cards/:code/redeem — had no role check at all', () => {
  it('refuses a Delivery token before touching a balance', async () => {
    expectForbidden(
      await call('POST', '/api/v1/gift-cards/GC-000/redeem', getDeliveryToken(), { amount: 10 })
    );
  });

  it('clears the role gate for Admin and Cashier', async () => {
    expect(
      (await call('POST', '/api/v1/gift-cards/GC-000/redeem', getAdminToken(), { amount: 10 }))
        .status
    ).not.toBe(403);
    expect(
      (await call('POST', '/api/v1/gift-cards/GC-000/redeem', getCashierToken(), { amount: 10 }))
        .status
    ).not.toBe(403);
  });
});

describe('POST /api/v1/store-credit/:id/redeem — had no role check at all', () => {
  it('refuses a Delivery token before touching a balance', async () => {
    expectForbidden(
      await call('POST', '/api/v1/store-credit/1/redeem', getDeliveryToken(), {
        amount: 10,
        sale_id: 1,
      })
    );
  });

  it('clears the role gate for Admin and Cashier', async () => {
    expect(
      (
        await call('POST', '/api/v1/store-credit/1/redeem', getAdminToken(), {
          amount: 10,
          sale_id: 1,
        })
      ).status
    ).not.toBe(403);
    expect(
      (
        await call('POST', '/api/v1/store-credit/1/redeem', getCashierToken(), {
          amount: 10,
          sale_id: 1,
        })
      ).status
    ).not.toBe(403);
  });
});
