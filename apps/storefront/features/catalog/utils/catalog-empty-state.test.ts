import { describe, expect, it } from 'vitest';
import { catalogEmptyVariant } from './catalog-empty-state';

const base = { hasFilters: false, page: 1, totalItems: 0, totalPages: 0 };

describe('catalogEmptyVariant', () => {
  it('is null when the page has products', () => {
    expect(
      catalogEmptyVariant({
        ...base,
        route: { kind: 'all' },
        totalItems: 30,
        totalPages: 2,
        page: 2,
      })
    ).toBeNull();
  });

  it('is outOfRange past the last page of a non-empty listing, filtered or not', () => {
    expect(
      catalogEmptyVariant({
        ...base,
        route: { kind: 'all' },
        totalItems: 30,
        totalPages: 2,
        page: 3,
      })
    ).toBe('outOfRange');
    expect(
      catalogEmptyVariant({
        ...base,
        route: { kind: 'new' },
        hasFilters: true,
        totalItems: 5,
        totalPages: 1,
        page: 9,
      })
    ).toBe('outOfRange');
  });

  it('prefers filtered over the scope when nothing matches', () => {
    expect(
      catalogEmptyVariant({
        ...base,
        route: { kind: 'collection', slug: 'silk' },
        hasFilters: true,
      })
    ).toBe('filtered');
  });

  it('names the scope when an unfiltered listing is empty', () => {
    expect(catalogEmptyVariant({ ...base, route: { kind: 'collection', slug: 'silk' } })).toBe(
      'collection'
    );
    expect(catalogEmptyVariant({ ...base, route: { kind: 'category', slug: 'bags' } })).toBe(
      'category'
    );
    expect(catalogEmptyVariant({ ...base, route: { kind: 'all' } })).toBe('catalog');
    expect(catalogEmptyVariant({ ...base, route: { kind: 'new' }, page: 4 })).toBe('catalog');
  });
});
