/**
 * Public catalog behaviour pg-mem cannot prove (plan Unit 4, KD-17).
 *
 * - node-postgres returns NUMERIC as a string ("1250"); pg-mem returns a number. The DTO
 *   must be a number, and price ordering must be numeric, on the real driver.
 * - `SET LOCAL statement_timeout` actually cancels, maps to 503, and does not leak onto the
 *   pooled connection afterwards.
 * - The worst listing combination completes under the real 2s timeout on a seeded volume.
 * - EXPLAIN output for the listing queries is printed for the KD-17 index review. Plans are
 *   reported, not asserted: they depend on volume and statistics.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { resetEnvCache } from '../../src/config/env';
import { catalogService, runCatalogRead } from '../../src/modules/commerce/catalog/service';
import {
  CatalogRepository,
  type ResolvedProductQuery,
} from '../../src/modules/commerce/catalog/repository';
import type { CatalogProductFilters } from '../../src/modules/commerce/catalog/types';
import type { Queryable } from '../../src/database/transaction';

const filters = (overrides: Partial<CatalogProductFilters>): CatalogProductFilters => ({
  page: 1,
  scope: { kind: 'all' },
  inStock: false,
  sort: 'newest',
  ...overrides,
});

describeWithPostgres('public catalog on real PostgreSQL', () => {
  let harness: RealPostgresHarness;
  const savedBase = process.env.MEDIA_PUBLIC_BASE_URL;

  beforeAll(async () => {
    process.env.MEDIA_PUBLIC_BASE_URL = 'https://media.example.com/uploads';
    resetEnvCache();
    harness = await setupRealPostgres('catalog');
  });

  afterAll(async () => {
    await harness.teardown();
    if (savedBase === undefined) delete process.env.MEDIA_PUBLIC_BASE_URL;
    else process.env.MEDIA_PUBLIC_BASE_URL = savedBase;
    resetEnvCache();
  });

  it('returns price as a JS number and orders by price numerically, not lexically', async () => {
    await harness.truncate();
    await harness.pool.query(
      `INSERT INTO products (id, name, sku, slug, price, stock, status) VALUES
         (1, 'a', 'S1', 'p-900', 900, 1, 'active'),
         (2, 'b', 'S2', 'p-10000', 10000, 1, 'active'),
         (3, 'c', 'S3', 'p-2000', 2000.50, 1, 'active')`
    );

    const raw = await harness.pool.query<{ price: unknown }>('SELECT price FROM products LIMIT 1');
    expect(typeof raw.rows[0].price).toBe('string');

    const asc = await catalogService.listProducts(filters({ sort: 'price-asc' }));
    expect(asc.data.map((p) => p.price)).toEqual([900, 2000.5, 10000]);
    expect(asc.data.every((p) => typeof p.price === 'number')).toBe(true);
    expect(asc.meta.priceRange).toEqual({ min: 900, max: 10000 });
    expect(asc.meta.pagination.totalItems).toBe(3);

    const desc = await catalogService.listProducts(filters({ sort: 'price-desc' }));
    expect(desc.data.map((p) => p.slug)).toEqual(['p-10000', 'p-2000', 'p-900']);

    const ranged = await catalogService.listProducts(filters({ priceMin: 900, priceMax: 2000 }));
    expect(ranged.data.map((p) => p.slug)).toEqual(['p-900']);
    expect(ranged.meta.priceRange).toEqual({ min: 900, max: 10000 });
  });

  it('computes inStock from summed variant stock and orders in-stock first', async () => {
    await harness.truncate();
    await harness.pool.query(
      `INSERT INTO products (id, name, sku, slug, price, stock, has_variants, status, created_at) VALUES
         (1, 'simple-out', 'S1', 'simple-out', 100, 0, 0, 'active', NOW()),
         (2, 'variant-in', 'S2', 'variant-in', 100, 0, 1, 'active', NOW() - INTERVAL '10 days'),
         (3, 'variant-out', 'S3', 'variant-out', 100, 9, 1, 'active', NOW() - INTERVAL '1 day'),
         (4, 'old', 'S4', 'old', 100, 1, 0, 'active', NOW() - INTERVAL '31 days')`
    );
    await harness.pool.query(
      `INSERT INTO product_variants (product_id, sku, stock) VALUES
         (2, 'V2A', 0), (2, 'V2B', 4), (3, 'V3A', 0)`
    );

    const all = await catalogService.listProducts(filters({}));
    expect(all.data.map((p) => [p.slug, p.inStock, p.isNew])).toEqual([
      ['variant-in', true, true],
      ['old', true, false],
      ['simple-out', false, true],
      ['variant-out', false, true],
    ]);

    const inStock = await catalogService.listProducts(filters({ inStock: true }));
    expect(inStock.data.map((p) => p.slug)).toEqual(['variant-in', 'old']);
  });

  it('cancels a slow read, maps it to 503, and leaves the pooled connection clean', async () => {
    await expect(
      runCatalogRead((client) => client.query('SELECT pg_sleep(2)'), 100)
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });

    for (let i = 0; i < 5; i += 1) {
      const { rows } = await harness.pool.query<{ statement_timeout: string }>(
        'SHOW statement_timeout'
      );
      expect(rows[0].statement_timeout).not.toBe('100ms');
    }
  });

  it('runs the worst listing combination under the timeout on a seeded volume, and reports plans', async () => {
    await harness.truncate();
    const client = await harness.connect();
    try {
      await client.query(
        `INSERT INTO categories (name, code, slug)
         SELECT 'Category ' || g, 'CAT' || g, 'cat-' || g FROM generate_series(1, 10) g`
      );
      await client.query(
        `INSERT INTO products (name, sku, slug, price, stock, has_variants, status, category_id, created_at, image_url)
         SELECT 'Product ' || g, 'VOL-' || g, 'vol-' || g,
                ((g * 37) % 200) * 50,
                CASE WHEN g % 3 = 0 THEN 0 ELSE g % 7 END,
                CASE WHEN g % 5 = 0 THEN 1 ELSE 0 END,
                CASE WHEN g % 11 = 0 THEN 'inactive' ELSE 'active' END,
                (g % 10) + 1,
                NOW() - ((g % 120) || ' days')::interval,
                CASE WHEN g % 4 = 0 THEN NULL ELSE '/uploads/products/vol-' || g || '.jpg' END
           FROM generate_series(1, 8000) g`
      );
      await client.query(
        `INSERT INTO product_variants (product_id, sku, stock)
         SELECT p.id, p.sku || '-' || v, CASE WHEN (p.id + v) % 4 = 0 THEN 2 ELSE 0 END
           FROM products p CROSS JOIN generate_series(1, 3) v
          WHERE p.has_variants = 1`
      );
      await client.query(
        `INSERT INTO product_images (product_id, image_url, position)
         SELECT p.id, '/uploads/products/g-' || p.id || '-' || n || '.jpg', n
           FROM products p CROSS JOIN generate_series(0, 1) n
          WHERE p.id % 2 = 0`
      );
      await client.query('ANALYZE');
    } finally {
      client.release();
    }

    const worst = filters({
      inStock: true,
      priceMin: 500,
      priceMax: 9500,
      sort: 'price-desc',
      page: 100,
    });
    const started = Date.now();
    const result = await catalogService.listProducts(worst);
    const elapsed = Date.now() - started;
    expect(result.meta.pagination.page).toBe(100);
    expect(result.data.length).toBeLessThanOrEqual(24);
    console.log(
      `[catalog volume] worst combination (8000 products): ${elapsed}ms, totalItems=${result.meta.pagination.totalItems}`
    );

    // Capture the exact SQL the repository sends and EXPLAIN it.
    const recorded: { text: string; params: unknown[] }[] = [];
    const recorder = {
      query: (text: string, params?: unknown[]) => {
        recorded.push({ text, params: params ?? [] });
        return harness.pool.query(text, params);
      },
    } as unknown as Queryable;
    const repo = new CatalogRepository();

    const cases: [string, ResolvedProductQuery][] = [
      ['worst: inStock + price + price-desc + page 100', { filters: worst }],
      [
        'category newest page 1',
        { filters: filters({ scope: { kind: 'category', slug: 'cat-3' } }), categoryId: 3 },
      ],
      ['new=true newest page 1', { filters: filters({ scope: { kind: 'new' } }) }],
    ];
    for (const [label, resolved] of cases) {
      recorded.length = 0;
      await repo.aggregateProducts(resolved, recorder);
      await repo.listProductPage(resolved, recorder);
      for (const [i, q] of recorded.entries()) {
        const plan = await harness.pool.query<{ 'QUERY PLAN': string }>(
          `EXPLAIN (ANALYZE, BUFFERS OFF, TIMING OFF) ${q.text}`,
          q.params
        );
        const lines = plan.rows.map((r) => r['QUERY PLAN']);
        expect(lines.length).toBeGreaterThan(0);
        console.log(
          `\n[catalog EXPLAIN] ${label} -- ${i === 0 ? 'aggregate' : 'page'}\n${lines.join('\n')}`
        );
      }
    }
  }, 120_000);
});
