import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import { ApiError } from '@/lib/api/errors';
import { DEFAULT_CATALOG_PARAMS, toProductQuery } from '../search-params';
import type { ChapterPieces } from '../utils/collection-chapters';

/**
 * A collection's first listing page, for its chapter on the collections index: the pieces
 * in curated order, how many there are and what they cost. It is the same request as page
 * 1 of `/collections/<slug>` (`toProductQuery` with the route defaults), so the two share
 * one data-cache entry and the chapter can never list what the page does not.
 *
 * `null` drops the chapter's credits and price range and keeps the chapter: an
 * `ApiError` is logged, never shown, and one collection's failed read does not take the
 * index down. Anything else is a bug and propagates.
 */
export async function loadCollectionPieces(slug: string): Promise<ChapterPieces | null> {
  try {
    const page = await listCatalogProducts(
      toProductQuery(DEFAULT_CATALOG_PARAMS, { kind: 'collection', slug })
    );
    return {
      items: page.items,
      total: page.pagination.totalItems,
      priceRange: page.priceRange,
    };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(`The "${slug}" chapter shows no pieces: ${error.code} ${error.status}`);
      return null;
    }
    throw error;
  }
}
