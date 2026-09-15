/**
 * The public catalog's abuse control (plan KD-5).
 *
 * Every storefront page is rendered on one Next server, so under the global per-IP limiter
 * all shoppers would share one budget. Catalog GET/HEAD are exempt from it and budgeted by
 * the catalog limiter instead: per IP, or one trusted bucket for a valid server token.
 *
 * The integration tests boot the real app. The catalog limiter lives at module scope in the
 * catalog router, so each test resets the module registry to get a fresh bucket, and
 * installs the pg-mem pool on the freshly imported pool module.
 */
import http from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'path';
import jwt from 'jsonwebtoken';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from '../support/pgMem';
import { runMigrationsUp } from '../../src/database/migrate';
import { resetEnvCache } from '../../src/config/env';
import {
  CATALOG_SERVER_BUCKET,
  catalogRateLimitKey,
  hasValidCatalogServerToken,
  isCartQuotePath,
  isRateLimitExempt,
  logCatalogRateLimitConfig,
} from '../../src/http/rateLimits';

const MIGRATIONS_DIR = path.join(__dirname, '../../src/database/migrations');
const TOKEN_A = 'a1'.repeat(32);
const TOKEN_B = 'b2'.repeat(32);

const ENV_KEYS = [
  'RATE_LIMIT_MAX',
  'CART_QUOTE_RATE_LIMIT_MAX',
  'CATALOG_RATE_LIMIT_MAX',
  'CATALOG_SERVER_RATE_LIMIT_MAX',
  'CATALOG_SERVER_TOKEN',
  'CATALOG_PUBLIC_ONLY',
  'NODE_ENV',
  'MEDIA_PUBLIC_BASE_URL',
] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    if (key !== 'NODE_ENV') delete process.env[key];
  }
  resetEnvCache();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  resetEnvCache();
  vi.restoreAllMocks();
});

describe('global limiter exemption', () => {
  it('exempts catalog GET and HEAD, case-insensitively, at the prefix boundary only', () => {
    for (const p of [
      '/api/v1/catalog',
      '/api/v1/catalog/',
      '/api/v1/catalog/products',
      '/API/V1/Catalog/products',
      '/api/v1/catalog/collections/evening',
    ]) {
      expect(isRateLimitExempt({ method: 'GET', path: p }), p).toBe(true);
      expect(isRateLimitExempt({ method: 'HEAD', path: p }), p).toBe(true);
      expect(isRateLimitExempt({ method: 'POST', path: p }), p).toBe(false);
    }
    for (const p of [
      '/api/v1/catalogue',
      '/api/v1/catalogs/x',
      '/x/api/v1/catalog',
      '/api/v1/products',
    ]) {
      expect(isRateLimitExempt({ method: 'GET', path: p }), p).toBe(false);
    }
  });

  // Deliberate change (plan 2026-09-15-001, CD-21): POST under the catalog prefix used to be
  // on the global budget without exception. Exactly the cart quote path now leaves it for
  // its own limiter; every other catalog POST still spends the global budget.
  it('exempts exactly the cart quote path, any method, and nothing beside it', () => {
    for (const p of [
      '/api/v1/catalog/cart/quote',
      '/api/v1/catalog/cart/quote/',
      '/API/V1/Catalog/Cart/Quote',
    ]) {
      expect(isCartQuotePath({ path: p }), p).toBe(true);
      expect(isRateLimitExempt({ method: 'POST', path: p }), p).toBe(true);
    }
    for (const p of [
      '/api/v1/catalog/cart',
      '/api/v1/catalog/cart/quotes',
      '/api/v1/catalog/cart/quote/x',
      '/api/v1/catalog/products',
      '/x/api/v1/catalog/cart/quote',
    ]) {
      expect(isCartQuotePath({ path: p }), p).toBe(false);
      expect(isRateLimitExempt({ method: 'POST', path: p }), p).toBe(false);
    }
  });
});

describe('catalog server token', () => {
  const req = (value?: string | string[], distinct = true) => {
    const values = value === undefined ? undefined : Array.isArray(value) ? value : [value];
    return {
      ip: '10.0.0.9',
      headers: {
        'x-catalog-server-token': Array.isArray(value) ? value.join(', ') : value,
      } as Record<string, string | undefined>,
      ...(distinct ? { headersDistinct: { 'x-catalog-server-token': values } } : {}),
    };
  };

  it('never matches when no token is configured', () => {
    expect(hasValidCatalogServerToken(req(TOKEN_A))).toBe(false);
    expect(catalogRateLimitKey(req(TOKEN_A))).toBe('ip:10.0.0.9');
  });

  it('matches any configured token, so rotation works', () => {
    process.env.CATALOG_SERVER_TOKEN = `${TOKEN_A},${TOKEN_B}`;
    resetEnvCache();
    expect(hasValidCatalogServerToken(req(TOKEN_A))).toBe(true);
    expect(hasValidCatalogServerToken(req(TOKEN_B))).toBe(true);
    expect(catalogRateLimitKey(req(TOKEN_B))).toBe(CATALOG_SERVER_BUCKET);
  });

  it('treats a wrong, wrong-length, empty, missing or repeated token as no token, without throwing', () => {
    process.env.CATALOG_SERVER_TOKEN = TOKEN_A;
    resetEnvCache();
    expect(hasValidCatalogServerToken(req('c3'.repeat(32)))).toBe(false);
    expect(hasValidCatalogServerToken(req('short'))).toBe(false);
    expect(hasValidCatalogServerToken(req('x'.repeat(10_000)))).toBe(false);
    expect(hasValidCatalogServerToken(req(''))).toBe(false);
    expect(hasValidCatalogServerToken(req(undefined))).toBe(false);
    expect(hasValidCatalogServerToken(req([TOKEN_A, TOKEN_A]))).toBe(false);
    expect(catalogRateLimitKey(req('short'))).toBe('ip:10.0.0.9');
  });

  it('warns at production boot only for the CATALOG_PUBLIC_ONLY opt-out without a token', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NODE_ENV = 'test';
    process.env.CATALOG_PUBLIC_ONLY = 'true';
    resetEnvCache();
    logCatalogRateLimitConfig();
    expect(warn).not.toHaveBeenCalled();

    process.env.NODE_ENV = 'production';
    resetEnvCache();
    logCatalogRateLimitConfig();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('CATALOG_SERVER_TOKEN');
    expect(String(warn.mock.calls[0]?.[0])).toContain('CATALOG_PUBLIC_ONLY=true');

    warn.mockClear();
    process.env.CATALOG_SERVER_TOKEN = TOKEN_A;
    resetEnvCache();
    logCatalogRateLimitConfig();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns that an unparseable catalog ceiling was ignored', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.CATALOG_RATE_LIMIT_MAX = 'lots';
    resetEnvCache();
    logCatalogRateLimitConfig();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/CATALOG_RATE_LIMIT_MAX.*ignored/);
  });
});

// Each test re-imports the whole app after `vi.resetModules()`, which alone can pass the 5s
// default. A timed-out test keeps sending requests, onto the next test's server.
describe('catalog limiter through the real app', { timeout: 60_000 }, () => {
  let pool: PgPool;
  let server: Server | null = null;
  let port = 0;

  beforeAll(async () => {
    pool = createPgMemPool();
    await runMigrationsUp(pool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await pool.end();
  });

  afterEach(async () => {
    if (server) {
      const s = server;
      await new Promise<void>((resolve, reject) => s.close((e) => (e ? reject(e) : resolve())));
      server = null;
    }
  });

  async function boot(): Promise<void> {
    vi.resetModules();
    const poolModule = await import('../../src/database/pool');
    poolModule.setPool(pool);
    const { createApp } = await import('../../src/app');
    const app = createApp();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    port = (server!.address() as AddressInfo).port;
  }

  function send(
    url: string,
    headers: Record<string, string | string[]> = {},
    method = 'GET',
    payload?: string
  ): Promise<{ status: number; cache: string | undefined; body: string }> {
    return new Promise((resolve, reject) => {
      const r = http.request(
        {
          host: '127.0.0.1',
          port,
          path: url,
          method,
          headers:
            payload === undefined
              ? headers
              : {
                  'content-type': 'application/json',
                  'content-length': String(Buffer.byteLength(payload)),
                  ...headers,
                },
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (body += c));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              cache: res.headers['cache-control'] as string | undefined,
              body,
            })
          );
        }
      );
      r.on('error', reject);
      if (payload !== undefined) r.write(payload);
      r.end();
    });
  }

  async function statuses(
    url: string,
    times: number,
    headers: Record<string, string | string[]> = {}
  ) {
    const out: number[] = [];
    for (let i = 0; i < times; i += 1) out.push((await send(url, headers)).status);
    return out;
  }

  it('limits anonymous catalog reads per IP without spending the global budget', async () => {
    process.env.CATALOG_RATE_LIMIT_MAX = '3';
    process.env.RATE_LIMIT_MAX = '5';
    resetEnvCache();
    await boot();

    expect(await statuses('/api/v1/catalog/categories', 3)).toEqual([200, 200, 200]);

    const limited = await send('/api/v1/catalog/categories');
    expect(limited.status).toBe(429);
    expect(limited.cache).toBe('no-store');
    expect(JSON.parse(limited.body)).toEqual({
      error: expect.objectContaining({ code: 'RATE_LIMITED' }),
    });

    // Uppercase and trailing-slash spellings reach the catalog bucket (already spent), and
    // none of these eight catalog requests touched the global budget of 5.
    expect((await send('/API/V1/Catalog/categories')).status).toBe(429);
    expect((await send('/api/v1/catalog/')).status).toBe(429);
    await statuses('/api/v1/catalog/products', 2);

    // A staff request is unaffected by catalog exhaustion.
    const token = jwt.sign(
      { id: 1, email: 'admin@moon.com', role: 'Admin', name: 'Admin' },
      process.env.JWT_SECRET as string
    );
    expect((await send('/api/v1/categories', { authorization: `Bearer ${token}` })).status).toBe(
      200
    );

    // The anonymous global bucket is still whole: a lookalike sibling prefix is NOT exempt,
    // so it spends exactly RATE_LIMIT_MAX before a 429.
    expect(await statuses('/api/v1/catalogue', 5)).toEqual([404, 404, 404, 404, 404]);
    expect((await send('/api/v1/catalogue')).status).toBe(429);
  });

  it('gives a valid server token its own bucket and ceiling', async () => {
    process.env.CATALOG_RATE_LIMIT_MAX = '2';
    process.env.CATALOG_SERVER_RATE_LIMIT_MAX = '6';
    process.env.CATALOG_SERVER_TOKEN = `${TOKEN_A},${TOKEN_B}`;
    resetEnvCache();
    await boot();

    const server = { 'x-catalog-server-token': TOKEN_A };
    expect(await statuses('/api/v1/catalog/categories', 5, server)).toEqual([
      200, 200, 200, 200, 200,
    ]);

    // The per-IP bucket is separate and still whole.
    expect(await statuses('/api/v1/catalog/categories', 2)).toEqual([200, 200]);
    expect((await send('/api/v1/catalog/categories')).status).toBe(429);

    // The rotation token shares the trusted bucket (6th request), then its ceiling applies.
    expect(
      (await send('/api/v1/catalog/categories', { 'x-catalog-server-token': TOKEN_B })).status
    ).toBe(200);
    expect((await send('/api/v1/catalog/categories', server)).status).toBe(429);
  });

  it('charges the cart quote to its own per-IP bucket only, and refuses before parsing', async () => {
    process.env.CART_QUOTE_RATE_LIMIT_MAX = '2';
    process.env.CATALOG_RATE_LIMIT_MAX = '2';
    process.env.RATE_LIMIT_MAX = '3';
    process.env.CATALOG_SERVER_TOKEN = TOKEN_A;
    resetEnvCache();
    await boot();

    const quote = JSON.stringify({ lines: [{ slug: 'any-piece', options: {}, quantity: 1 }] });
    const server = { 'x-catalog-server-token': TOKEN_A };
    const post = (headers: Record<string, string> = {}, payload = quote) =>
      send('/api/v1/catalog/cart/quote', headers, 'POST', payload);

    // A valid server token earns no bigger bucket: the ceiling of 2 applies to it too.
    expect((await post(server)).status).toBe(200);
    expect((await post()).status).toBe(200);
    const limited = await post(server);
    expect(limited.status).toBe(429);
    expect(limited.cache).toBe('no-store');
    expect(JSON.parse(limited.body)).toEqual({
      error: expect.objectContaining({ code: 'RATE_LIMITED' }),
    });

    // Refused before the body is read: malformed JSON over the limit is a 429, not a 400.
    expect((await post({}, '{"lines": [')).status).toBe(429);

    // Neither the catalog read bucket (2) nor the anonymous global bucket (3) was spent.
    expect(await statuses('/api/v1/catalog/categories', 2)).toEqual([200, 200]);
    expect((await send('/api/v1/catalog/categories')).status).toBe(429);
    expect(await statuses('/api/v1/catalogue', 3)).toEqual([404, 404, 404]);
    expect((await send('/api/v1/catalogue')).status).toBe(429);
  });

  it('treats a wrong, wrong-length or repeated token as anonymous, never a 500', async () => {
    process.env.CATALOG_RATE_LIMIT_MAX = '1';
    process.env.CATALOG_SERVER_RATE_LIMIT_MAX = '100';
    process.env.CATALOG_SERVER_TOKEN = TOKEN_A;
    resetEnvCache();
    await boot();

    expect(
      (await send('/api/v1/catalog/categories', { 'x-catalog-server-token': 'c3'.repeat(32) }))
        .status
    ).toBe(200);
    // The per-IP bucket (ceiling 1) is now spent by that "wrong token" request.
    expect(
      (await send('/api/v1/catalog/categories', { 'x-catalog-server-token': 'c3'.repeat(32) }))
        .status
    ).toBe(429);
    expect(
      (await send('/api/v1/catalog/categories', { 'x-catalog-server-token': 'nope' })).status
    ).toBe(429);
    expect(
      (await send('/api/v1/catalog/categories', { 'x-catalog-server-token': [TOKEN_A, TOKEN_A] }))
        .status
    ).toBe(429);
    // The genuine token still works: the trusted bucket was never touched.
    expect(
      (await send('/api/v1/catalog/categories', { 'x-catalog-server-token': TOKEN_A })).status
    ).toBe(200);
  });
});
