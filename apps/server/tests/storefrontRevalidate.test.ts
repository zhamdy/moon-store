import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { revalidateStorefront, storefrontTags } from '../src/storefront/revalidate';

const URL_VAR = 'STOREFRONT_REVALIDATE_URL';
const TOKEN_VAR = 'STOREFRONT_REVALIDATE_TOKEN';

const original = { url: process.env[URL_VAR], token: process.env[TOKEN_VAR] };

beforeEach(() => {
  process.env[URL_VAR] = 'http://storefront.test/api/revalidate';
  process.env[TOKEN_VAR] = 'x'.repeat(32);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (original.url === undefined) delete process.env[URL_VAR];
  else process.env[URL_VAR] = original.url;
  if (original.token === undefined) delete process.env[TOKEN_VAR];
  else process.env[TOKEN_VAR] = original.token;
});

describe('revalidateStorefront', () => {
  it('posts the tags with the shared token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await revalidateStorefront([storefrontTags.products, storefrontTags.product('silk-dress')]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://storefront.test/api/revalidate');
    expect(init.method).toBe('POST');
    expect(init.headers['x-revalidate-token']).toBe('x'.repeat(32));
    expect(JSON.parse(init.body)).toEqual({
      tags: ['catalog:products', 'catalog:product:silk-dress'],
    });
  });

  /**
   * The whole point of the design: publishing a catalogue change must never fail or
   * slow an operator's save because the storefront is down, slow or not deployed.
   */
  it('never throws when the storefront refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(revalidateStorefront([storefrontTags.products])).resolves.toBeUndefined();
  });

  it('never throws when the storefront is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(revalidateStorefront([storefrontTags.products])).resolves.toBeUndefined();
  });

  it('does nothing when no storefront is configured', async () => {
    delete process.env[URL_VAR];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await revalidateStorefront([storefrontTags.products]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing without a token, rather than posting unauthenticated', async () => {
    delete process.env[TOKEN_VAR];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await revalidateStorefront([storefrontTags.products]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing for an empty tag list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await revalidateStorefront([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('carries an abort signal, so a hung storefront cannot hold the write', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await revalidateStorefront([storefrontTags.products]);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});

/**
 * String-coupling twin: `catalogTags` in `apps/storefront/lib/api/catalog.ts`. Neither
 * app may import the other, so the vocabulary is duplicated by hand and both sides must
 * move together (docs/CONVENTIONS.md).
 */
describe('storefrontTags', () => {
  it('spells the tags the storefront tags its fetches with', () => {
    expect(storefrontTags.products).toBe('catalog:products');
    expect(storefrontTags.product('a-slug')).toBe('catalog:product:a-slug');
    expect(storefrontTags.categories).toBe('catalog:categories');
    expect(storefrontTags.collections).toBe('catalog:collections');
    expect(storefrontTags.collection('a-slug')).toBe('catalog:collection:a-slug');
    expect(storefrontTags.storePolicies).toBe('catalog:store-policies');
  });
});
