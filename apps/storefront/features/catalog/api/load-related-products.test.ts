import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import type { CatalogProduct, CatalogProductPage } from '@/features/products/types/catalog-product';
import { ApiError } from '@/lib/api/errors';
import { loadRelatedProducts } from './load-related-products';

vi.mock('@/features/products/api/list-catalog-products', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listCatalogProducts: vi.fn(),
}));

const list = vi.mocked(listCatalogProducts);

const SILK = { slug: 'silk', name: 'حرير', nameEn: 'Silk' };
const DRESSES = { slug: 'dresses', name: 'فساتين', nameEn: 'Dresses' };
const PRODUCT = { slug: 'self', category: DRESSES, collections: [SILK] };

function page(slugs: string[]): CatalogProductPage {
  return {
    items: slugs.map((slug) => ({ slug }) as CatalogProduct),
    pagination: {
      page: 1,
      pageSize: 24,
      totalItems: slugs.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    priceRange: { min: null, max: null },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  list.mockReset();
});

describe('loadRelatedProducts', () => {
  it('reads the collection listing page 1 and drops the product itself', async () => {
    list.mockResolvedValue(page(['a', 'self', 'b']));

    const result = await loadRelatedProducts(PRODUCT);

    expect(list).toHaveBeenCalledWith({
      scope: { kind: 'collection', slug: 'silk' },
      sort: 'curated',
      inStock: false,
      priceMin: null,
      priceMax: null,
      page: 1,
    });
    expect(result?.scope.kind).toBe('collection');
    expect(result?.items.map((item) => item.slug)).toEqual(['a', 'b']);
  });

  it('is null when the listing holds only the product itself', async () => {
    list.mockResolvedValue(page(['self']));
    expect(await loadRelatedProducts(PRODUCT)).toBeNull();
  });

  it('is null without reading when there is no scope', async () => {
    expect(await loadRelatedProducts({ slug: 'self', category: null, collections: [] })).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('contains an ApiError as null', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    list.mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'unreachable' })
    );

    expect(await loadRelatedProducts(PRODUCT)).toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });

  it('propagates anything that is not an ApiError', async () => {
    const bug = new TypeError('boom');
    list.mockRejectedValue(bug);
    await expect(loadRelatedProducts(PRODUCT)).rejects.toBe(bug);
  });
});
