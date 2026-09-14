import type { CatalogRoute } from '../search-params';

export type CatalogEmptyVariant = 'catalog' | 'filtered' | 'outOfRange' | 'collection' | 'category';

export interface CatalogEmptyInput {
  route: CatalogRoute;
  /** `hasNonDefaultRefinements` on the parsed params. */
  hasFilters: boolean;
  page: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Which empty state a listing shows, or `null` when it has products to show.
 * An out-of-range page is checked first: the listing has products, just not on
 * this page. With no products at all, active refinements explain it before the
 * scope does, since clearing them is the one thing the shopper can change.
 */
export function catalogEmptyVariant({
  route,
  hasFilters,
  page,
  totalItems,
  totalPages,
}: CatalogEmptyInput): CatalogEmptyVariant | null {
  if (totalItems > 0) return page > Math.max(totalPages, 1) ? 'outOfRange' : null;
  if (hasFilters) return 'filtered';
  if (route.kind === 'collection') return 'collection';
  if (route.kind === 'category') return 'category';
  return 'catalog';
}
