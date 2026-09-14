import type { CatalogRoute, CatalogSort } from '../search-params';

/**
 * What each listing route is, as data (Unit 12). `catalog-page.tsx` reads this table
 * instead of branching per route, so the four listings cannot drift apart. `/collections`
 * is not here: it lists collections, not products.
 */
export interface CatalogRouteConfig {
  /** The listing API's scope parameter (KD-4); `null` lists every active product. */
  apiScope: 'category' | 'collection' | 'new' | null;
  defaultSort: CatalogSort;
  /** Sort options in display order; `curated` exists only on a collection (R12). */
  sorts: readonly CatalogSort[];
  /** Row 1 under the intro (KD-15): Shop All and category pages only. */
  categoryNav: boolean;
  /**
   * The eyebrow, the only breadcrumb (KD-16): a `catalog.intro.*` key, linked to
   * `href` everywhere but on the page it names.
   */
  eyebrow: { labelKey: 'shop' | 'collections'; href: string | null };
  /** The end-of-listing editorial link (KD-16): a `catalog.wayfinding.*` key. */
  endLink: { labelKey: 'exploreCollections' | 'shopByCategory'; href: string } | null;
}

const LISTING_SORTS = ['newest', 'price-asc', 'price-desc'] as const;

const CATALOG_ROUTES: Record<CatalogRoute['kind'], CatalogRouteConfig> = {
  all: {
    apiScope: null,
    defaultSort: 'newest',
    sorts: LISTING_SORTS,
    categoryNav: true,
    eyebrow: { labelKey: 'shop', href: null },
    endLink: null,
  },
  category: {
    apiScope: 'category',
    defaultSort: 'newest',
    sorts: LISTING_SORTS,
    categoryNav: true,
    eyebrow: { labelKey: 'shop', href: '/shop' },
    endLink: null,
  },
  new: {
    apiScope: 'new',
    defaultSort: 'newest',
    sorts: LISTING_SORTS,
    categoryNav: false,
    eyebrow: { labelKey: 'shop', href: '/shop' },
    // `/shop` carries the category row, so it is where browsing by category starts.
    endLink: { labelKey: 'shopByCategory', href: '/shop' },
  },
  collection: {
    apiScope: 'collection',
    defaultSort: 'curated',
    sorts: ['curated', ...LISTING_SORTS],
    categoryNav: false,
    eyebrow: { labelKey: 'collections', href: '/collections' },
    endLink: { labelKey: 'exploreCollections', href: '/collections' },
  },
};

export function catalogRouteConfig(route: CatalogRoute): CatalogRouteConfig {
  return CATALOG_ROUTES[route.kind];
}
