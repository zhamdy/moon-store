/**
 * Public catalog module (plan 2026-09-14-002, Unit 4).
 *
 * Through the real app (`createApp()`), anonymous, so routing, the catalog limiter, the
 * cache header, the strict contract parse and the whitelist mappers are all on the path.
 * pg-mem covers single-connection behaviour; NUMERIC-as-string, the statement timeout and
 * query plans are proven in `tests/concurrency/catalog.realpg.test.ts`.
 *
 * The rate limiter itself is `tests/http/catalogRateLimit.test.ts`.
 */
import http from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { closePool, setPool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { createApp } from '../src/app';
import {
  assertProductionEnv,
  getEnv,
  resetEnvCache,
  resolveMediaPublicOrigin,
  type Env,
} from '../src/config/env';
import {
  absoluteMediaUrl,
  deriveVariantOptions,
  productImages,
} from '../src/modules/commerce/catalog/mappers';
import type { CatalogVariantRow } from '../src/modules/commerce/catalog/types';
import { runCatalogRead } from '../src/modules/commerce/catalog/service';
import { PublicError } from '../src/http/errors';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');
const MEDIA_BASE = 'https://media.example.com/uploads';
const ORIGIN = 'https://media.example.com';

const ENV_KEYS = [
  'MEDIA_PUBLIC_BASE_URL',
  'CATALOG_RATE_LIMIT_MAX',
  'CATALOG_SERVER_RATE_LIMIT_MAX',
  'CATALOG_SERVER_TOKEN',
  'NODE_ENV',
] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

const PRODUCT_KEYS = ['images', 'inStock', 'isNew', 'name', 'nameEn', 'price', 'slug'];
const CATEGORY_KEYS = ['description', 'descriptionEn', 'name', 'nameEn', 'productCount', 'slug'];
const COLLECTION_KEYS = [
  'description',
  'descriptionEn',
  'imageUrl',
  'isFeatured',
  'name',
  'nameEn',
  'productCount',
  'season',
  'slug',
  'year',
];
const FORBIDDEN_KEYS = [
  'id',
  'cost_price',
  'costPrice',
  'sku',
  'barcode',
  'stock',
  'category_id',
  'categoryId',
  'distributor_id',
  'status',
  'has_variants',
];

type Json = Record<string, unknown>;
interface Result {
  status: number;
  cache: string | null;
  text: string;
  body: { data: Json & Json[]; meta: Json; error: Json };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

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

describe('public catalog', () => {
  let pool: PgPool;
  let server: Server;
  let port: number;

  async function get(url: string): Promise<Result> {
    const res = await fetch(`http://127.0.0.1:${port}${url}`);
    const text = await res.text();
    return {
      status: res.status,
      cache: res.headers.get('cache-control'),
      text,
      body: text ? JSON.parse(text) : null,
    };
  }

  function rawGet(
    url: string,
    headers: Record<string, string>
  ): Promise<{ status: number; text: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port, path: url, method: 'GET', headers },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (text += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  const slugs = (r: Result) => (r.body.data as Json[]).map((p) => p.slug);

  beforeAll(async () => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.MEDIA_PUBLIC_BASE_URL = MEDIA_BASE;
    process.env.CATALOG_RATE_LIMIT_MAX = '100000';
    delete process.env.CATALOG_SERVER_RATE_LIMIT_MAX;
    delete process.env.CATALOG_SERVER_TOKEN;
    resetEnvCache();

    pool = createPgMemPool();
    setPool(pool);
    await runMigrationsUp(pool, MIGRATIONS_DIR);

    await pool.query(
      `INSERT INTO categories (id, name, code, slug, name_en, description, description_en) VALUES
         (1, 'Dresses', 'DRS', 'dresses', 'Dresses', 'Evening and day', 'Evening and day EN'),
         (2, 'Tops', 'TOP', 'tops', NULL, NULL, NULL),
         (3, 'Bags', 'BAG', 'bags', 'Bags', NULL, NULL),
         (4, 'Accessories', 'ACC', NULL, NULL, NULL, NULL)`
    );

    const product = (
      id: number,
      slug: string | null,
      price: number,
      stock: number,
      hasVariants: 0 | 1,
      status: string,
      categoryId: number | null,
      createdDaysAgo: number,
      imageUrl: string | null
    ) =>
      pool.query(
        `INSERT INTO products (id, name, name_en, sku, barcode, slug, price, cost_price, stock,
                               has_variants, status, category_id, created_at, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, $11, $12, $13)`,
        [
          id,
          `name-${id}`,
          id % 2 === 0 ? null : `English ${id}`,
          `SKU-SECRET-${id}`,
          `BARCODE-${id}`,
          slug,
          price,
          stock,
          hasVariants,
          status,
          categoryId,
          daysAgo(createdDaysAgo),
          imageUrl,
        ]
      );

    await product(1, 'rose-dress', 1000, 5, 0, 'active', 1, 1, '/uploads/products/rose.jpg');
    await product(2, 'night-dress', 2000, 0, 0, 'active', 1, 2, null);
    await product(3, 'linen-top', 1500, 0, 1, 'active', 2, 40, null);
    await product(4, 'wool-top', 2500, 0, 1, 'active', 2, 5, null);
    await product(5, 'old-coat', 900, 5, 0, 'inactive', 1, 3, null);
    await product(6, 'gone-bag', 1200, 5, 0, 'discontinued', 3, 3, null);
    await product(7, null, 1100, 5, 0, 'active', 1, 1, null);
    await product(8, 'silk-skirt', 50, 2, 0, 'active', null, 31, null);

    await pool.query(
      `INSERT INTO product_variants (product_id, sku, stock) VALUES
         (3, 'V-3-A', 0), (3, 'V-3-B', 3), (4, 'V-4-A', 0), (4, 'V-4-B', 0)`
    );
    await pool.query(
      `INSERT INTO product_images (product_id, image_url, position) VALUES
         (1, '/uploads/products/rose-2.jpg', 1),
         (1, 'https://cdn.example.com/rose-1.jpg', 0),
         (1, '/uploads/products/rose-3.jpg', 2),
         (2, '/uploads/products/night.jpg', 0)`
    );

    await pool.query(
      `INSERT INTO collections (id, name, slug, name_en, description, description_en, image_url,
                                season, is_featured, status, year, created_at) VALUES
         (1, 'Evening', 'evening', 'Evening', 'After dark', NULL, '/uploads/collections/evening.jpg', 'AW', 0, 'active', 2025, $1),
         (2, 'Linen', 'linen', NULL, NULL, NULL, 'https://bucket.s3.amazonaws.com/linen.jpg', 'SS', 1, 'on_sale', 2026, $1),
         (3, 'Silk', 'silk', NULL, NULL, NULL, NULL, NULL, 0, 'active', NULL, $2),
         (4, 'Soon', 'soon', NULL, NULL, NULL, NULL, NULL, 0, 'upcoming', 2027, $2),
         (5, 'Old', 'old', NULL, NULL, NULL, NULL, NULL, 0, 'archived', 2020, $2),
         (6, 'Hidden', NULL, NULL, NULL, NULL, NULL, NULL, 0, 'active', 2026, $2)`,
      [daysAgo(20), daysAgo(1)]
    );
    await pool.query(
      `INSERT INTO collection_products (collection_id, product_id, position) VALUES
         (1, 4, 0), (1, 5, 1), (1, 2, 2), (1, 1, 3),
         (2, 3, 0),
         (4, 1, 0)`
    );

    const app = createApp();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    await closePool();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    resetEnvCache();
  });

  describe('GET /catalog/products', () => {
    it('lists active slugged products anonymously, in-stock first then newest', async () => {
      const r = await get('/api/v1/catalog/products');
      expect(r.status).toBe(200);
      // In stock: rose (1d), silk (31d), linen via a variant (40d). Sold out: night (2d), wool (5d).
      expect(slugs(r)).toEqual([
        'rose-dress',
        'silk-skirt',
        'linen-top',
        'night-dress',
        'wool-top',
      ]);
      expect(r.body.meta).toEqual({
        pagination: {
          page: 1,
          pageSize: 24,
          totalItems: 5,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        priceRange: { min: 50, max: 2500 },
      });
    });

    it('returns exactly the whitelisted DTO and no internal field anywhere in the body', async () => {
      const r = await get('/api/v1/catalog/products');
      for (const item of r.body.data as Json[]) {
        expect(Object.keys(item).sort()).toEqual(PRODUCT_KEYS);
        expect(typeof item.price).toBe('number');
      }
      const keys = allKeys(r.body);
      for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden)).toBe(false);
      expect(r.text).not.toContain('SKU-SECRET');
      expect(r.text).not.toContain('BARCODE-');
    });

    it('filters by category, excluding inactive, discontinued and slug-less products', async () => {
      const r = await get('/api/v1/catalog/products?category=dresses');
      expect(r.status).toBe(200);
      expect(slugs(r)).toEqual(['rose-dress', 'night-dress']);
    });

    it('orders a collection by curated position by default, sold-out pieces included in place', async () => {
      const r = await get('/api/v1/catalog/products?collection=evening');
      expect(r.status).toBe(200);
      // Position order: wool (sold out), old-coat (inactive, skipped), night (sold out), rose.
      expect(slugs(r)).toEqual(['wool-top', 'night-dress', 'rose-dress']);
    });

    it('applies in-stock-first inside a collection when a non-curated sort is chosen', async () => {
      const r = await get('/api/v1/catalog/products?collection=evening&sort=newest');
      expect(slugs(r)).toEqual(['rose-dress', 'night-dress', 'wool-top']);
    });

    it('new=true is the NEW_IN_DAYS window, and isNew agrees', async () => {
      const r = await get('/api/v1/catalog/products?new=true');
      expect(slugs(r)).toEqual(['rose-dress', 'night-dress', 'wool-top']);
      const all = await get('/api/v1/catalog/products');
      const isNew = Object.fromEntries((all.body.data as Json[]).map((p) => [p.slug, p.isNew]));
      expect(isNew).toEqual({
        'rose-dress': true,
        'night-dress': true,
        'wool-top': true,
        'silk-skirt': false,
        'linen-top': false,
      });
    });

    it('inStock=true uses variant stock for variant products and own stock otherwise', async () => {
      const r = await get('/api/v1/catalog/products?inStock=true');
      expect(slugs(r)).toEqual(['rose-dress', 'silk-skirt', 'linen-top']);
      expect((r.body.data as Json[]).every((p) => p.inStock === true)).toBe(true);
      expect(r.body.meta.priceRange).toEqual({ min: 50, max: 1500 });
    });

    it('price bounds are inclusive and meta.priceRange ignores them', async () => {
      const r = await get('/api/v1/catalog/products?priceMin=1000&priceMax=2000');
      expect(r.status).toBe(200);
      expect(slugs(r)).toEqual(['rose-dress', 'linen-top', 'night-dress']);
      expect((r.body.meta.pagination as Json).totalItems).toBe(3);
      expect(r.body.meta.priceRange).toEqual({ min: 50, max: 2500 });
    });

    it('sorts by price in both directions with in-stock first', async () => {
      const asc = await get('/api/v1/catalog/products?sort=price-asc');
      expect(slugs(asc)).toEqual([
        'silk-skirt',
        'rose-dress',
        'linen-top',
        'night-dress',
        'wool-top',
      ]);
      const desc = await get('/api/v1/catalog/products?sort=price-desc');
      expect(slugs(desc)).toEqual([
        'linen-top',
        'rose-dress',
        'silk-skirt',
        'wool-top',
        'night-dress',
      ]);
    });

    it('builds images from primary then gallery by position, at most two, absolute', async () => {
      const r = await get('/api/v1/catalog/products');
      const images = Object.fromEntries((r.body.data as Json[]).map((p) => [p.slug, p.images]));
      expect(images['rose-dress']).toEqual([
        { url: `${ORIGIN}/uploads/products/rose.jpg` },
        { url: 'https://cdn.example.com/rose-1.jpg' },
      ]);
      // No primary: the first gallery image becomes images[0].
      expect(images['night-dress']).toEqual([{ url: `${ORIGIN}/uploads/products/night.jpg` }]);
      expect(images['linen-top']).toEqual([]);
    });

    it('returns empty data with correct meta for a page past the last', async () => {
      const r = await get('/api/v1/catalog/products?page=500');
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual([]);
      expect(r.body.meta.pagination).toEqual({
        page: 500,
        pageSize: 24,
        totalItems: 5,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it.each([
      ['unknown parameter', 'foo=1'],
      ['category with collection', 'category=dresses&collection=evening'],
      ['category with new', 'category=dresses&new=true'],
      ['curated without collection', 'sort=curated'],
      ['priceMin above priceMax', 'priceMin=2000&priceMax=1000'],
      ['page above the cap', 'page=501'],
      ['page far above the cap', 'page=999'],
      ['page zero', 'page=0'],
      ['price not a multiple of 50', 'priceMin=1234'],
      ['negative price', 'priceMax=-50'],
      ['new=false', 'new=false'],
      ['uppercase slug', 'category=Dresses'],
      ['repeated page', 'page=1&page=2'],
    ])('rejects %s with 400 and no-store', async (_label, qs) => {
      const r = await get(`/api/v1/catalog/products?${qs}`);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
      expect(r.cache).toBe('no-store');
    });

    it('answers every miss with one identical 404 body', async () => {
      const misses = await Promise.all([
        get('/api/v1/catalog/products?category=nope'),
        get('/api/v1/catalog/products?collection=nope'),
        get('/api/v1/catalog/products?collection=soon'),
        get('/api/v1/catalog/products?collection=old'),
        get('/api/v1/catalog/collections/nope'),
        get('/api/v1/catalog/collections/soon'),
        get('/api/v1/catalog/collections/old'),
      ]);
      for (const miss of misses) {
        expect(miss.status).toBe(404);
        expect(miss.cache).toBe('no-store');
        expect(miss.text).toBe(misses[0].text);
      }
      expect(misses[0].body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      });
    });

    it('a known category with no active products is an empty 200, not a 404', async () => {
      const r = await get('/api/v1/catalog/products?category=bags');
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual([]);
      expect(r.body.meta.priceRange).toEqual({ min: null, max: null });
      expect((r.body.meta.pagination as Json).totalPages).toBe(0);
    });
  });

  describe('GET /catalog/categories', () => {
    it('lists every slugged category by name, with active product counts including zero', async () => {
      const r = await get('/api/v1/catalog/categories');
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual([
        {
          slug: 'bags',
          name: 'Bags',
          nameEn: 'Bags',
          description: null,
          descriptionEn: null,
          productCount: 0,
        },
        {
          slug: 'dresses',
          name: 'Dresses',
          nameEn: 'Dresses',
          description: 'Evening and day',
          descriptionEn: 'Evening and day EN',
          productCount: 2,
        },
        {
          slug: 'tops',
          name: 'Tops',
          nameEn: null,
          description: null,
          descriptionEn: null,
          productCount: 2,
        },
      ]);
      for (const item of r.body.data as Json[])
        expect(Object.keys(item).sort()).toEqual(CATEGORY_KEYS);
    });

    it('rejects query parameters it does not take', async () => {
      expect((await get('/api/v1/catalog/categories?x=1')).status).toBe(400);
    });
  });

  describe('GET /catalog/collections', () => {
    it('lists live slugged collections featured first, then year with unknown last', async () => {
      const r = await get('/api/v1/catalog/collections');
      expect(r.status).toBe(200);
      expect((r.body.data as Json[]).map((c) => c.slug)).toEqual(['linen', 'evening', 'silk']);
      for (const item of r.body.data as Json[])
        expect(Object.keys(item).sort()).toEqual(COLLECTION_KEYS);
      const keys = allKeys(r.body);
      for (const forbidden of FORBIDDEN_KEYS) expect(keys.has(forbidden)).toBe(false);
    });

    it('returns one collection by slug with absolute image and active-only count', async () => {
      const r = await get('/api/v1/catalog/collections/evening');
      expect(r.status).toBe(200);
      expect(r.cache).toBe('public, max-age=60');
      expect(r.body.data).toEqual({
        slug: 'evening',
        name: 'Evening',
        nameEn: 'Evening',
        description: 'After dark',
        descriptionEn: null,
        season: 'AW',
        year: 2025,
        imageUrl: `${ORIGIN}/uploads/collections/evening.jpg`,
        isFeatured: false,
        productCount: 3,
      });
      const linen = await get('/api/v1/catalog/collections/linen');
      expect(linen.body.data.imageUrl).toBe('https://bucket.s3.amazonaws.com/linen.jpg');
      expect(linen.body.data.isFeatured).toBe(true);
    });
  });

  describe('media URLs and caching', () => {
    it('ignores a forged Host and X-Forwarded-Host', async () => {
      const honest = await rawGet('/api/v1/catalog/products', {});
      const forged = await rawGet('/api/v1/catalog/products', {
        Host: 'evil.example',
        'X-Forwarded-Host': 'evil.example',
        'X-Forwarded-Proto': 'http',
      });
      expect(forged.status).toBe(200);
      expect(forged.text).toBe(honest.text);
      expect(forged.text).not.toContain('evil.example');
    });

    it('marks a 2xx public for 60s', async () => {
      const r = await get('/api/v1/catalog/products');
      expect(r.cache).toBe('public, max-age=60');
      expect((await get('/api/v1/catalog/categories')).cache).toBe('public, max-age=60');
    });

    it('marks an unrouted path under the prefix no-store', async () => {
      const r = await get('/api/v1/catalog/nothing-here');
      expect(r.status).toBe(404);
      expect(r.cache).toBe('no-store');
    });

    it('absoluteMediaUrl keeps http(s), resolves relative on the origin, drops other schemes', () => {
      expect(absoluteMediaUrl('/uploads/a.jpg', ORIGIN)).toBe(`${ORIGIN}/uploads/a.jpg`);
      expect(absoluteMediaUrl('uploads/a.jpg', ORIGIN)).toBe(`${ORIGIN}/uploads/a.jpg`);
      expect(absoluteMediaUrl('https://s3.example/x.jpg', ORIGIN)).toBe('https://s3.example/x.jpg');
      expect(absoluteMediaUrl('javascript:alert(1)', ORIGIN)).toBeNull();
      expect(absoluteMediaUrl('//evil.example/x.jpg', ORIGIN)).toBeNull();
      expect(absoluteMediaUrl('  ', ORIGIN)).toBeNull();
      expect(absoluteMediaUrl(null, ORIGIN)).toBeNull();
    });
  });

  describe('statement timeout', () => {
    it('maps a cancelled query (57014) to a 503 SERVICE_UNAVAILABLE', async () => {
      const cancelled = Object.assign(new Error('canceling statement due to statement timeout'), {
        code: '57014',
      });
      const failure = runCatalogRead(async () => {
        throw cancelled;
      });
      await expect(failure).rejects.toBeInstanceOf(PublicError);
      await expect(
        runCatalogRead(async () => {
          throw cancelled;
        })
      ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    });

    it('does not disguise any other failure as load', async () => {
      await expect(
        runCatalogRead(async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
    });
  });

  describe('boot validation', () => {
    const envWith = (overrides: Partial<Env>): Env => ({ ...getEnv(), ...overrides });
    const TOKEN = 'c3'.repeat(32);

    it('refuses production with a missing or relative MEDIA_PUBLIC_BASE_URL', () => {
      expect(() =>
        assertProductionEnv(envWith({ NODE_ENV: 'production', MEDIA_PUBLIC_BASE_URL: undefined }))
      ).toThrow(/MEDIA_PUBLIC_BASE_URL/);
      expect(() =>
        assertProductionEnv(envWith({ NODE_ENV: 'production', MEDIA_PUBLIC_BASE_URL: '/uploads' }))
      ).toThrow(/MEDIA_PUBLIC_BASE_URL/);
      expect(() =>
        assertProductionEnv(
          envWith({ NODE_ENV: 'production', MEDIA_PUBLIC_BASE_URL: 'ftp://media.example.com/x' })
        )
      ).toThrow(/MEDIA_PUBLIC_BASE_URL/);
    });

    it('accepts production with an absolute base and uses only its origin', () => {
      const env = envWith({
        NODE_ENV: 'production',
        MEDIA_PUBLIC_BASE_URL: MEDIA_BASE,
        CATALOG_SERVER_TOKEN: TOKEN,
      });
      expect(() => assertProductionEnv(env)).not.toThrow();
      expect(resolveMediaPublicOrigin(env)).toBe(ORIGIN);
    });

    it('refuses production without a CATALOG_SERVER_TOKEN, naming both variables', () => {
      for (const CATALOG_SERVER_TOKEN of [undefined, '', ' , ']) {
        let message = '';
        try {
          assertProductionEnv(
            envWith({
              NODE_ENV: 'production',
              MEDIA_PUBLIC_BASE_URL: MEDIA_BASE,
              CATALOG_SERVER_TOKEN,
              CATALOG_PUBLIC_ONLY: false,
            })
          );
        } catch (err) {
          message = (err as Error).message;
        }
        expect(message, String(CATALOG_SERVER_TOKEN)).toMatch(/CATALOG_SERVER_TOKEN/);
        expect(message).toMatch(/CATALOG_PUBLIC_ONLY=true/);
      }
    });

    it('never prints a configured token in a boot error', () => {
      let message = '';
      try {
        assertProductionEnv(
          envWith({
            NODE_ENV: 'production',
            MEDIA_PUBLIC_BASE_URL: undefined,
            CATALOG_SERVER_TOKEN: TOKEN,
          })
        );
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toMatch(/MEDIA_PUBLIC_BASE_URL/);
      expect(message).not.toContain(TOKEN);
    });

    it('accepts production without a token when CATALOG_PUBLIC_ONLY=true', () => {
      expect(() =>
        assertProductionEnv(
          envWith({
            NODE_ENV: 'production',
            MEDIA_PUBLIC_BASE_URL: MEDIA_BASE,
            CATALOG_SERVER_TOKEN: undefined,
            CATALOG_PUBLIC_ONLY: true,
          })
        )
      ).not.toThrow();
    });

    it('parses CATALOG_PUBLIC_ONLY as true/false only', () => {
      const previous = process.env.CATALOG_PUBLIC_ONLY;
      try {
        process.env.CATALOG_PUBLIC_ONLY = 'true';
        resetEnvCache();
        expect(getEnv().CATALOG_PUBLIC_ONLY).toBe(true);

        delete process.env.CATALOG_PUBLIC_ONLY;
        resetEnvCache();
        expect(getEnv().CATALOG_PUBLIC_ONLY).toBe(false);

        process.env.CATALOG_PUBLIC_ONLY = 'yes';
        resetEnvCache();
        expect(() => getEnv()).toThrow(/CATALOG_PUBLIC_ONLY/);
      } finally {
        if (previous === undefined) delete process.env.CATALOG_PUBLIC_ONLY;
        else process.env.CATALOG_PUBLIC_ONLY = previous;
        resetEnvCache();
      }
    });

    it('falls back to this process on localhost outside production', () => {
      expect(
        resolveMediaPublicOrigin(
          envWith({ NODE_ENV: 'development', MEDIA_PUBLIC_BASE_URL: undefined, PORT: 3001 })
        )
      ).toBe('http://localhost:3001');
      expect(
        resolveMediaPublicOrigin(
          envWith({ NODE_ENV: 'test', MEDIA_PUBLIC_BASE_URL: '/uploads', PORT: 4000 })
        )
      ).toBe('http://localhost:4000');
      expect(() =>
        assertProductionEnv(envWith({ NODE_ENV: 'development', MEDIA_PUBLIC_BASE_URL: undefined }))
      ).not.toThrow();
    });

    it('rejects a CATALOG_SERVER_TOKEN entry under 32 bytes without echoing it', () => {
      const previous = process.env.CATALOG_SERVER_TOKEN;
      try {
        process.env.CATALOG_SERVER_TOKEN = `${'a'.repeat(64)},short-secret-value`;
        resetEnvCache();
        let message = '';
        try {
          getEnv();
        } catch (err) {
          message = (err as Error).message;
        }
        expect(message).toMatch(/CATALOG_SERVER_TOKEN/);
        expect(message).not.toContain('short-secret-value');

        process.env.CATALOG_SERVER_TOKEN = `${'a'.repeat(32)}, ${'b'.repeat(64)}`;
        resetEnvCache();
        expect(() => getEnv()).not.toThrow();
      } finally {
        if (previous === undefined) delete process.env.CATALOG_SERVER_TOKEN;
        else process.env.CATALOG_SERVER_TOKEN = previous;
        resetEnvCache();
      }
    });
  });
  describe('GET /catalog/products/:slug', () => {
    const DETAIL_KEYS = [
      'category',
      'collections',
      'description',
      'descriptionEn',
      'images',
      'inStock',
      'isNew',
      'name',
      'nameEn',
      'options',
      'price',
      'slug',
      'variants',
    ];
    const DETAIL_FORBIDDEN = [
      ...FORBIDDEN_KEYS,
      'product_id',
      'productId',
      'min_stock',
      'minStock',
    ];

    const insertProduct = (
      id: number,
      slug: string,
      fields: {
        price?: number;
        stock?: number;
        hasVariants?: 0 | 1;
        status?: string;
        categoryId?: number | null;
        imageUrl?: string | null;
        createdDaysAgo?: number;
        description?: string | null;
        descriptionEn?: string | null;
      } = {}
    ) =>
      pool.query(
        `INSERT INTO products (id, name, name_en, sku, barcode, slug, price, cost_price, stock,
                               min_stock, has_variants, status, category_id, created_at,
                               image_url, description, description_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, 5, $9, $10, $11, $12, $13, $14, $15)`,
        [
          id,
          `name-${id}`,
          `English ${id}`,
          `SKU-SECRET-${id}`,
          `BARCODE-${id}`,
          slug,
          fields.price ?? 1000,
          fields.stock ?? 0,
          fields.hasVariants ?? 0,
          fields.status ?? 'active',
          fields.categoryId === undefined ? 5 : fields.categoryId,
          daysAgo(fields.createdDaysAgo ?? 60),
          fields.imageUrl ?? null,
          fields.description ?? null,
          fields.descriptionEn ?? null,
        ]
      );

    // Sequential: ids must follow array order, since creation order is display order.
    const variants = async (productId: number, rows: [string, number, number | null][]) => {
      for (const [i, [attributes, stock, price]] of rows.entries()) {
        await pool.query(
          `INSERT INTO product_variants (product_id, sku, barcode, stock, price, cost_price, attributes)
           VALUES ($1, $2, $3, $4, $5, 7, $6)`,
          [
            productId,
            `V-SECRET-${productId}-${i}`,
            `VB-${productId}-${i}`,
            stock,
            price,
            attributes,
          ]
        );
      }
    };

    const size = (value: string) => JSON.stringify({ size: value });

    beforeAll(async () => {
      await pool.query(
        `INSERT INTO categories (id, name, code, slug, name_en) VALUES (5, 'Seedlike', 'SDL', 'seedlike', 'Seedlike')`
      );

      await insertProduct(101, 'gallery-dress', {
        price: 1800,
        stock: 3,
        categoryId: 1,
        createdDaysAgo: 2,
        imageUrl: '/uploads/products/g-primary.jpg',
        description: 'وصف عربي',
        descriptionEn: 'An English description',
      });
      await pool.query(
        `INSERT INTO product_images (product_id, image_url, position) VALUES
           (101, '/uploads/products/g-2.jpg', 2),
           (101, '/uploads/products/g-0.jpg', 0),
           (101, 'https://cdn.example.com/g-1.jpg', 1)`
      );
      await pool.query(
        `INSERT INTO collection_products (collection_id, product_id, position) VALUES
           (1, 101, 4), (4, 101, 1), (2, 101, 1), (5, 101, 0)`
      );

      await insertProduct(102, 'ten-images', { stock: 1, imageUrl: '/uploads/products/t-p.jpg' });
      for (let position = 0; position < 9; position += 1) {
        await pool.query(
          'INSERT INTO product_images (product_id, image_url, position) VALUES ($1, $2, $3)',
          [102, `/uploads/products/t-${position}.jpg`, position]
        );
      }

      await insertProduct(103, 'unsafe-image', { stock: 1, categoryId: null });
      await pool.query(
        `INSERT INTO product_images (product_id, image_url, position) VALUES
           (103, '/uploads/products/u-0.jpg', 0),
           (103, 'javascript:alert(1)', 1),
           (103, '/uploads/products/u-2.jpg', 2)`
      );
      await insertProduct(104, 'unslugged-category', { stock: 1, categoryId: 4 });

      // Shaped like the seed: `{ size }` attributes, has_variants set, NULL variant prices.
      await insertProduct(110, 'knit-mixed', { hasVariants: 1, stock: 6, price: 1250 });
      await variants(110, [
        [size('S'), 4, null],
        [size('M'), 0, null],
        [size('L'), 2, null],
      ]);
      await insertProduct(111, 'dress-sold-out', { hasVariants: 1, price: 2100 });
      await variants(111, [
        [size('S'), 0, null],
        [size('M'), 0, null],
      ]);
      await insertProduct(112, 'plain-sold-out', { stock: 0 });
      await insertProduct(113, 'flag-without-rows', { hasVariants: 1, stock: 9 });
      await insertProduct(114, 'plain-in-stock', { stock: 2 });

      await insertProduct(120, 'priced-variants', { hasVariants: 1, price: 1000, categoryId: 1 });
      await variants(120, [
        [size('S'), 1, null],
        [size('M'), 1, 1200.5],
      ]);
      await insertProduct(121, 'merged-keys', { hasVariants: 1, categoryId: 1 });
      await variants(121, [
        ['{"Size":"S"}', 1, null],
        ['{" size ":" M "}', 0, null],
        ['{"size":"m"}', 3, null],
        ['{"size":""}', 3, null],
      ]);
      await insertProduct(122, 'malformed-variants', { hasVariants: 1, categoryId: 1 });
      await variants(122, [
        ['not json', 5, null],
        ['{"size":1}', 5, null],
        ['{}', 5, null],
        [size('L'), 0, null],
      ]);
      await insertProduct(123, 'all-malformed', { hasVariants: 1, stock: 4, categoryId: 1 });
      await variants(123, [
        ['nope', 3, null],
        ['[]', 1, null],
      ]);
      await insertProduct(124, 'stale-variant-rows', { hasVariants: 0, stock: 4, categoryId: 1 });
      await variants(124, [[size('S'), 0, null]]);
      await insertProduct(125, 'mixed-key-sets', { hasVariants: 1, categoryId: 1 });
      await variants(125, [
        [size('S'), 0, null],
        [size('M'), 0, null],
        ['{"المقاس":"L"}', 5, null],
      ]);

      await insertProduct(126, 'inactive-piece', { stock: 1, status: 'inactive' });
      await insertProduct(127, 'discontinued-piece', { stock: 1, status: 'discontinued' });
    });

    const detail = async (slug: string) => {
      const r = await get(`/api/v1/catalog/products/${slug}`);
      expect(r.status, slug).toBe(200);
      return r.body.data as unknown as Json;
    };

    it('returns the exact DTO: gallery order, descriptions, context, public cache', async () => {
      const r = await get('/api/v1/catalog/products/gallery-dress');
      expect(r.status).toBe(200);
      expect(r.cache).toBe('public, max-age=60');
      expect(Object.keys(r.body.data).sort()).toEqual(DETAIL_KEYS);
      expect(r.body.data).toEqual({
        slug: 'gallery-dress',
        name: 'name-101',
        nameEn: 'English 101',
        description: 'وصف عربي',
        descriptionEn: 'An English description',
        price: 1800,
        isNew: true,
        inStock: true,
        images: [
          { url: `${ORIGIN}/uploads/products/g-primary.jpg` },
          { url: `${ORIGIN}/uploads/products/g-0.jpg` },
          { url: 'https://cdn.example.com/g-1.jpg' },
          { url: `${ORIGIN}/uploads/products/g-2.jpg` },
        ],
        category: { slug: 'dresses', name: 'Dresses', nameEn: 'Dresses' },
        // linen is featured; soon (upcoming) and old (archived) are never listed.
        collections: [
          { slug: 'linen', name: 'Linen', nameEn: null },
          { slug: 'evening', name: 'Evening', nameEn: 'Evening' },
        ],
        options: [],
        variants: [],
      });
    });

    it('keeps the listing DTO key set unchanged: descriptions are detail-only', async () => {
      const r = await get('/api/v1/catalog/products?category=dresses');
      const item = (r.body.data as Json[]).find((p) => p.slug === 'gallery-dress');
      expect(item).toBeDefined();
      expect(Object.keys(item as Json).sort()).toEqual(PRODUCT_KEYS);
    });

    it('never exposes internal fields anywhere in the body, variants included', async () => {
      for (const slug of ['gallery-dress', 'knit-mixed', 'priced-variants', 'merged-keys']) {
        const r = await get(`/api/v1/catalog/products/${slug}`);
        const keys = allKeys(r.body);
        for (const forbidden of DETAIL_FORBIDDEN)
          expect(keys.has(forbidden), forbidden).toBe(false);
        expect(r.text).not.toContain('SECRET');
        expect(r.text).not.toContain('BARCODE-');
        expect(r.text).not.toContain('VB-');
      }
    });

    it('derives one size option in creation order with per-variant availability', async () => {
      const knit = await detail('knit-mixed');
      expect(knit.inStock).toBe(true);
      expect(knit.options).toEqual([{ key: 'size', label: 'size', values: ['S', 'M', 'L'] }]);
      expect(knit.variants).toEqual([
        { options: { size: 'S' }, price: 1250, inStock: true },
        { options: { size: 'M' }, price: 1250, inStock: false },
        { options: { size: 'L' }, price: 1250, inStock: true },
      ]);
    });

    it('marks the product and every variant sold out when every size is', async () => {
      const dress = await detail('dress-sold-out');
      expect(dress.inStock).toBe(false);
      expect((dress.variants as Json[]).every((v) => v.inStock === false)).toBe(true);
    });

    it('handles no variants, and a variant flag with no rows, as the flag says', async () => {
      expect(await detail('plain-sold-out')).toMatchObject({
        options: [],
        variants: [],
        inStock: false,
      });
      expect(await detail('flag-without-rows')).toMatchObject({
        options: [],
        variants: [],
        inStock: false,
      });
      expect(await detail('stale-variant-rows')).toMatchObject({
        options: [],
        variants: [],
        inStock: true,
      });
    });

    it('falls back to the product price for a NULL variant price, as a number', async () => {
      const priced = await detail('priced-variants');
      expect(priced.variants).toEqual([
        { options: { size: 'S' }, price: 1000, inStock: true },
        { options: { size: 'M' }, price: 1200.5, inStock: true },
      ]);
    });

    it('merges key spellings and value case, and drops empty values and repeats', async () => {
      const merged = await detail('merged-keys');
      expect(merged.options).toEqual([{ key: 'size', label: 'Size', values: ['S', 'M'] }]);
      // `m` repeats `M` and `""` is empty: both dropped, so the in-stock `m` does not count.
      expect(merged.variants).toEqual([
        { options: { size: 'S' }, price: 1000, inStock: true },
        { options: { size: 'M' }, price: 1000, inStock: false },
      ]);
    });

    it('drops malformed variants and still answers 200', async () => {
      const malformed = await detail('malformed-variants');
      expect(malformed.options).toEqual([{ key: 'size', label: 'size', values: ['L'] }]);
      expect(malformed.variants).toEqual([{ options: { size: 'L' }, price: 1000, inStock: false }]);
      expect(malformed.inStock).toBe(false);

      expect(await detail('all-malformed')).toMatchObject({
        options: [],
        variants: [],
        inStock: false,
      });
    });

    it('lists only the canonical key set, so an odd in-stock variant does not count', async () => {
      const mixed = await detail('mixed-key-sets');
      expect(mixed.options).toEqual([{ key: 'size', label: 'size', values: ['S', 'M'] }]);
      expect((mixed.variants as Json[]).length).toBe(2);
      expect(mixed.inStock).toBe(false);
    });

    it('caps images at nine and drops unsafe URLs', async () => {
      const ten = await detail('ten-images');
      expect((ten.images as Json[]).map((i) => i.url)).toEqual([
        `${ORIGIN}/uploads/products/t-p.jpg`,
        ...Array.from({ length: 8 }, (_, n) => `${ORIGIN}/uploads/products/t-${n}.jpg`),
      ]);
      const unsafe = await detail('unsafe-image');
      expect(unsafe.images).toEqual([
        { url: `${ORIGIN}/uploads/products/u-0.jpg` },
        { url: `${ORIGIN}/uploads/products/u-2.jpg` },
      ]);
    });

    it('returns category null with no category or an unslugged one', async () => {
      expect((await detail('unsafe-image')).category).toBeNull();
      expect((await detail('unslugged-category')).category).toBeNull();
    });

    it('agrees with the listing on inStock for well-formed products', async () => {
      const listing = await get('/api/v1/catalog/products?category=seedlike');
      const listed = Object.fromEntries(
        (listing.body.data as Json[]).map((p) => [p.slug, p.inStock])
      );
      expect(Object.keys(listed).sort()).toEqual([
        'dress-sold-out',
        'flag-without-rows',
        'knit-mixed',
        'plain-in-stock',
        'plain-sold-out',
        'ten-images',
      ]);
      for (const [slug, inStock] of Object.entries(listed)) {
        expect((await detail(slug)).inStock, slug).toBe(inStock);
      }
      expect(listed['knit-mixed']).toBe(true);
      expect(listed['dress-sold-out']).toBe(false);
    });

    it('answers unknown, inactive and discontinued products with the shared 404 body', async () => {
      const collectionMiss = await get('/api/v1/catalog/collections/nope');
      for (const slug of ['nope', 'inactive-piece', 'discontinued-piece']) {
        const r = await get(`/api/v1/catalog/products/${slug}`);
        expect(r.status, slug).toBe(404);
        expect(r.cache).toBe('no-store');
        expect(r.text).toBe(collectionMiss.text);
      }
    });

    it.each([
      ['an uppercase slug', '/api/v1/catalog/products/Gallery-Dress'],
      ['an over-length slug', `/api/v1/catalog/products/${'a'.repeat(81)}`],
      ['an unknown query parameter', '/api/v1/catalog/products/gallery-dress?x=1'],
    ])('rejects %s with 400 and no-store', async (_label, url) => {
      const r = await get(url);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
      expect(r.cache).toBe('no-store');
    });
  });

  describe('deriveVariantOptions', () => {
    const row = (id: number, attributes: string, stock = 1, price: number | null = null) =>
      ({ id, attributes, stock, price }) as CatalogVariantRow;

    it('breaks a key-set tie toward the lowest id and reports what it dropped', () => {
      const derived = deriveVariantOptions(
        [row(3, '{"color":"Red"}'), row(1, '{"size":"S"}')].sort((a, b) => a.id - b.id),
        500
      );
      expect(derived.options).toEqual([{ key: 'size', label: 'size', values: ['S'] }]);
      expect(derived.droppedVariantIds).toEqual([3]);
    });

    it('keeps key order by first appearance and fills every canonical key per variant', () => {
      const derived = deriveVariantOptions(
        [
          row(1, '{"Size":"S","Color":"Ivory"}', 0),
          row(2, '{"color":"ink","size":"M"}', 2, 900),
          row(3, '{"size":"S","color":"Ink"}', 1),
        ],
        '750'
      );
      expect(derived.options).toEqual([
        { key: 'size', label: 'Size', values: ['S', 'M'] },
        { key: 'color', label: 'Color', values: ['Ivory', 'ink'] },
      ]);
      expect(derived.variants).toEqual([
        { options: { size: 'S', color: 'Ivory' }, price: 750, inStock: false },
        { options: { size: 'M', color: 'ink' }, price: 900, inStock: true },
        { options: { size: 'S', color: 'ink' }, price: 750, inStock: true },
      ]);
      expect(derived.droppedVariantIds).toEqual([]);
    });

    it('rejects null attributes, arrays, duplicate keys after normalization and blank keys', () => {
      const derived = deriveVariantOptions(
        [
          { id: 1, attributes: null, stock: 1, price: null },
          row(2, '["S"]'),
          row(3, '{"size":"S","Size":"M"}'),
          row(4, '{" ":"S"}'),
        ],
        100
      );
      expect(derived).toEqual({ options: [], variants: [], droppedVariantIds: [1, 2, 3, 4] });
    });

    it('merges keys and values that differ only by Unicode normalization', () => {
      const nfd = 'Café';
      const nfc = 'Café';
      const derived = deriveVariantOptions(
        [
          row(1, JSON.stringify({ [nfd]: 'S' })),
          row(2, JSON.stringify({ [nfc]: 'M' })),
          row(3, JSON.stringify({ [nfc]: 'إ' })),
          row(4, JSON.stringify({ [nfd]: 'إ' })),
        ],
        100
      );
      expect(derived.options).toEqual([{ key: 'café', label: 'Café', values: ['S', 'M', 'إ'] }]);
      expect(derived.variants.map((v) => v.options)).toEqual([
        { café: 'S' },
        { café: 'M' },
        { café: 'إ' },
      ]);
      expect(derived.droppedVariantIds).toEqual([4]);
    });

    it('does not conflate combinations whose values contain control characters', () => {
      const derived = deriveVariantOptions(
        [row(1, '{"a":"x\\u0001b\\u0000y","b":"z"}'), row(2, '{"a":"x","b":"y\\u0001b\\u0000z"}')],
        100
      );
      expect(derived.variants).toHaveLength(2);
      expect(derived.droppedVariantIds).toEqual([]);
    });

    it('productImages honours the cap it is given', () => {
      const gallery = ['/a.jpg', '/b.jpg', '/c.jpg'];
      expect(productImages('/p.jpg', gallery, ORIGIN, 2)).toHaveLength(2);
      expect(productImages('/p.jpg', gallery, ORIGIN, 9)).toHaveLength(4);
    });
  });
});
