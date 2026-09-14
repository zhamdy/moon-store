import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { getCatalogCollection } from './get-catalog-collection';
import { findCatalogCategory, listCatalogCategories } from './list-catalog-categories';
import { listCatalogCollections } from './list-catalog-collections';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const collection = {
  slug: 'silk',
  name: 'حرير',
  nameEn: 'Silk',
  description: null,
  descriptionEn: null,
  season: 'Summer',
  year: 2026,
  imageUrl: null,
  isFeatured: true,
  productCount: 12,
};

const categories = [
  {
    slug: 'dresses',
    name: 'فساتين',
    nameEn: 'Dresses',
    description: null,
    descriptionEn: null,
    productCount: 8,
  },
  {
    slug: 'bags',
    name: 'حقائب',
    nameEn: null,
    description: null,
    descriptionEn: null,
    productCount: 0,
  },
];

const notFoundBody = { error: { code: 'NOT_FOUND', message: 'Resource not found' } };

function requestInit(): RequestInit & { next?: unknown } {
  return vi.mocked(fetch).mock.calls[0][1] as RequestInit & { next?: unknown };
}

describe('catalog collections and categories', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('API_URL', undefined);
    vi.stubEnv('CATALOG_SERVER_TOKEN', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('getCatalogCollection', () => {
    it('returns the collection, fetched with a 300s revalidate', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: collection }));

      await expect(getCatalogCollection('silk')).resolves.toEqual(collection);
      expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
        'http://localhost:3001/api/v1/catalog/collections/silk'
      );
      expect(requestInit().next).toEqual({ revalidate: 300 });
    });

    it('encodes the slug into one path segment', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(404, notFoundBody));

      await getCatalogCollection('a/b');

      expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
        'http://localhost:3001/api/v1/catalog/collections/a%2Fb'
      );
    });

    it('returns null on NOT_FOUND', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(404, notFoundBody));

      await expect(getCatalogCollection('upcoming')).resolves.toBeNull();
    });

    it('rethrows a 500 as INTERNAL_ERROR', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'Boom' } })
      );

      const error = await getCatalogCollection('silk').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status: 500 });
    });

    it('rethrows NETWORK_ERROR', async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

      await expect(getCatalogCollection('silk')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });

    it('sends the server token header when configured', async () => {
      vi.stubEnv('CATALOG_SERVER_TOKEN', 'b'.repeat(32));
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: collection }));

      await getCatalogCollection('silk');

      expect((requestInit().headers as Record<string, string>)['X-Catalog-Server-Token']).toBe(
        'b'.repeat(32)
      );
    });
  });

  describe('listCatalogCollections', () => {
    it('returns the list', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: [collection] }));

      await expect(listCatalogCollections()).resolves.toEqual([collection]);
      expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
        'http://localhost:3001/api/v1/catalog/collections'
      );
      expect(requestInit().next).toEqual({ revalidate: 300 });
    });
  });

  describe('categories', () => {
    it('lists categories, zero counts included', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: categories }));

      await expect(listCatalogCategories()).resolves.toEqual(categories);
      expect(requestInit().next).toEqual({ revalidate: 300 });
    });

    it('finds a category by slug, including an empty one', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: categories }));

      await expect(findCatalogCategory('bags')).resolves.toEqual(categories[1]);
    });

    it('returns null for an unknown slug', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: categories }));

      await expect(findCatalogCategory('shoes')).resolves.toBeNull();
    });

    it('rethrows when the list itself fails', async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' } })
      );

      await expect(findCatalogCategory('dresses')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
      });
    });
  });
});
