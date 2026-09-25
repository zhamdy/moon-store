import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import type { CatalogProduct, CatalogProductPage } from '@/features/products/types/catalog-product';
import { resolveApiBaseUrl } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { CREDITS_LIMIT, loadFilmCredits } from './load-film-credits';

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

describe('loadFilmCredits', () => {
  it('reads the selection collection in its curated order', async () => {
    baseUrl.mockReturnValue('http://api.test');
    const items = [product('a'), product('b')];
    list.mockResolvedValue(page(items));

    await expect(loadFilmCredits()).resolves.toEqual(items);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: 'collection', slug: 'evening' },
        sort: 'curated',
        page: 1,
      })
    );
  });

  it(`takes the first ${CREDITS_LIMIT}: the credits row`, async () => {
    baseUrl.mockReturnValue('http://api.test');
    list.mockResolvedValue(page(Array.from({ length: 8 }, (_, i) => product(`p-${i}`))));

    await expect(loadFilmCredits()).resolves.toHaveLength(CREDITS_LIMIT);
  });

  // No static fallback: null hides the row.
  it('hides the row when the API is not configured, without calling it', async () => {
    baseUrl.mockImplementation(() => {
      throw new Error('API_URL was not set');
    });

    await expect(loadFilmCredits()).resolves.toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('hides the row when the collection is empty', async () => {
    baseUrl.mockReturnValue('http://api.test');
    list.mockResolvedValue(page([]));

    await expect(loadFilmCredits()).resolves.toBeNull();
  });

  it('hides the row on an ApiError (a missing collection is a 404), logged once', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    baseUrl.mockReturnValue('http://api.test');
    list.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'gone' }));

    await expect(loadFilmCredits()).resolves.toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });

  it('propagates anything that is not an ApiError', async () => {
    baseUrl.mockReturnValue('http://api.test');
    const bug = new TypeError('boom');
    list.mockRejectedValue(bug);

    await expect(loadFilmCredits()).rejects.toBe(bug);
  });
});
