import { describe, expect, it } from 'vitest';
import { buildCatalogProductsPath } from '@/features/products/api/list-catalog-products';
import { DEFAULT_CATALOG_PARAMS, loadCatalogParams, toProductQuery } from '../search-params';
import { pickRelated, relatedQuery, relatedRoute, relatedScope } from './related-scope';

const EVENING = { slug: 'evening', name: 'مسائي', nameEn: 'Evening' };
const SILK = { slug: 'silk', name: 'حرير', nameEn: 'Silk' };
const DRESSES = { slug: 'dresses', name: 'فساتين', nameEn: 'Dresses' };

describe('relatedScope', () => {
  it('uses the first collection, sorted curated', () => {
    expect(relatedScope({ category: DRESSES, collections: [EVENING, SILK] })).toEqual({
      kind: 'collection',
      slug: 'evening',
      sort: 'curated',
      entity: EVENING,
    });
  });

  it('falls back to the category, sorted newest', () => {
    expect(relatedScope({ category: DRESSES, collections: [] })).toEqual({
      kind: 'category',
      slug: 'dresses',
      sort: 'newest',
      entity: DRESSES,
    });
  });

  it('is null with neither', () => {
    expect(relatedScope({ category: null, collections: [] })).toBeNull();
  });

  it('queries with the scope sort on page 1', () => {
    for (const product of [
      { category: DRESSES, collections: [EVENING] },
      { category: DRESSES, collections: [] },
    ]) {
      const scope = relatedScope(product)!;
      const query = relatedQuery(scope);
      expect(query.sort).toBe(scope.sort);
      expect(query.page).toBe(1);
    }
  });
});

describe('related path equals the listing page 1 path', () => {
  it.each([
    ['collection', { category: DRESSES, collections: [SILK] }],
    ['category', { category: DRESSES, collections: [] }],
  ])('%s', (_kind, product) => {
    const scope = relatedScope(product)!;
    const route = relatedRoute(scope);
    // What the listing page builds for its bare URL (no search params).
    const listingPath = buildCatalogProductsPath(
      toProductQuery(loadCatalogParams({}, route), route)
    );

    expect(buildCatalogProductsPath(relatedQuery(scope))).toBe(listingPath);
    expect(listingPath).toBe(
      scope.kind === 'collection'
        ? '/catalog/products?collection=silk&sort=curated'
        : '/catalog/products?category=dresses&sort=newest'
    );
    expect(loadCatalogParams({}, route)).toEqual(DEFAULT_CATALOG_PARAMS);
  });
});

describe('pickRelated', () => {
  const item = (slug: string) => ({ slug });

  it('drops the current product', () => {
    expect(pickRelated([item('a'), item('self'), item('b')], 'self')).toEqual([
      item('a'),
      item('b'),
    ]);
  });

  it('is empty when only the current product is listed', () => {
    expect(pickRelated([item('self')], 'self')).toEqual([]);
  });

  it('takes four', () => {
    const items = ['a', 'b', 'self', 'c', 'd', 'e'].map(item);
    expect(pickRelated(items, 'self').map((i) => i.slug)).toEqual(['a', 'b', 'c', 'd']);
  });
});
