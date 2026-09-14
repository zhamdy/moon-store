import { serializeCatalogParams, type CatalogParams, type CatalogRoute } from '../search-params';

/** The heading every page link targets (the grid's visually hidden `h2`). */
export const CATALOG_RESULTS_ID = 'catalog-results';

/** Locale-less path for a catalog route; `@/i18n/navigation`'s `Link` adds the prefix. */
export function catalogPath(route: CatalogRoute): string {
  switch (route.kind) {
    case 'all':
      return '/shop';
    case 'category':
      return `/shop/${encodeURIComponent(route.slug)}`;
    case 'collection':
      return `/collections/${encodeURIComponent(route.slug)}`;
    case 'new':
      return '/new-in';
  }
}

/** Path plus the serialized params (defaults omitted), optionally with a fragment. */
export function catalogHref(
  route: CatalogRoute,
  params: Partial<CatalogParams>,
  hash?: string
): string {
  return `${catalogPath(route)}${serializeCatalogParams(params, route)}${hash ? `#${hash}` : ''}`;
}

/** Page `page` of the current listing: filters and sort kept, landing on the results. */
export function catalogPageHref(route: CatalogRoute, params: CatalogParams, page: number): string {
  return catalogHref(route, { ...params, page }, CATALOG_RESULTS_ID);
}

/** The same listing with every filter removed; sort is kept (it is not a filter). */
export function catalogClearFiltersHref(route: CatalogRoute, params: CatalogParams): string {
  return catalogHref(route, { sort: params.sort });
}
