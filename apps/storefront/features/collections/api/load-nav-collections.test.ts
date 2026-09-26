import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiBaseUrl } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { CatalogCollection } from '../types/catalog-collection';
import { listCatalogCollections } from './list-catalog-collections';
import { NAV_COLLECTIONS_LIMIT, loadNavCollections } from './load-nav-collections';

vi.mock('./list-catalog-collections', () => ({ listCatalogCollections: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ resolveApiBaseUrl: vi.fn() }));

const list = vi.mocked(listCatalogCollections);
const baseUrl = vi.mocked(resolveApiBaseUrl);

afterEach(() => {
  vi.restoreAllMocks();
  list.mockReset();
  baseUrl.mockReset();
});

const collection = (slug: string): CatalogCollection => ({
  slug,
  name: slug,
  nameEn: slug,
  description: null,
  descriptionEn: null,
  season: null,
  year: null,
  imageUrl: null,
  isFeatured: false,
  productCount: 3,
});

describe('loadNavCollections', () => {
  it(`keeps the server's order and caps at ${NAV_COLLECTIONS_LIMIT}`, async () => {
    baseUrl.mockReturnValue('http://api.test');
    const items = ['a', 'b', 'c', 'd', 'e'].map(collection);
    list.mockResolvedValue(items);

    await expect(loadNavCollections()).resolves.toEqual(items.slice(0, NAV_COLLECTIONS_LIMIT));
  });

  it('is null without an API, without calling it', async () => {
    baseUrl.mockImplementation(() => {
      throw new Error('API_URL was not set');
    });

    await expect(loadNavCollections()).resolves.toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('is null when there are no live collections', async () => {
    baseUrl.mockReturnValue('http://api.test');
    list.mockResolvedValue([]);

    await expect(loadNavCollections()).resolves.toBeNull();
  });

  it('is null on an ApiError, logged once', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    baseUrl.mockReturnValue('http://api.test');
    list.mockRejectedValue(new ApiError({ status: 503, code: 'NETWORK_ERROR', message: 'down' }));

    await expect(loadNavCollections()).resolves.toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });
});
