import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import type { CatalogProduct, CatalogProductPage } from '@/features/products/types/catalog-product';
import { resolveApiBaseUrl } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { NEW_ARRIVALS_LIMIT, loadNewArrivals } from './load-new-arrivals';

vi.mock('@/features/products/api/list-catalog-products', () => ({
  listCatalogProducts: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({ resolveApiBaseUrl: vi.fn() }));

const list = vi.mocked(listCatalogProducts);
const baseUrl = vi.mocked(resolveApiBaseUrl);

afterEach(() => {
  vi.restoreAllMocks();
  list.mockReset();
  baseUrl.mockReset();
});

function product(slug: string, images: { url: string }[] = []): CatalogProduct {
  return {
    slug,
    name: `اسم ${slug}`,
    nameEn: slug,
    description: null,
    descriptionEn: null,
    price: 2850,
    images,
    isNew: true,
    inStock: true,
    options: [],
    variants: [],
  };
}

function page(items: CatalogProduct[]): CatalogProductPage {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 24,
      totalItems: items.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    priceRange: { min: null, max: null },
  };
}

describe('loadNewArrivals', () => {
  /**
   * MED-3: the rail used to fall back to the static set whenever fewer than four
   * products were *photographed*, so a stocked catalogue awaiting its photography —
   * the common production state, and every seeded database — showed invented names
   * and hard-coded prices as if they were the shop's.
   */
  it('returns real products that have no photographs', async () => {
    baseUrl.mockReturnValue('http://api.test');
    const items = [product('a'), product('b')];
    list.mockResolvedValue(page(items));

    await expect(loadNewArrivals()).resolves.toEqual(items);
  });

  it('returns a mixed set without reordering it, so the rail still means "newest"', async () => {
    baseUrl.mockReturnValue('http://api.test');
    const items = [product('unphotographed'), product('photographed', [{ url: 'u' }])];
    list.mockResolvedValue(page(items));

    await expect(loadNewArrivals()).resolves.toEqual(items);
  });

  it(`caps the rail at ${NEW_ARRIVALS_LIMIT}`, async () => {
    baseUrl.mockReturnValue('http://api.test');
    const items = Array.from({ length: NEW_ARRIVALS_LIMIT + 3 }, (_, i) => product(`p-${i}`));
    list.mockResolvedValue(page(items));

    await expect(loadNewArrivals()).resolves.toHaveLength(NEW_ARRIVALS_LIMIT);
  });

  // The fallback is for one condition only: the API cannot answer.
  it('falls back when the API is not configured, without calling it', async () => {
    baseUrl.mockImplementation(() => {
      throw new Error('API_URL was not set');
    });

    await expect(loadNewArrivals()).resolves.toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('falls back on an empty catalogue', async () => {
    baseUrl.mockReturnValue('http://api.test');
    list.mockResolvedValue(page([]));

    await expect(loadNewArrivals()).resolves.toBeNull();
  });

  it('falls back on an ApiError, logged once', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    baseUrl.mockReturnValue('http://api.test');
    list.mockRejectedValue(new ApiError({ status: 503, code: 'NETWORK_ERROR', message: 'down' }));

    await expect(loadNewArrivals()).resolves.toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });

  it('propagates anything that is not an ApiError', async () => {
    baseUrl.mockReturnValue('http://api.test');
    const bug = new TypeError('boom');
    list.mockRejectedValue(bug);

    await expect(loadNewArrivals()).rejects.toBe(bug);
  });
});
