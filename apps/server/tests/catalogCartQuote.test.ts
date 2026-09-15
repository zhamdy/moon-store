/**
 * Public cart quote (plan 2026-09-15-001, Unit 1).
 *
 * Through the real app (`createApp()`), anonymous, so the quote path's own edge chain (CORS,
 * limiter, 16kb parser), the strict body contract, the `no-store` placement ahead of
 * `publicCacheOnSuccess` and the whitelist mapper are all on the path -- the `bundle_id`
 * lesson: a rule proven only below the boundary is not proven. NUMERIC-as-string is proven
 * in `tests/concurrency/catalogCartQuote.realpg.test.ts`; the limiter buckets in
 * `tests/http/catalogRateLimit.test.ts`.
 */
import http from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { closePool, setPool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { createApp } from '../src/app';
import { resetEnvCache } from '../src/config/env';
import { catalogRepository } from '../src/modules/commerce/catalog/repository';
import { catalogService } from '../src/modules/commerce/catalog/service';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');
const QUOTE = '/api/v1/catalog/cart/quote';
const STOREFRONT = 'https://shop.example.com';
const DASHBOARD = 'http://localhost:5173';

const ENV_KEYS = [
  'MEDIA_PUBLIC_BASE_URL',
  'CART_QUOTE_RATE_LIMIT_MAX',
  'CATALOG_RATE_LIMIT_MAX',
  'STOREFRONT_ORIGINS',
  'ALLOWED_ORIGINS',
] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

const QUOTE_KEYS = ['itemCount', 'lines', 'maxLineQuantity', 'subtotal'];
const LINE_KEYS = [
  'index',
  'lineTotal',
  'maxQuantity',
  'options',
  'product',
  'quantity',
  'requestedQuantity',
  'slug',
  'status',
  'unitPrice',
];
const PRODUCT_KEYS = ['image', 'name', 'nameEn', 'slug'];
const OPTION_KEYS = ['key', 'label', 'value'];
const FORBIDDEN_KEYS = [
  'id',
  'sku',
  'barcode',
  'stock',
  'cost_price',
  'costPrice',
  'product_id',
  'productId',
  'min_stock',
  'price',
  'status_code',
  'has_variants',
];

type Json = Record<string, unknown>;
interface Line {
  slug: string;
  options: Record<string, string>;
  quantity: number;
}
interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
  body: { data: Json & { lines: Json[] }; error: Json };
}

function allKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, into);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      into.add(key);
      allKeys(child, into);
    }
  }
  return into;
}

describe('POST /api/v1/catalog/cart/quote', () => {
  let pool: PgPool;
  let server: Server;
  let port: number;

  function send(
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<Reply> {
    const payload =
      body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: url,
          method,
          headers: {
            ...(payload !== undefined
              ? {
                  'content-type': 'application/json',
                  'content-length': String(Buffer.byteLength(payload)),
                }
              : {}),
            ...headers,
          },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (text += chunk));
          res.on('end', () => {
            let parsed: Reply['body'];
            try {
              parsed = text ? JSON.parse(text) : (null as never);
            } catch {
              parsed = null as never;
            }
            resolve({ status: res.statusCode ?? 0, headers: res.headers, text, body: parsed });
          });
        }
      );
      req.on('error', reject);
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  }

  const quote = (lines: unknown, extra: Json = {}) => send('POST', QUOTE, { lines, ...extra });
  const line = (slug: string, options: Record<string, string>, quantity: number): Line => ({
    slug,
    options,
    quantity,
  });

  beforeAll(async () => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://media.example.com/uploads';
    process.env.CART_QUOTE_RATE_LIMIT_MAX = '100000';
    process.env.CATALOG_RATE_LIMIT_MAX = '100000';
    process.env.STOREFRONT_ORIGINS = `${STOREFRONT}, https://www.shop.example.com`;
    delete process.env.ALLOWED_ORIGINS;
    resetEnvCache();

    pool = createPgMemPool();
    setPool(pool);
    await runMigrationsUp(pool, MIGRATIONS_DIR);

    const product = (
      id: number,
      slug: string,
      price: number,
      stock: number,
      hasVariants: 0 | 1,
      status: string,
      imageUrl: string | null = null
    ) =>
      pool.query(
        `INSERT INTO products (id, name, name_en, sku, barcode, slug, price, cost_price, stock,
                               min_stock, has_variants, status, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, 3, $9, $10, $11)`,
        [
          id,
          `اسم-${id}`,
          `English ${id}`,
          `SKU-SECRET-${id}`,
          `BARCODE-${id}`,
          slug,
          price,
          stock,
          hasVariants,
          status,
          imageUrl,
        ]
      );

    await product(1, 'plain-tote', 1000, 5, 0, 'active', '/uploads/products/tote.jpg');
    await product(2, 'silk-midi', 2850, 0, 1, 'active');
    await product(3, 'bad-variants', 500, 9, 1, 'active');
    await product(4, 'sold-variants', 700, 7, 1, 'active');
    await product(5, 'hidden-coat', 900, 5, 0, 'inactive');
    await product(6, 'gone-bag', 1200, 5, 0, 'discontinued');
    await product(7, 'bulk-scarf', 100, 250, 0, 'active');
    await product(8, 'many-socks', 50, 12, 0, 'active');

    await pool.query(
      `INSERT INTO product_variants (id, product_id, sku, stock, price, attributes) VALUES
         (1, 2, 'V-M', 12, 3100, '{"size":"M"}'),
         (2, 2, 'V-S', 2, NULL, '{"size":"S"}'),
         (3, 2, 'V-L', 0, NULL, '{"size":"L"}'),
         (4, 2, 'V-XL', 4, NULL, '{"size":"XL"}'),
         (5, 3, 'V-BAD-1', 4, NULL, 'not json'),
         (6, 3, 'V-BAD-2', 4, NULL, '["S"]'),
         (7, 4, 'V-SO-S', 0, NULL, '{"size":"S"}'),
         (8, 4, 'V-SO-M', 0, NULL, '{"size":"M"}')`
    );

    const app = createApp();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    port = (server.address() as AddressInfo).port;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve()))
      );
    }
    await closePool();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    resetEnvCache();
  });

  describe('pricing and availability', () => {
    it('quotes a no-variant product: ok, product price, line total, summary', async () => {
      const r = await quote([line('plain-tote', {}, 2)]);
      expect(r.status).toBe(200);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.body.data).toEqual({
        lines: [
          {
            index: 0,
            slug: 'plain-tote',
            status: 'ok',
            product: {
              slug: 'plain-tote',
              name: 'اسم-1',
              nameEn: 'English 1',
              image: { url: 'https://media.example.com/uploads/products/tote.jpg' },
            },
            options: [],
            unitPrice: 1000,
            requestedQuantity: 2,
            quantity: 2,
            maxQuantity: 5,
            lineTotal: 2000,
          },
        ],
        subtotal: 2000,
        itemCount: 2,
        maxLineQuantity: 10,
      });
    });

    it("uses a variant's own price when it has one", async () => {
      const r = await quote([line('silk-midi', { size: 'M' }, 1)]);
      expect(r.body.data.lines[0]).toMatchObject({
        status: 'ok',
        unitPrice: 3100,
        lineTotal: 3100,
      });
    });

    it('prices a NULL-price variant at the product price, never 0', async () => {
      const r = await quote([line('silk-midi', { size: 'S' }, 2)]);
      expect(r.body.data.lines[0]).toMatchObject({
        status: 'ok',
        unitPrice: 2850,
        quantity: 2,
        lineTotal: 5700,
      });
      expect(r.body.data.subtotal).toBe(5700);
    });

    it('matches options after normalization and returns the canonical spelling', async () => {
      const r = await quote([line('silk-midi', { Size: ' m ' }, 1)]);
      expect(r.body.data.lines[0]).toMatchObject({
        status: 'ok',
        options: [{ key: 'size', label: 'size', value: 'M' }],
      });
    });

    it('caps maxQuantity at 10 so stock above it stays hidden', async () => {
      const r = await quote([line('silk-midi', { size: 'M' }, 10)]);
      expect(r.body.data.lines[0]).toMatchObject({ status: 'ok', quantity: 10, maxQuantity: 10 });
      expect(r.text).not.toContain('12');
    });

    it('reduces a line to the stock left when stock is below the request', async () => {
      const r = await quote([line('silk-midi', { size: 'S' }, 4)]);
      expect(r.body.data.lines[0]).toMatchObject({
        status: 'reduced',
        requestedQuantity: 4,
        quantity: 2,
        maxQuantity: 2,
        lineTotal: 5700,
      });
      expect(r.body.data.itemCount).toBe(2);
    });

    it('marks a zero-stock variant sold out, priced but excluded from the subtotal', async () => {
      const r = await quote([line('silk-midi', { size: 'L' }, 1), line('plain-tote', {}, 1)]);
      expect(r.body.data.lines[0]).toMatchObject({
        status: 'soldOut',
        unitPrice: 2850,
        requestedQuantity: 1,
        quantity: 0,
        maxQuantity: 0,
        lineTotal: 0,
      });
      expect(r.body.data.subtotal).toBe(1000);
      expect(r.body.data.itemCount).toBe(1);
    });

    it('evaluates lines naming the same variant independently, never cumulatively', async () => {
      const r = await quote([
        line('silk-midi', { size: 'XL' }, 3),
        line('silk-midi', { size: 'xl' }, 3),
      ]);
      for (const l of r.body.data.lines) {
        expect(l).toMatchObject({ status: 'ok', quantity: 3, maxQuantity: 4 });
      }
      expect(r.body.data.subtotal).toBe(6 * 2850);
    });

    it('never discloses more than 10 even across 30 lines on one variant', async () => {
      const r = await quote(Array.from({ length: 30 }, () => line('bulk-scarf', {}, 10)));
      expect(r.status).toBe(200);
      expect(r.body.data.lines).toHaveLength(30);
      for (const l of r.body.data.lines) {
        expect(l).toMatchObject({ status: 'ok', quantity: 10, maxQuantity: 10 });
        for (const key of ['quantity', 'maxQuantity', 'requestedQuantity']) {
          expect(l[key] as number).toBeLessThanOrEqual(10);
        }
      }
      expect(r.body.data.maxLineQuantity).toBe(10);
      expect(r.text).not.toContain('250');
    });

    it('answers inactive, discontinued and unknown products identically', async () => {
      const r = await quote([
        line('hidden-coat', {}, 1),
        line('gone-bag', {}, 1),
        line('never-existed', {}, 1),
      ]);
      expect(r.status).toBe(200);
      const [inactive, discontinued, unknown] = r.body.data.lines;
      expect(inactive).toEqual({
        index: 0,
        slug: 'hidden-coat',
        status: 'productUnavailable',
        product: null,
        options: [],
        unitPrice: null,
        requestedQuantity: 1,
        quantity: 0,
        maxQuantity: 0,
        lineTotal: 0,
      });
      const strip = (l: Json) => JSON.stringify({ ...l, index: 0, slug: '' });
      expect(strip(discontinued)).toBe(strip(inactive));
      expect(strip(unknown)).toBe(strip(inactive));
      expect(r.body.data.subtotal).toBe(0);
    });

    it('marks unusable, unexpected and missing options variantUnavailable', async () => {
      const r = await quote([
        line('bad-variants', { size: 'S' }, 1),
        line('plain-tote', { size: 'M' }, 1),
        line('silk-midi', {}, 1),
        line('silk-midi', { size: 'XXS' }, 1),
        line('silk-midi', { size: 'M', color: 'Red' }, 1),
      ]);
      for (const l of r.body.data.lines) {
        expect(l).toMatchObject({
          status: 'variantUnavailable',
          options: [],
          unitPrice: null,
          quantity: 0,
          maxQuantity: 0,
          lineTotal: 0,
        });
        expect(l.product).not.toBeNull();
      }
    });

    it('lets variant stock win over a positive product stock', async () => {
      const r = await quote([line('sold-variants', { size: 'M' }, 1)]);
      expect(r.body.data.lines[0]).toMatchObject({ status: 'soldOut', unitPrice: 700 });
    });
  });

  describe('response whitelist', () => {
    it('pins every key set and leaks no internal column anywhere', async () => {
      const r = await quote([
        line('plain-tote', {}, 1),
        line('silk-midi', { size: 'S' }, 1),
        line('gone-bag', {}, 1),
        line('many-socks', {}, 3),
      ]);
      expect(Object.keys(r.body.data).sort()).toEqual(QUOTE_KEYS);
      for (const l of r.body.data.lines) {
        expect(Object.keys(l).sort()).toEqual(LINE_KEYS);
        if (l.product) expect(Object.keys(l.product as Json).sort()).toEqual(PRODUCT_KEYS);
        for (const o of l.options as Json[]) expect(Object.keys(o).sort()).toEqual(OPTION_KEYS);
      }
      const keys = allKeys(r.body);
      for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden), forbidden).toBe(false);
      expect(r.text).not.toContain('SKU-SECRET');
      expect(r.text).not.toContain('BARCODE');
    });
  });

  describe('request contract', () => {
    it.each([
      ['price on a line', { lines: [{ slug: 'plain-tote', options: {}, quantity: 1, price: 1 }] }],
      ['price at the root', { lines: [line('plain-tote', {}, 1)], price: 1 }],
      ['quantity 0', { lines: [line('plain-tote', {}, 0)] }],
      ['quantity -1', { lines: [line('plain-tote', {}, -1)] }],
      ['quantity 1.5', { lines: [line('plain-tote', {}, 1.5)] }],
      ['quantity "2"', { lines: [{ slug: 'plain-tote', options: {}, quantity: '2' }] }],
      ['quantity 11', { lines: [line('plain-tote', {}, 11)] }],
      ['quantity 1e3', '{"lines":[{"slug":"plain-tote","options":{},"quantity":1e3}]}'],
      ['31 lines', { lines: Array.from({ length: 31 }, () => line('plain-tote', {}, 1)) }],
      ['empty lines', { lines: [] }],
      ['no lines', {}],
      ['a 61-character option value', { lines: [line('silk-midi', { size: 'x'.repeat(61) }, 1)] }],
      ['a 41-character option key', { lines: [line('silk-midi', { ['k'.repeat(41)]: 'M' }, 1)] }],
      [
        'six options',
        { lines: [line('silk-midi', { a: '1', b: '2', c: '3', d: '4', e: '5', f: '6' }, 1)] },
      ],
      [
        'a non-string option value',
        { lines: [{ slug: 'silk-midi', options: { size: 1 }, quantity: 1 }] },
      ],
      ['a malformed slug', { lines: [line('Silk Midi', {}, 1)] }],
      ['missing options', { lines: [{ slug: 'plain-tote', quantity: 1 }] }],
    ])('rejects %s with 400 VALIDATION_ERROR and no-store', async (_label, body) => {
      const spy = vi.spyOn(catalogService, 'quoteCart');
      const r = await send('POST', QUOTE, body);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
      expect(r.headers['cache-control']).toBe('no-store');
      expect(spy).not.toHaveBeenCalled();
    });

    it('rejects malformed JSON with 400, not 500', async () => {
      const r = await send('POST', QUOTE, '{"lines": [');
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
      expect(r.headers['cache-control']).toBe('no-store');
    });

    it('refuses a 20 KB body with 413 before the service runs', async () => {
      const spy = vi.spyOn(catalogService, 'quoteCart');
      const r = await send('POST', QUOTE, {
        lines: [line('plain-tote', { note: 'x'.repeat(20_000) }, 1)],
      });
      expect(r.status).toBe(413);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(spy).not.toHaveBeenCalled();
    });

    it('answers GET on the quote path with 404 no-store', async () => {
      const r = await send('GET', QUOTE);
      expect(r.status).toBe(404);
      expect(r.headers['cache-control']).toBe('no-store');
    });

    it('maps a statement timeout to 503 SERVICE_UNAVAILABLE with no-store', async () => {
      vi.spyOn(catalogRepository, 'findPublicProductsBySlugs').mockRejectedValue(
        Object.assign(new Error('canceling statement due to statement timeout'), {
          code: '57014',
        })
      );
      const r = await quote([line('plain-tote', {}, 1)]);
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(r.headers['cache-control']).toBe('no-store');
    });
  });

  describe('CORS', () => {
    it('allows the storefront origin on the quote preflight and POST, without credentials', async () => {
      const preflight = await send('OPTIONS', QUOTE, undefined, {
        origin: STOREFRONT,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(STOREFRONT);
      expect(preflight.headers['access-control-allow-credentials']).toBeUndefined();
      expect(String(preflight.headers['access-control-allow-methods'])).toContain('POST');

      const post = await send(
        'POST',
        QUOTE,
        { lines: [line('plain-tote', {}, 1)] },
        {
          origin: STOREFRONT,
        }
      );
      expect(post.status).toBe(200);
      expect(post.headers['access-control-allow-origin']).toBe(STOREFRONT);
      expect(post.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('gives the storefront origin no CORS allowance on any other route', async () => {
      const r = await send('POST', '/api/v1/auth/refresh', {}, { origin: STOREFRONT });
      expect(r.headers['access-control-allow-origin']).toBeUndefined();
      expect(r.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('does not allow a dashboard origin on the quote path', async () => {
      const preflight = await send('OPTIONS', QUOTE, undefined, {
        origin: DASHBOARD,
        'access-control-request-method': 'POST',
      });
      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
      const post = await send(
        'POST',
        QUOTE,
        { lines: [line('plain-tote', {}, 1)] },
        {
          origin: DASHBOARD,
        }
      );
      expect(post.headers['access-control-allow-origin']).toBeUndefined();
      expect(post.headers['access-control-allow-credentials']).toBeUndefined();
    });
  });
});
