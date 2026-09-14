import 'server-only';
import { apiFetch, type ApiFetchResult } from './client';

/** Next data-cache lifetimes (KD-9): product lists churn with stock, entities rarely change. */
export const CATALOG_REVALIDATE = {
  list: 60,
  entity: 300,
} as const;

export const CATALOG_SERVER_TOKEN_HEADER = 'X-Catalog-Server-Token';

export interface CatalogFetchOptions {
  /**
   * Only for a request fetched once per render. Any signal opts the fetch out of
   * per-render memoization, so an entity read shared by `generateMetadata` and the page
   * must never pass one (both would hit the API).
   */
  timeoutMs?: number;
}

/** The product list's deadline: a `TIMEOUT` ApiError reaches the (catalog) error boundary. */
export const CATALOG_LIST_TIMEOUT_MS = 15_000;

/**
 * The one way catalog reads reach the API. Server-only: the token routes SSR traffic
 * to the API's trusted rate-limit bucket (KD-5) and must never reach a browser bundle.
 * Deliberately no `credentials` (catalog reads are anonymous) and no default
 * `timeoutMs`: category and collection reads are shared between `generateMetadata` and
 * the page, and a signal would make each hit the API. The product list is the exception
 * -- only ProductGrid fetches it, once per render, so its timeout costs no memoization.
 */
export function catalogFetch<T>(
  path: string,
  revalidate: number,
  options: CatalogFetchOptions = {}
): Promise<ApiFetchResult<T>> {
  const token = process.env.CATALOG_SERVER_TOKEN;
  return apiFetch<T>(path, {
    headers: token ? { [CATALOG_SERVER_TOKEN_HEADER]: token } : undefined,
    next: { revalidate },
    timeoutMs: options.timeoutMs,
  });
}
