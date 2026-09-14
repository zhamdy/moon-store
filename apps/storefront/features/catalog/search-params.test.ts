import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CATALOG_PARAMS,
  loadCatalogParams,
  nextCatalogParams,
  normalizeDigits,
  serializeCatalogParams,
  toProductQuery,
  type CatalogRoute,
} from './search-params';

const SHOP: CatalogRoute = { kind: 'all' };
const DRESSES: CatalogRoute = { kind: 'category', slug: 'dresses' };
const NEW_IN: CatalogRoute = { kind: 'new' };
const EVENING: CatalogRoute = { kind: 'collection', slug: 'evening' };

describe('loadCatalogParams', () => {
  it('parses the full grammar to typed values', () => {
    expect(loadCatalogParams('sort=price-desc&stock=in&min=500&max=3000&page=2', SHOP)).toEqual({
      sort: 'price-desc',
      stock: 'in',
      min: 500,
      max: 3000,
      page: 2,
    });
  });

  it('gives defaults for an empty query', () => {
    expect(loadCatalogParams('', SHOP)).toEqual(DEFAULT_CATALOG_PARAMS);
    expect(loadCatalogParams({}, SHOP)).toEqual(DEFAULT_CATALOG_PARAMS);
  });

  it("accepts Next's searchParams Promise", async () => {
    await expect(
      loadCatalogParams(Promise.resolve({ sort: 'price-asc', page: '4' }), SHOP)
    ).resolves.toMatchObject({ sort: 'price-asc', page: 4 });
  });

  it.each(['0', '-1', '1.5', 'abc', '501', '', '1e2'])('page=%s gives 1', (page) => {
    expect(loadCatalogParams({ page }, SHOP).page).toBe(1);
  });

  it('accepts page 500', () => {
    expect(loadCatalogParams('page=500', SHOP).page).toBe(500);
  });

  it('an unknown sort gives the route default', () => {
    expect(loadCatalogParams('sort=best', SHOP).sort).toBeNull();
    expect(toProductQuery(loadCatalogParams('sort=best', SHOP), SHOP).sort).toBe('newest');
  });

  it('drops invalid min, max and stock', () => {
    expect(loadCatalogParams('min=-5&max=abc&stock=yes', SHOP)).toEqual(DEFAULT_CATALOG_PARAMS);
    expect(loadCatalogParams('min=12.5', SHOP).min).toBeNull();
  });

  it('swaps min > max', () => {
    expect(loadCatalogParams('min=3000&max=500', SHOP)).toMatchObject({ min: 500, max: 3000 });
  });

  it('uses the first valid value of a repeated param', () => {
    expect(loadCatalogParams('sort=best&sort=price-asc&sort=price-desc', SHOP).sort).toBe(
      'price-asc'
    );
    expect(loadCatalogParams({ sort: ['price-desc', 'price-asc'] }, SHOP).sort).toBe('price-desc');
    expect(loadCatalogParams({ page: ['x', '3'] }, SHOP).page).toBe(3);
  });

  it('snaps price bounds to 50 EGP steps, min down and max up', () => {
    expect(loadCatalogParams('min=1234&max=2980', SHOP)).toMatchObject({ min: 1200, max: 3000 });
    expect(loadCatalogParams('min=1250&max=1250', SHOP)).toMatchObject({ min: 1250, max: 1250 });
  });

  it('normalises Eastern Arabic and Persian digits and thousands separators', () => {
    expect(loadCatalogParams({ min: '٥٠٠' }, SHOP).min).toBe(500);
    expect(loadCatalogParams({ max: '۳۰۰۰' }, SHOP).max).toBe(3000);
    expect(loadCatalogParams({ max: '1,250' }, SHOP).max).toBe(1250);
    expect(loadCatalogParams({ max: '١٬٢٥٠' }, SHOP).max).toBe(1250);
    expect(loadCatalogParams({ page: '٢' }, SHOP).page).toBe(2);
  });

  it('drops a zero min, which filters nothing', () => {
    expect(loadCatalogParams('min=0&max=0', SHOP)).toMatchObject({ min: null, max: 0 });
    expect(loadCatalogParams('min=20', SHOP).min).toBeNull();
  });

  it('treats curated as the route default outside a collection', () => {
    for (const route of [SHOP, DRESSES, NEW_IN]) {
      const params = loadCatalogParams('sort=curated', route);
      expect(params.sort).toBeNull();
      expect(toProductQuery(params, route).sort).toBe('newest');
    }
  });

  it('keeps curated as the collection default, serialized to no param', () => {
    const params = loadCatalogParams('sort=curated', EVENING);
    expect(params.sort).toBeNull();
    expect(toProductQuery(params, EVENING).sort).toBe('curated');
    expect(serializeCatalogParams({ sort: 'curated' }, EVENING)).toBe('');
    expect(toProductQuery(loadCatalogParams('sort=newest', EVENING), EVENING).sort).toBe('newest');
  });
});

describe('serializeCatalogParams', () => {
  it('serializes defaults to an empty string', () => {
    expect(serializeCatalogParams(DEFAULT_CATALOG_PARAMS, SHOP)).toBe('');
    expect(serializeCatalogParams({ sort: 'newest', page: 1 }, SHOP)).toBe('');
  });

  it('serializes in grammar order', () => {
    expect(
      serializeCatalogParams(
        { page: 2, max: 3000, min: 500, stock: 'in', sort: 'price-desc' },
        SHOP
      )
    ).toBe('?sort=price-desc&stock=in&min=500&max=3000&page=2');
  });

  it('round-trips through the loader', () => {
    const query = 'sort=price-asc&stock=in&min=500&max=3000&page=7';
    expect(serializeCatalogParams(loadCatalogParams(query, DRESSES), DRESSES)).toBe(`?${query}`);
  });

  it('changing sort from a page-3 state yields no page', () => {
    const current = loadCatalogParams('stock=in&page=3', SHOP);
    const next = nextCatalogParams(current, { sort: 'price-asc' });
    expect(serializeCatalogParams(next, SHOP)).toBe('?sort=price-asc&stock=in');
  });

  it('a page-only change keeps the other values', () => {
    const current = loadCatalogParams('sort=price-asc&page=3', SHOP);
    expect(serializeCatalogParams(nextCatalogParams(current, { page: 4 }), SHOP)).toBe(
      '?sort=price-asc&page=4'
    );
    // Re-sending an unchanged value alongside the page is still a page-only change.
    expect(nextCatalogParams(current, { sort: 'price-asc', page: 5 }).page).toBe(5);
  });
});

describe('toProductQuery', () => {
  it('maps storefront names to the query object with the route scope', () => {
    expect(
      toProductQuery(loadCatalogParams('stock=in&min=500&max=3000&page=2', DRESSES), DRESSES)
    ).toEqual({
      scope: { kind: 'category', slug: 'dresses' },
      sort: 'newest',
      inStock: true,
      priceMin: 500,
      priceMax: 3000,
      page: 2,
    });
  });

  it('gives the defaults per route', () => {
    expect(toProductQuery(DEFAULT_CATALOG_PARAMS, NEW_IN)).toEqual({
      scope: { kind: 'new' },
      sort: 'newest',
      inStock: false,
      priceMin: null,
      priceMax: null,
      page: 1,
    });
    expect(toProductQuery(DEFAULT_CATALOG_PARAMS, EVENING).sort).toBe('curated');
  });

  it('normalises raw (client-side) params too', () => {
    const query = toProductQuery(
      { sort: 'curated', stock: null, min: 3000, max: 500, page: 1 },
      SHOP
    );
    expect(query).toMatchObject({ sort: 'newest', priceMin: 500, priceMax: 3000 });
  });
});

describe('normalizeDigits', () => {
  it('rejects anything but a plain non-negative integer', () => {
    expect(normalizeDigits('-5')).toBeNull();
    expect(normalizeDigits('5.0')).toBeNull();
    expect(normalizeDigits('1234567890')).toBeNull();
    expect(normalizeDigits(' 1 250 ')).toBe('1250');
  });
});
