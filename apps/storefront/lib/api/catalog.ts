import 'server-only';
import { apiFetch, type ApiFetchResult } from './client';

/** Next data-cache lifetimes (KD-9): product lists churn with stock, entities rarely change. */
export const CATALOG_REVALIDATE = {
  list: 60,
  entity: 300,
} as const;

export const CATALOG_SERVER_TOKEN_HEADER = 'X-Catalog-Server-Token';

/**
 * The one way catalog reads reach the API. Server-only: the token routes SSR traffic
 * to the API's trusted rate-limit bucket (KD-5) and must never reach a browser bundle.
 * Deliberately no `credentials` (catalog reads are anonymous) and no `timeoutMs`: a
 * signal would opt the fetch out of per-render memoization, so `generateMetadata` and
 * the page would each hit the API.
 */
export function catalogFetch<T>(path: string, revalidate: number): Promise<ApiFetchResult<T>> {
  const token = process.env.CATALOG_SERVER_TOKEN;
  return apiFetch<T>(path, {
    headers: token ? { [CATALOG_SERVER_TOKEN_HEADER]: token } : undefined,
    next: { revalidate },
  });
}
