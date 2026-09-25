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
 * The static set is the fallback for **one** condition: the API cannot answer at
 * all. It used to also stand in whenever fewer than four products were
 * *photographed*, which conflated two different questions and made the common
 * production state — a stocked catalogue whose photography has not landed yet —
 * indistinguishable from an outage. A seeded database has no `product_images` rows
 * at all, so that rail was always the static set, showing invented names and eight
 * hard-coded prices as if they were the catalogue (MED-3 in
 * `docs/audits/2026-09-22-shop-cart-fullstack-audit.md`; one figure disagreed with
 * the product's own page by 350 EGP).
 *
 * Real products with no photograph are still the shopper's real pieces: they carry
 * the real name, the real price, a working link and an Add to Bag, over the same
 * `ProductImagePlaceholder` frame the grid and the product page already use for an
 * unphotographed product. That is a catalogue missing its photography, which is
 * true, rather than a catalogue of pieces the store does not sell.
 */

/**
 * Whether this process knows where the API is. A production server with no
 * `API_URL` throws out of `resolveApiBaseUrl` rather than returning an `ApiError`,
 * and `next build` prerenders the homepage in exactly that environment (CI has no
 * API), so the read is skipped instead of caught. Asked through the one authority
 * on the base URL, never by re-reading the environment here.
 */
export function apiConfigured(): boolean {
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
 * `null` only when the API cannot answer — unconfigured, an `ApiError`, or an empty
 * catalogue. An `ApiError` is logged and swallowed, the shape `loadRelatedProducts`
 * already uses. The homepage is the one page that has never needed the API, and a
 * catalog outage must not take down the whole page or fail `next build`; the section
 * falls back to the static set instead. The read carries the listing's own
 * `CATALOG_LIST_TIMEOUT_MS`, so a machine with no API (CI, a fresh clone) reaches
 * that fallback rather than hanging.
 */
export async function loadNewArrivals(): Promise<CatalogProduct[] | null> {
  if (!apiConfigured()) {
    return null;
  }

  try {
    const { items } = await listCatalogProducts(
      toProductQuery(DEFAULT_CATALOG_PARAMS, { kind: 'new' })
    );
    // Server order is kept: this rail is New In's first page, and sorting the
    // photographed pieces forward would stop it meaning "newest".
    return items.length > 0 ? items.slice(0, NEW_ARRIVALS_LIMIT) : null;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(`New Arrivals fell back to the static set: ${error.code} ${error.status}`);
      return null;
    }
    throw error;
  }
}
