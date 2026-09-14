import { describe, expect, it } from 'vitest';
import { loadCatalogParams, type CatalogRoute } from '../search-params';
import { buildCatalogMetadata } from './catalog-metadata';

const SHOP: CatalogRoute = { kind: 'all' };
const DRESSES: CatalogRoute = { kind: 'category', slug: 'dresses' };
const EVENING: CatalogRoute = { kind: 'collection', slug: 'evening' };

const base = { title: 'Shop', description: 'All pieces' };

describe('buildCatalogMetadata', () => {
  it('/en/shop: self canonical, en/ar alternates, indexable', () => {
    const meta = buildCatalogMetadata({
      ...base,
      locale: 'en',
      path: '/shop',
      params: loadCatalogParams('', SHOP),
    });
    expect(meta.title).toBe('Shop');
    expect(meta.description).toBe('All pieces');
    expect(meta.alternates?.canonical).toBe('/en/shop');
    expect(meta.alternates?.languages).toEqual({ en: '/en/shop', ar: '/ar/shop' });
    expect(meta.robots).toBeUndefined();
  });

  it('/en/shop?page=3: canonical keeps the page and stays indexable', () => {
    const meta = buildCatalogMetadata({
      ...base,
      locale: 'en',
      path: '/shop',
      params: loadCatalogParams('page=3', SHOP),
    });
    expect(meta.alternates?.canonical).toBe('/en/shop?page=3');
    expect(meta.alternates?.languages).toEqual({ en: '/en/shop?page=3', ar: '/ar/shop?page=3' });
    expect(meta.robots).toBeUndefined();
  });

  it('/ar/shop/dresses?sort=price-asc: canonical drops sort, noindex follow', () => {
    const meta = buildCatalogMetadata({
      ...base,
      locale: 'ar',
      path: '/shop/dresses',
      params: loadCatalogParams('sort=price-asc', DRESSES),
    });
    expect(meta.alternates?.canonical).toBe('/ar/shop/dresses');
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it.each(['stock=in', 'min=500', 'max=3000'])('%s is noindex', (query) => {
    const meta = buildCatalogMetadata({
      ...base,
      locale: 'en',
      path: '/shop',
      params: loadCatalogParams(query, SHOP),
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('a route-default or invalid sort stays indexable', () => {
    for (const [query, route] of [
      ['sort=curated', EVENING],
      ['sort=newest', SHOP],
      ['sort=best', SHOP],
      ['stock=yes', SHOP],
    ] as const) {
      const meta = buildCatalogMetadata({
        ...base,
        locale: 'en',
        path: '/collections/evening',
        params: loadCatalogParams(query, route),
      });
      expect(meta.robots).toBeUndefined();
    }
  });
});
