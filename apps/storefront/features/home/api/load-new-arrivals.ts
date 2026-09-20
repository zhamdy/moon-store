import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { DEFAULT_CATALOG_PARAMS, toProductQuery } from '@/features/catalog/search-params';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { resolveApiBaseUrl } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

/**
 * How many pieces the homepage rail carries. Enough that the row keeps going past
 * the widest viewport's 4.2 visible cards; short enough that it stays one glance
 * at what is new rather than a listing with no filters.
 */
export const NEW_ARRIVALS_LIMIT = 8;

/**
 * Below this many *photographed* products the static set is simply the better
 * rail. Four is that set's own size (`newArrivals`), so the rule reads: take the
 * catalog only when it can beat what is already here.
 */
export const MIN_PHOTOGRAPHED = 4;

/**
 * Whether this process knows where the API is. A production server with no
 * `API_URL` throws out of `resolveApiBaseUrl` rather than returning an `ApiError`,
 * and `next build` prerenders the homepage in exactly that environment (CI has no
 * API), so the read is skipped instead of caught. Asked through the one authority
 * on the base URL, never by re-reading the environment here.
 */
function apiConfigured(): boolean {
  try {
    return resolveApiBaseUrl() !== '';
  } catch {
    return false;
  }
}

/**
 * The homepage rail's products: New In's first page, exactly as `/new-in` asks for
 * it, so the two share one data-cache entry.
 *
 * `null` when the API cannot answer, **and when what it answers has no
 * photographs** — see `MIN_PHOTOGRAPHED`. An `ApiError` is logged and swallowed, the
 * shape `loadRelatedProducts` already uses. The homepage is the one page that has
 * never needed the API, and a catalog outage must not take down the whole page or
 * fail `next build`; the section falls back to the static set instead. The read
 * carries the listing's own `CATALOG_LIST_TIMEOUT_MS`, so a machine with no API
 * (CI, a fresh clone) reaches that fallback rather than hanging.
 */
export async function loadNewArrivals(): Promise<CatalogProduct[] | null> {
  if (!apiConfigured()) {
    return null;
  }

  try {
    const { items } = await listCatalogProducts(
      toProductQuery(DEFAULT_CATALOG_PARAMS, { kind: 'new' })
    );
    // A catalog with no photographs is not better data than the static set. This
    // section's whole job is the photography, and a seeded database has none
    // (apps/storefront/CLAUDE.md), so "real products" would mean eight brand-mark
    // frames where eight garments should be.
    const photographed = items.filter((item) => item.images.length > 0);
    return photographed.length >= MIN_PHOTOGRAPHED
      ? photographed.slice(0, NEW_ARRIVALS_LIMIT)
      : null;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(`New Arrivals fell back to the static set: ${error.code} ${error.status}`);
      return null;
    }
    throw error;
  }
}
