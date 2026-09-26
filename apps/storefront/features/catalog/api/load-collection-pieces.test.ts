import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import type { CatalogProduct, CatalogProductPage } from '@/features/products/types/catalog-product';
import { ApiError } from '@/lib/api/errors';
import { loadCollectionPieces } from './load-collection-pieces';

vi.mock('@/features/products/api/list-catalog-products', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listCatalogProducts: vi.fn(),
}));

const list = vi.mocked(listCatalogProducts);

const PAGE: CatalogProductPage = {
  items: [{ slug: 'a' }, { slug: 'b' }] as CatalogProduct[],
  pagination: {
    page: 1,
    pageSize: 24,
    totalItems: 2,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
  priceRange: { min: 1100, max: 1950 },
};

afterEach(() => {
  vi.restoreAllMocks();
  list.mockReset();
});

describe('loadCollectionPieces', () => {
  it("reads the collection page's own first listing page, curated", async () => {
    list.mockResolvedValue(PAGE);

    const result = await loadCollectionPieces('linen');

    expect(list).toHaveBeenCalledWith({
      scope: { kind: 'collection', slug: 'linen' },
      sort: 'curated',
      inStock: false,
      priceMin: null,
      priceMax: null,
      page: 1,
    });
    expect(result).toEqual({ items: PAGE.items, total: 2, priceRange: { min: 1100, max: 1950 } });
  });

  it('is null, and logs, when the API answers with an error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    list.mockRejectedValue(new ApiError({ status: 503, code: 'NETWORK_ERROR', message: 'down' }));

    expect(await loadCollectionPieces('linen')).toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });

  it('lets anything but an ApiError through', async () => {
    list.mockRejectedValue(new TypeError('bug'));
    await expect(loadCollectionPieces('linen')).rejects.toThrow('bug');
  });
});
