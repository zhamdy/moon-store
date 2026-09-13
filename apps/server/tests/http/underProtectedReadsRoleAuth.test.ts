/**
 * Four reads closed to Delivery (#162).
 *
 * `check:route-auth` found `GET /settings`, `GET /sales/:id`, `GET /exchanges` and
 * `GET /exchanges/:id` behind `verifyToken` alone, so any authenticated role, including
 * Delivery, could read sale, exchange and store settings data. The 2026-09-13 owner
 * decision: gate all four to `requireRole('Admin', 'Cashier')`. Cashier keeps `GET /settings`
 * because POS checkout reads tax and loyalty settings from it.
 *
 * Real socket, real router, real auth middleware -- the same shape as
 * `cashierRoleAuth.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

async function call(url: string, token?: string): Promise<Reply> {
  const res = await fetch(`${baseUrl}${url}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
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

// `/sales/1` and `/exchanges/1` may 404 on an empty database; what matters is that the
// role gate is cleared (not 401/403), and that Delivery is stopped before the handler.
const ROUTES = [
  '/api/v1/settings',
  '/api/v1/sales/1',
  '/api/v1/exchanges',
  '/api/v1/exchanges/1',
] as const;

describe.each(ROUTES)('GET %s — was token-only, now Admin + Cashier', (url) => {
  it('refuses a Delivery token with 403 FORBIDDEN', async () => {
    const res = await call(url, getDeliveryToken());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
    });
  });

  it('clears the role gate for Admin and Cashier', async () => {
    for (const token of [getAdminToken(), getCashierToken()]) {
      const res = await call(url, token);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.status).toBeLessThan(500);
    }
  });

  it('still refuses an anonymous caller with 401', async () => {
    expect((await call(url)).status).toBe(401);
  });
});

describe('the reads a Cashier depends on still succeed', () => {
  it('GET /settings and GET /exchanges return 200 for Cashier', async () => {
    expect((await call('/api/v1/settings', getCashierToken())).status).toBe(200);
    expect((await call('/api/v1/exchanges', getCashierToken())).status).toBe(200);
  });
});
