import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogProductQuery } from '@/features/catalog/search-params';
import { ApiError } from '@/lib/api/errors';
import { buildCatalogProductsPath, listCatalogProducts } from './list-catalog-products';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseQuery: CatalogProductQuery = {
  scope: { kind: 'all' },
  sort: 'newest',
  inStock: false,
  priceMin: null,
  priceMax: null,
  page: 1,
};

const pagination = {
  page: 2,
  pageSize: 24,
  totalItems: 30,
  totalPages: 2,
  hasNextPage: false,
  hasPreviousPage: true,
};

const product = {
  slug: 'silk-dress',
  name: 'فستان',
  nameEn: 'Silk dress',
  price: 1250,
  images: [{ url: 'http://localhost:3001/uploads/products/a.jpg' }],
  isNew: true,
  inStock: true,
};

function requestedUrl(): string {
  return String(vi.mocked(fetch).mock.calls[0][0]);
}

function requestInit(): RequestInit & { next?: unknown } {
  return vi.mocked(fetch).mock.calls[0][1] as RequestInit & { next?: unknown };
}

describe('buildCatalogProductsPath', () => {
  it('maps a collection query, sending sort and a page past the first', () => {
    expect(
      buildCatalogProductsPath({
        ...baseQuery,
        scope: { kind: 'collection', slug: 'silk' },
        sort: 'curated',
        page: 2,
      })
    ).toBe('/catalog/products?collection=silk&sort=curated&page=2');
  });

  it('omits every value that filters nothing', () => {
    expect(buildCatalogProductsPath(baseQuery)).toBe('/catalog/products?sort=newest');
  });

  it('maps category, new, stock and both price bounds', () => {
    expect(
      buildCatalogProductsPath({
        ...baseQuery,
        scope: { kind: 'category', slug: 'dresses' },
        sort: 'price-asc',
        inStock: true,
        priceMin: 500,
        priceMax: 3000,
      })
    ).toBe(
      '/catalog/products?category=dresses&sort=price-asc&inStock=true&priceMin=500&priceMax=3000'
    );
    expect(buildCatalogProductsPath({ ...baseQuery, scope: { kind: 'new' } })).toBe(
      '/catalog/products?new=true&sort=newest'
    );
  });

  it('keeps a zero price bound, which is a real value once normalised', () => {
    expect(buildCatalogProductsPath({ ...baseQuery, priceMax: 0 })).toBe(
      '/catalog/products?sort=newest&priceMax=0'
    );
  });
});

describe('listCatalogProducts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('API_URL', undefined);
    vi.stubEnv('CATALOG_SERVER_TOKEN', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('requests the API path with a 60s revalidate and no credentials of its own', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { data: [], meta: { pagination, priceRange: { min: null, max: null } } })
    );

    await listCatalogProducts({
      ...baseQuery,
      scope: { kind: 'collection', slug: 'silk' },
      sort: 'curated',
      page: 2,
    });

    expect(requestedUrl()).toBe(
      'http://localhost:3001/api/v1/catalog/products?collection=silk&sort=curated&page=2'
    );
    expect(requestInit().next).toEqual({ revalidate: 60 });
    expect(requestInit().credentials).toBe('omit');
    expect(requestInit().signal).toBeUndefined();
  });

  it('sends the server token header when CATALOG_SERVER_TOKEN is set', async () => {
    vi.stubEnv('CATALOG_SERVER_TOKEN', 'a'.repeat(32));
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { data: [], meta: { pagination, priceRange: { min: null, max: null } } })
    );

    await listCatalogProducts(baseQuery);

    const headers = requestInit().headers as Record<string, string>;
    expect(headers['X-Catalog-Server-Token']).toBe('a'.repeat(32));
  });

  it('omits the header entirely when the token is unset', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { data: [], meta: { pagination, priceRange: { min: null, max: null } } })
    );

    await listCatalogProducts(baseQuery);

    const headers = requestInit().headers as Record<string, string>;
    expect(Object.keys(headers)).not.toContain('X-Catalog-Server-Token');
  });

  it('maps the envelope to items, pagination and priceRange', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        data: [product],
        meta: { pagination, priceRange: { min: 500, max: 4500 } },
      })
    );

    await expect(listCatalogProducts(baseQuery)).resolves.toEqual({
      items: [product],
      pagination,
      priceRange: { min: 500, max: 4500 },
    });
  });

  it('throws INVALID_RESPONSE when meta.pagination is missing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { data: [product], meta: { priceRange: { min: null, max: null } } })
    );

    const error = await listCatalogProducts(baseQuery).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('INVALID_RESPONSE');
  });

  it('throws INVALID_RESPONSE when a pagination field has the wrong type', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, {
        data: [],
        meta: {
          pagination: { ...pagination, totalPages: '2' },
          priceRange: { min: null, max: null },
        },
      })
    );

    await expect(listCatalogProducts(baseQuery)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('throws INVALID_RESPONSE when meta.priceRange is missing', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: [], meta: { pagination } }));

    await expect(listCatalogProducts(baseQuery)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('rethrows an API error such as an unknown collection', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Resource not found' } })
    );

    await expect(
      listCatalogProducts({ ...baseQuery, scope: { kind: 'collection', slug: 'gone' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
