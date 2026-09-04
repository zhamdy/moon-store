import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './transport/types';

export function normalizeQueryParams(
  params: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!params) return {};
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  return !(
    error instanceof ApiError &&
    error.status !== null &&
    error.status >= 400 &&
    error.status < 500
  );
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
    mutations: {
      /**
       * A write fired while the browser thinks it is offline must **fail**, not pause.
       *
       * React Query's default `networkMode: 'online'` puts such a mutation in a paused
       * state: no request goes out, so it never rejects, so `onError` never runs. The
       * offline sale queue is written from exactly one place — the checkout's failure
       * handler — so the default made the entire persisted queue unreachable. A sale
       * rung up on a dead link sat in memory, resumed if the tab survived until
       * reconnect, and was lost in silence if the cashier reloaded or the tab closed.
       * That is the case the queue was built for (#30), and it never once ran.
       *
       * `'always'` makes the request be attempted regardless of `navigator.onLine`,
       * which is what the rest of the stack is written to expect: the attempt fails,
       * the failure is classified, and the sale is durably queued and replayed by
       * `useOffline.ts`. It also stops trusting `navigator.onLine` as a gate on whether
       * to try at all — that flag reports a link, not a reachable API, and it is wrong
       * in both directions on captive-portal shop wifi.
       *
       * Retries stay off (the default `retry: 0` for mutations). A write that failed
       * needs an idempotency key and a considered replay, both of which the offline
       * queue already provides; a blind retry here would race it.
       */
      networkMode: 'always',
    },
  },
});
