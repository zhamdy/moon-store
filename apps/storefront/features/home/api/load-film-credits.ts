import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { DEFAULT_CATALOG_PARAMS, toProductQuery } from '@/features/catalog/search-params';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { ApiError } from '@/lib/api/errors';
import { homeCollections } from '../data/home-collections';
import { apiConfigured } from './load-new-arrivals';

/** The credits row under the film's opening frame: four pieces. */
export const CREDITS_LIMIT = 4;

/**
 * The film's credits (homepage "Shop the Film", 2026-09-26): the first four pieces of the
 * collection the opening frame shows (`homeCollections.film`), in its curated order, read
 * through the ordinary listing — the same first page `/collections/<slug>` asks for, so
 * the page stays prerendered on the listing's revalidate. No API change.
 *
 * **`null` hides the credits row.** There is no static fallback: a row of pieces the shop
 * does not sell is the HIGH-1 mistake. Null when the API is unconfigured (CI's `next
 * build`), when it answers with an `ApiError` (logged; a missing or unreleased collection
 * is a 404), or when the collection is empty.
 */
export async function loadFilmCredits(): Promise<CatalogProduct[] | null> {
  if (!apiConfigured()) {
    return null;
  }

  try {
    const { items } = await listCatalogProducts(
      toProductQuery(DEFAULT_CATALOG_PARAMS, {
        kind: 'collection',
        slug: homeCollections.film,
      })
    );
    return items.length > 0 ? items.slice(0, CREDITS_LIMIT) : null;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(`The film credits are hidden: ${error.code} ${error.status}`);
      return null;
    }
    throw error;
  }
}
