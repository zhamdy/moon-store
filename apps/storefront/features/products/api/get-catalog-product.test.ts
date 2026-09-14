import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { getCatalogProduct } from './get-catalog-product';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const product = {
  slug: 'silk-dress',
  name: 'فستان حرير',
  nameEn: 'Silk Dress',
  description: null,
  descriptionEn: 'Bias-cut silk.',
  material: 'حرير',
  materialEn: '100% silk',
  care: null,
  careEn: 'Dry clean only',
  fit: 'مقاس عادي',
  fitEn: null,
  price: 1250,
  isNew: true,
  inStock: true,
  images: [{ url: 'http://localhost:3001/uploads/a.jpg' }],
  category: { slug: 'dresses', name: 'فساتين', nameEn: 'Dresses' },
  collections: [{ slug: 'silk', name: 'حرير', nameEn: null }],
  options: [{ key: 'size', label: 'Size', values: ['S', 'M'] }],
  variants: [
    { options: { size: 'S' }, price: 1250, inStock: true },
    { options: { size: 'M' }, price: 1300, inStock: false },
  ],
};

const notFoundBody = { error: { code: 'NOT_FOUND', message: 'Resource not found' } };

function requestInit(): RequestInit & { next?: unknown } {
  return vi.mocked(fetch).mock.calls[0][1] as RequestInit & { next?: unknown };
}

async function invalidFor(data: unknown) {
  vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data }));
  return getCatalogProduct('silk-dress').catch((e: unknown) => e);
}

describe('getCatalogProduct', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('API_URL', undefined);
    vi.stubEnv('CATALOG_SERVER_TOKEN', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns the product, fetched with a 60s revalidate and a deadline', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: product }));

    await expect(getCatalogProduct('silk-dress')).resolves.toEqual(product);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      'http://localhost:3001/api/v1/catalog/products/silk-dress'
    );
    expect(requestInit().next).toEqual({ revalidate: 60 });
    expect(requestInit().signal).toBeInstanceOf(AbortSignal);
  });

  it('accepts a product with no variants, category or images', async () => {
    const plain = { ...product, category: null, images: [], options: [], variants: [] };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: plain }));

    await expect(getCatalogProduct('silk-dress')).resolves.toEqual(plain);
  });

  it('sends the server token header when configured', async () => {
    vi.stubEnv('CATALOG_SERVER_TOKEN', 'b'.repeat(32));
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: product }));

    await getCatalogProduct('silk-dress');

    expect((requestInit().headers as Record<string, string>)['X-Catalog-Server-Token']).toBe(
      'b'.repeat(32)
    );
  });

  it('encodes the slug into one path segment', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(404, notFoundBody));

    await getCatalogProduct('a/b ?#');

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      'http://localhost:3001/api/v1/catalog/products/a%2Fb%20%3F%23'
    );
  });

  it('returns null on NOT_FOUND', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(404, notFoundBody));

    await expect(getCatalogProduct('missing')).resolves.toBeNull();
  });

  it('returns null on a 400 VALIDATION_ERROR (a malformed slug)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid slug' } })
    );

    await expect(getCatalogProduct('Silk-Midi-Dress')).resolves.toBeNull();
  });

  it('rethrows a 503', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' } })
    );

    const error = await getCatalogProduct('silk-dress').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 503 });
  });

  it('rethrows NETWORK_ERROR', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

    await expect(getCatalogProduct('silk-dress')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('rethrows TIMEOUT', async () => {
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));
    vi.mocked(fetch).mockRejectedValue(new DOMException('timed out', 'TimeoutError'));

    await expect(getCatalogProduct('silk-dress')).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(timeout).toHaveBeenCalledWith(15_000);
    timeout.mockRestore();
  });

  it.each([
    ['variants is not an array', { ...product, variants: {} }],
    ['the price is not a number', { ...product, price: '1250.00' }],
    ['material is not a string', { ...product, material: 1 }],
    ['careEn is missing', { ...product, careEn: undefined }],
    [
      'a variant price is not a number',
      { ...product, variants: [{ ...product.variants[0], price: null }] },
    ],
    [
      'a variant option value is not a string',
      { ...product, variants: [{ ...product.variants[0], options: { size: 1 } }] },
    ],
    ['a variant has no inStock', { ...product, variants: [{ options: { size: 'S' }, price: 1 }] }],
    ['options is missing', { ...product, options: undefined }],
    [
      'an option value is not a string',
      { ...product, options: [{ key: 'size', label: 'Size', values: [1] }] },
    ],
    ['an image has no url', { ...product, images: [{}] }],
    ['inStock is not a boolean', { ...product, inStock: 1 }],
    ['category is malformed', { ...product, category: { slug: 'dresses' } }],
    ['collections is not an array', { ...product, collections: null }],
    ['data is not an object', []],
  ])('throws INVALID_RESPONSE when %s', async (_, data) => {
    const error = await invalidFor(data);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
