import { useEffect, useState } from 'react';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { shouldRetryQuery } from '@/lib/query/get-query-client';
import type { CartSnapshot } from '../store/cart-store';
import type { CartQuoteResult } from '../types/cart-quote';
import { cartLineKey, type CartLine } from '../utils/cart-lines';
import { cartQuoteKey, type CartQuoteFetch } from '../utils/reconcile';
import { quoteCart } from './quote-cart';

/**
 * The quote hook (CD-9). Thin on purpose: every decision is a pure, tested function here or
 * in `reconcile.ts`, because the storefront has no DOM test harness.
 */

/** How long a quantity-only change waits before it re-quotes; stepper presses coalesce. */
export const QUOTE_DEBOUNCE_MS = 300;

const EMPTY_LINES: readonly CartLine[] = [];

function sameLineKeys(a: readonly CartLine[], b: readonly CartLine[]): boolean {
  return a.length === b.length && a.every((line, i) => cartLineKey(line) === cartLineKey(b[i]!));
}

/**
 * Which lines to quote now. A change of quantities alone keeps quoting the last requested
 * lines until the debounce fires; any add, remove or canonical rewrite quotes at once.
 */
export function selectQuoteLines(
  requested: readonly CartLine[] | null,
  current: readonly CartLine[]
): readonly CartLine[] {
  return requested !== null && sameLineKeys(requested, current) ? requested : current;
}

export function quoteDebounceDelay(
  requested: readonly CartLine[] | null,
  current: readonly CartLine[]
): number {
  if (requested === null || !sameLineKeys(requested, current)) return 0;
  return cartQuoteKey(requested) === cartQuoteKey(current) ? 0 : QUOTE_DEBOUNCE_MS;
}

export function cartQuoteQueryKey(lines: readonly CartLine[]) {
  return ['cart-quote', cartQuoteKey(lines)] as const;
}

/**
 * `staleTime: 0` and `refetchOnMount: 'always'` override the app's 60s default, so reopening
 * a bag surface never shows a minute-old quote; `placeholderData` keeps the previous quote
 * on screen while a new key loads. Retry is the app policy (network, timeout, 5xx only).
 */
export function cartQuoteQueryOptions(lines: readonly CartLine[], enabled: boolean) {
  const key = cartQuoteKey(lines);
  const lineKeys = lines.map(cartLineKey);
  return queryOptions({
    queryKey: cartQuoteQueryKey(lines),
    queryFn: async ({ signal }): Promise<CartQuoteResult> => ({
      key,
      lineKeys,
      quote: await quoteCart(lines, { signal }),
    }),
    enabled: enabled && lines.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    retry: shouldRetryQuery,
  });
}

export interface QueryStateInput {
  enabled: boolean;
  status: 'pending' | 'error' | 'success';
  fetchStatus: 'fetching' | 'paused' | 'idle';
  error: unknown;
}

/** Maps TanStack's two status axes onto the reconcile model's one. */
export function toCartQuoteFetch(query: QueryStateInput): CartQuoteFetch {
  if (query.fetchStatus === 'fetching') return { status: 'fetching' };
  if (query.status === 'error') return { status: 'error', error: query.error };
  if (query.status === 'success') return { status: 'settled' };
  return query.enabled ? { status: 'fetching' } : { status: 'idle' };
}

export interface CartQuoteState {
  /** The latest quote on screen, possibly for an older key; compare `result.key`. */
  result: CartQuoteResult | undefined;
  fetch: CartQuoteFetch;
  retry(): void;
  /**
   * Re-quotes the current query key and resolves once that fetch settles, success or failure
   * (the outcome is read from `fetch`). During the quantity debounce the current key can still
   * be the previous lines; Checkout's submit machine closes that gap with a key check (CO-14).
   */
  refresh(): Promise<void>;
}

/** A refetch as a promise that always resolves: callers read the result from query state. */
export function settleRefetch(refetch: () => Promise<unknown>): Promise<void> {
  return refetch().then(
    () => undefined,
    () => undefined
  );
}

/**
 * `active` is true while a bag surface (drawer body or bag page) is mounted: the quote is
 * never fetched on other pages.
 */
export function useCartQuote(snapshot: CartSnapshot, active: boolean): CartQuoteState {
  const lines = snapshot.hydrated ? snapshot.lines : EMPTY_LINES;
  const [requested, setRequested] = useState<readonly CartLine[] | null>(null);

  // The store keeps `lines` referentially stable between commits, so this restarts only on a
  // bag change; once `requested` catches up the delay is 0 and the set is a no-op.
  useEffect(() => {
    const timer = setTimeout(() => setRequested(lines), quoteDebounceDelay(requested, lines));
    return () => clearTimeout(timer);
  }, [lines, requested]);

  const quoteLines = selectQuoteLines(requested, lines);
  const enabled = snapshot.hydrated && active;
  const query = useQuery(cartQuoteQueryOptions(quoteLines, enabled));

  return {
    result: query.data,
    fetch: toCartQuoteFetch({
      enabled: enabled && quoteLines.length > 0,
      status: query.status,
      fetchStatus: query.fetchStatus,
      error: query.error,
    }),
    retry: () => {
      void query.refetch();
    },
    refresh: () => settleRefetch(() => query.refetch()),
  };
}
