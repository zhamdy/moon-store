import 'server-only';
import { apiFetch, type ApiFetchResult } from './client';

/** Next data-cache lifetimes (KD-9): product lists churn with stock, entities rarely change. */
export const CATALOG_REVALIDATE = {
  list: 60,
  entity: 300,
} as const;

export const CATALOG_SERVER_TOKEN_HEADER = 'X-Catalog-Server-Token';

/**
 * Cache tags for on-demand invalidation. The TTL alone cannot express a withdrawal:
 * Next writes its data cache only on `res.status === 200`, so once a product is
 * deactivated the revalidation receives the API's 404, the entry is never replaced,
 * and the stale 200 is served **indefinitely** — measured at 64 consecutive samples
 * over 16 minutes on a production build (HIGH-2). Deletion cannot be expressed by the
 * absence of a cache entry; it has to be pushed.
 *
 * `products` is every list (a withdrawal changes what a listing contains, whichever
 * scope it was fetched under), and the entity tags are per slug.
 */
export const catalogTags = {
  products: 'catalog:products',
  product: (slug: string) => `catalog:product:${slug}`,
  categories: 'catalog:categories',
  collections: 'catalog:collections',
  collection: (slug: string) => `catalog:collection:${slug}`,
  storePolicies: 'catalog:store-policies',
} as const;

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
  tags: string[],
  options: CatalogFetchOptions = {}
): Promise<ApiFetchResult<T>> {
  const token = process.env.CATALOG_SERVER_TOKEN;
  return apiFetch<T>(path, {
    headers: token ? { [CATALOG_SERVER_TOKEN_HEADER]: token } : undefined,
    next: { revalidate, tags },
    timeoutMs: options.timeoutMs,
  });
}
