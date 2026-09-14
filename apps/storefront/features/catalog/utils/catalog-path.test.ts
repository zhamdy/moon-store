import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG_PARAMS } from '../search-params';
import { catalogClearFiltersHref, catalogPageHref, catalogPath } from './catalog-path';

describe('catalog paths', () => {
  it('maps each route kind to its locale-less path', () => {
    expect(catalogPath({ kind: 'all' })).toBe('/shop');
    expect(catalogPath({ kind: 'category', slug: 'dresses' })).toBe('/shop/dresses');
    expect(catalogPath({ kind: 'collection', slug: 'silk' })).toBe('/collections/silk');
    expect(catalogPath({ kind: 'new' })).toBe('/new-in');
  });

  it('builds page links that keep filters and target the results heading', () => {
    const params = { ...DEFAULT_CATALOG_PARAMS, stock: 'in' as const, sort: 'price-asc' as const };
    const href = catalogPageHref({ kind: 'all' }, params, 3);
    expect(href.startsWith('/shop?')).toBe(true);
    expect(href).toContain('stock=in');
    expect(href).toContain('sort=price-asc');
    expect(href).toContain('page=3');
    expect(href.endsWith('#catalog-results')).toBe(true);
  });

  it('omits page 1 from a page link', () => {
    expect(catalogPageHref({ kind: 'new' }, { ...DEFAULT_CATALOG_PARAMS, page: 4 }, 1)).toBe(
      '/new-in#catalog-results'
    );
  });

  it('clears filters but keeps sort', () => {
    const params = {
      sort: 'price-desc' as const,
      stock: 'in' as const,
      min: 500,
      max: 3000,
      page: 2,
    };
    expect(catalogClearFiltersHref({ kind: 'category', slug: 'bags' }, params)).toBe(
      '/shop/bags?sort=price-desc'
    );
    expect(
      catalogClearFiltersHref({ kind: 'collection', slug: 'silk' }, { ...params, sort: null })
    ).toBe('/collections/silk');
  });
});
