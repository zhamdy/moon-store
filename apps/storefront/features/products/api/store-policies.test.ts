import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { getStorePolicies } from './get-store-policies';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const POLICIES = {
  delivery: 'توصيل',
  deliveryEn: 'Delivery',
  returns: 'إرجاع',
  returnsEn: null,
};

describe('getStorePolicies', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('API_URL', undefined);
    vi.stubEnv('CATALOG_SERVER_TOKEN', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads the policies with the entity revalidate and no signal', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: POLICIES }));

    await expect(getStorePolicies()).resolves.toEqual(POLICIES);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [
      unknown,
      RequestInit & { next?: unknown },
    ];
    expect(String(url)).toBe('http://localhost:3001/api/v1/catalog/store-policies');
    expect(init.next).toEqual({ revalidate: 300 });
    expect(init.signal).toBeUndefined();
  });

  it('reads a missing field as null', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: { delivery: 'توصيل' } }));

    await expect(getStorePolicies()).resolves.toEqual({
      delivery: 'توصيل',
      deliveryEn: null,
      returns: null,
      returnsEn: null,
    });
  });

  it.each([[{ delivery: 5 }], [{ returnsEn: { text: 'x' } }], [['delivery']], ['delivery']])(
    'rejects %j as INVALID_RESPONSE',
    async (data) => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data }));
      await expect(getStorePolicies()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  );

  it.each([404, 503])('rethrows a %i as an ApiError for the page to contain', async (status) => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(status, { error: { code: 'NOT_FOUND', message: 'Resource not found' } })
    );

    const error = await getStorePolicies().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
  });
});
