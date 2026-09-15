import type { CatalogProductContext } from '@/features/products/types/catalog-product-detail';
import {
  DEFAULT_CATALOG_PARAMS,
  toProductQuery,
  type CatalogProductQuery,
  type CatalogRoute,
} from '../search-params';

export const RELATED_LIMIT = 4;

export type RelatedScope =
  | { kind: 'collection'; slug: string; sort: 'curated'; entity: CatalogProductContext }
  | { kind: 'category'; slug: string; sort: 'newest'; entity: CatalogProductContext };

/** PD-13: the first collection in the DTO's order, else the category, else nothing. */
export function relatedScope(product: {
  category: CatalogProductContext | null;
  collections: CatalogProductContext[];
}): RelatedScope | null {
  const [collection] = product.collections;
  if (collection) {
    return { kind: 'collection', slug: collection.slug, sort: 'curated', entity: collection };
  }
  if (product.category) {
    return {
      kind: 'category',
      slug: product.category.slug,
      sort: 'newest',
      entity: product.category,
    };
  }
  return null;
}

export function relatedRoute(scope: RelatedScope): CatalogRoute {
  return { kind: scope.kind, slug: scope.slug };
}

/**
 * The scope's listing page 1 with no refinements, built exactly as that page builds it, so
 * the related read and the listing share one data-cache entry.
 */
export function relatedQuery(scope: RelatedScope): CatalogProductQuery {
  return toProductQuery(DEFAULT_CATALOG_PARAMS, relatedRoute(scope));
}

export function pickRelated<T extends { slug: string }>(
  items: readonly T[],
  currentSlug: string,
  limit = RELATED_LIMIT
): T[] {
  return items.filter((item) => item.slug !== currentSlug).slice(0, limit);
}
