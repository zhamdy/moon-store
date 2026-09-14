import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { ApiError } from '@/lib/api/errors';
import { pickRelated, relatedQuery, relatedScope, type RelatedScope } from '../utils/related-scope';

export interface RelatedProducts {
  scope: RelatedScope;
  items: CatalogProduct[];
}

/**
 * The related row's data, or `null` when there is nothing to show. An `ApiError` is logged
 * and yields `null`, so a failed related read never replaces a loaded product with the
 * catalog error screen (PD-13); anything else is a bug and propagates.
 */
export async function loadRelatedProducts(product: {
  slug: string;
  category: RelatedScope['entity'] | null;
  collections: RelatedScope['entity'][];
}): Promise<RelatedProducts | null> {
  const scope = relatedScope(product);
  if (!scope) return null;

  try {
    const { items } = await listCatalogProducts(relatedQuery(scope));
    const picked = pickRelated(items, product.slug);
    return picked.length > 0 ? { scope, items: picked } : null;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(
        `Related products for "${product.slug}" (${scope.kind} "${scope.slug}") failed: ${error.code} ${error.status}`
      );
      return null;
    }
    throw error;
  }
}
