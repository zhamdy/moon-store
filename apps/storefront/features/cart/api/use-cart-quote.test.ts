import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/errors';
import { shouldRetryQuery } from '@/lib/query/get-query-client';
import { cartLineKey, type CartLine } from '../utils/cart-lines';
import {
  QUOTE_DEBOUNCE_MS,
  cartQuoteQueryKey,
  cartQuoteQueryOptions,
  quoteDebounceDelay,
  selectQuoteLines,
  toCartQuoteFetch,
} from './use-cart-quote';

const A: CartLine = { slug: 'silk-midi-dress', options: { size: 'M', color: 'Ink' }, quantity: 2 };
const B: CartLine = { slug: 'leather-tote', options: {}, quantity: 1 };

function okQuote(lines: readonly CartLine[]) {
  return {
    lines: lines.map((line, index) => ({
      index,
      slug: line.slug,
      status: 'ok',
      product: { slug: line.slug, name: line.slug, nameEn: null, image: null },
      options: [],
      unitPrice: 100,
      requestedQuantity: line.quantity,
      quantity: line.quantity,
      maxQuantity: 10,
      lineTotal: 100 * line.quantity,
    })),
    subtotal: 0,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    maxLineQuantity: 10,
  };
}

describe('cartQuoteQueryOptions', () => {
  it('overrides freshness: staleTime 0, refetchOnMount always, previous data as placeholder', () => {
    const options = cartQuoteQueryOptions([A], true);
    expect(options.staleTime).toBe(0);
    expect(options.refetchOnMount).toBe('always');
    expect(typeof options.placeholderData).toBe('function');
    expect(options.retry).toBe(shouldRetryQuery);
  });

  it('is enabled only when active and non-empty', () => {
    expect(cartQuoteQueryOptions([A], true).enabled).toBe(true);
    expect(cartQuoteQueryOptions([A], false).enabled).toBe(false);
    expect(cartQuoteQueryOptions([], true).enabled).toBe(false);
  });

  it('keys on line keys and quantities only: option order is irrelevant, quantity is not', () => {
    const reordered: CartLine = { ...A, options: { color: 'Ink', size: 'M' } };
    expect(cartQuoteQueryKey([reordered, B])).toEqual(cartQuoteQueryKey([A, B]));
    expect(cartQuoteQueryKey([{ ...A, quantity: 3 }, B])).not.toEqual(cartQuoteQueryKey([A, B]));
    expect(cartQuoteQueryKey([A])[0]).toBe('cart-quote');
    expect(cartQuoteQueryKey([A])[1]).not.toMatch(/\ben\b|\bar\b/);
  });

  it('does not retry 429, 400 or INVALID_RESPONSE; retries network, timeout and 5xx', () => {
    const error = (status: number, code: string) => new ApiError({ status, code, message: '' });
    expect(shouldRetryQuery(0, error(429, 'RATE_LIMITED'))).toBe(false);
    expect(shouldRetryQuery(0, error(400, 'VALIDATION_ERROR'))).toBe(false);
    expect(shouldRetryQuery(0, error(200, 'INVALID_RESPONSE'))).toBe(false);
    expect(shouldRetryQuery(0, error(0, 'NETWORK_ERROR'))).toBe(true);
    expect(shouldRetryQuery(0, error(0, 'TIMEOUT'))).toBe(true);
    expect(shouldRetryQuery(0, error(503, 'SERVICE_UNAVAILABLE'))).toBe(true);
  });
});

describe('cart quote query (integration, no DOM)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('API_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_API_URL', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('fetches again when a surface remounts with an unchanged key, carrying the request line keys', async () => {
    vi.mocked(fetch).mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: okQuote([A, B]) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const client = new QueryClient();

    const first = new QueryObserver(client, cartQuoteQueryOptions([A, B], true));
    const unsubscribe = first.subscribe(() => {});
    await vi.waitFor(() => expect(first.getCurrentResult().status).toBe('success'));
    expect(first.getCurrentResult().data?.lineKeys).toEqual([cartLineKey(A), cartLineKey(B)]);
    unsubscribe();

    const second = new QueryObserver(client, cartQuoteQueryOptions([A, B], true));
    const unsubscribeSecond = second.subscribe(() => {});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    unsubscribeSecond();
    client.clear();
  });

  it('never fetches for an empty bag', async () => {
    const client = new QueryClient();
    const observer = new QueryObserver(client, cartQuoteQueryOptions([], true));
    const unsubscribe = observer.subscribe(() => {});
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
    unsubscribe();
    client.clear();
  });
});

describe('quote debounce', () => {
  it('quotes the first lines at once', () => {
    expect(selectQuoteLines(null, [A])).toEqual([A]);
    expect(quoteDebounceDelay(null, [A])).toBe(0);
  });

  it('holds the last requested lines through a quantity-only change', () => {
    const changed = [{ ...A, quantity: 3 }, B];
    expect(selectQuoteLines([A, B], changed)).toEqual([A, B]);
    expect(quoteDebounceDelay([A, B], changed)).toBe(QUOTE_DEBOUNCE_MS);
  });

  it('quotes an add, remove or rewrite at once', () => {
    expect(selectQuoteLines([A], [A, B])).toEqual([A, B]);
    expect(quoteDebounceDelay([A], [A, B])).toBe(0);
    expect(selectQuoteLines([A, B], [B])).toEqual([B]);
    expect(quoteDebounceDelay([A, B], [B])).toBe(0);
  });

  it('settles at delay 0 once caught up', () => {
    expect(quoteDebounceDelay([A, B], [A, B])).toBe(0);
  });
});

describe('toCartQuoteFetch', () => {
  const base = { enabled: true, error: null } as const;

  it('maps disabled pending to idle and enabled pending to fetching', () => {
    expect(
      toCartQuoteFetch({ ...base, enabled: false, status: 'pending', fetchStatus: 'idle' })
    ).toEqual({ status: 'idle' });
    expect(toCartQuoteFetch({ ...base, status: 'pending', fetchStatus: 'fetching' })).toEqual({
      status: 'fetching',
    });
  });

  it('treats a retry in flight after an error as fetching, a resting error as error', () => {
    const error = new ApiError({ status: 429, code: 'RATE_LIMITED', message: '' });
    expect(toCartQuoteFetch({ ...base, status: 'error', fetchStatus: 'fetching', error })).toEqual({
      status: 'fetching',
    });
    expect(toCartQuoteFetch({ ...base, status: 'error', fetchStatus: 'idle', error })).toEqual({
      status: 'error',
      error,
    });
  });

  it('maps success at rest to settled', () => {
    expect(toCartQuoteFetch({ ...base, status: 'success', fetchStatus: 'idle' })).toEqual({
      status: 'settled',
    });
  });
});
