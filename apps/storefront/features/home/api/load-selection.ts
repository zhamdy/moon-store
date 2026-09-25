import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { DEFAULT_CATALOG_PARAMS, toProductQuery } from '@/features/catalog/search-params';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { ApiError } from '@/lib/api/errors';
import { homeCollections } from '../data/home-collections';
import { apiConfigured } from './load-new-arrivals';

/** One feature piece and four beside it: the section's composition. */
export const SELECTION_LIMIT = 5;

/**
 * The Moon Selection's pieces (homepage Phase 2, owner decision 2026-09-25): the first
 * five of `homeCollections.selection`, read through the ordinary listing in the
 * collection's own curated order — exactly the first page `/collections/<slug>` asks
 * for, so the two share one data-cache entry and the page stays prerendered on the
 * listing's revalidate. No API change.
 *
 * **`null` hides the section.** There is no static fallback: the old editorial frames
 * named no product (HIGH-1), and a section called a selection that shows none of the
 * shop's pieces is worse than no section. Null when the API is unconfigured (CI's
 * `next build`), when it answers with an `ApiError` (logged; a missing or unreleased
 * collection is a 404), or when the collection is empty.
 */
export async function loadSelection(): Promise<CatalogProduct[] | null> {
  if (!apiConfigured()) {
    return null;
  }

  try {
    const { items } = await listCatalogProducts(
      toProductQuery(DEFAULT_CATALOG_PARAMS, {
        kind: 'collection',
        slug: homeCollections.selection,
      })
    );
    return items.length > 0 ? items.slice(0, SELECTION_LIMIT) : null;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(`The Moon Selection is hidden: ${error.code} ${error.status}`);
      return null;
    }
    throw error;
  }
}
