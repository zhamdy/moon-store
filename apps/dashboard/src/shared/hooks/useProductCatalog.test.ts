import { describe, expect, it } from 'vitest';
import {
  canonicalProductIds,
  chunkProductIds,
  filterCachedProducts,
  mergeProductsById,
  productCatalogQueryKey,
} from './useProductCatalog';
import type { Product } from '../types';

const product = (over: Partial<Product>): Product =>
  ({
    id: 1,
    name: 'Silk Dress',
    sku: 'SD-1',
    barcode: null,
    price: 250,
    cost_price: 100,
    stock: 5,
    min_stock: 1,
    category: null,
    category_id: null,
    category_name: null,
    category_code: null,
    distributor_id: null,
    distributor_name: null,
    image_url: null,
    has_variants: 0,
    variant_count: 0,
    variant_stock: 0,
    status: 'active',
    created_at: '',
    updated_at: '',
    ...over,
  }) as Product;

describe('product catalog identity', () => {
  it('canonicalizes equivalent id sets', () => {
    expect(canonicalProductIds([3, 1, 3])).toEqual([1, 3]);
    expect(canonicalProductIds([1, 3])).toEqual([1, 3]);
  });

  it('creates deterministic bounded lookup chunks', () => {
    const chunks = chunkProductIds([...Array.from({ length: 101 }, (_, index) => 101 - index), 1]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(chunks[1]).toEqual([101]);
  });

  it('merges pages and hydrated selections without duplicates', () => {
    expect(mergeProductsById([{ id: 2 }, { id: 1 }], [{ id: 2 }, { id: 3 }])).toEqual([
      { id: 2 },
      { id: 1 },
      { id: 3 },
    ]);
  });
});

describe('catalogue cache fallback (#114)', () => {
  it('hashes a blank search to the same key the unnarrowed catalogue is stored under', () => {
    // The fallback finds the cached catalogue by building this key, so an empty
    // search, a whitespace search and no search at all have to agree.
    const unnarrowed = JSON.stringify(productCatalogQueryKey({ pageSize: 25 }));
    expect(JSON.stringify(productCatalogQueryKey({ search: '   ', pageSize: 25 }))).toBe(
      unnarrowed
    );
    expect(JSON.stringify(productCatalogQueryKey({ categoryId: null, pageSize: 25 }))).toBe(
      unnarrowed
    );
    expect(JSON.stringify(productCatalogQueryKey({ search: 'silk', pageSize: 25 }))).not.toBe(
      unnarrowed
    );
  });

  it('narrows a cached catalogue the way the server would', () => {
    const rows = [
      product({ id: 1, name: 'Silk Dress', sku: 'SD-1', category_id: 3 }),
      product({ id: 2, name: 'Wool Coat', sku: 'WC-9', barcode: '77silk77', category_id: 4 }),
      product({ id: 3, name: 'Silk Scarf', sku: 'SS-2', category_id: 4, status: 'inactive' }),
    ];

    // name, sku and barcode, case-insensitively -- the repository's ILIKE triple.
    expect(filterCachedProducts(rows, { search: 'SILK' }).map((p) => p.id)).toEqual([1, 2]);
    expect(filterCachedProducts(rows, { search: 'wc-9' }).map((p) => p.id)).toEqual([2]);
    // Category is equality, and it composes with the search.
    expect(filterCachedProducts(rows, { search: 'silk', categoryId: 4 }).map((p) => p.id)).toEqual([
      2,
    ]);
    // The list endpoint defaults to active rows; a cached inactive one must not
    // become ringable just because the link dropped.
    expect(filterCachedProducts(rows, { search: 'scarf' })).toEqual([]);
    expect(filterCachedProducts(rows, {}).map((p) => p.id)).toEqual([1, 2]);
  });
});
