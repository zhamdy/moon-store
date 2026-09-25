import { getTranslations } from 'next-intl/server';
import { EditorialLink } from '@/components/ui/editorial-link';
import { EmptyState } from '@/components/ui/empty-state';
import type { CatalogParams, CatalogRoute } from '../search-params';
import type { CatalogEmptyVariant } from '../utils/catalog-empty-state';
import { catalogClearFiltersHref, catalogPageHref } from '../utils/catalog-path';

export interface CatalogEmptyProps {
  variant: CatalogEmptyVariant;
  route: CatalogRoute;
  params: CatalogParams;
  /** The heading level under the page's structure; `h3` beneath the grid's `h2`. */
  headingLevel?: 'h2' | 'h3';
}

function actionHref(variant: CatalogEmptyVariant, route: CatalogRoute, params: CatalogParams) {
  switch (variant) {
    case 'catalog':
      return '/';
    case 'filtered':
      return catalogClearFiltersHref(route, params);
    case 'outOfRange':
      return catalogPageHref(route, params, 1);
    case 'collection':
    case 'category':
      return '/shop';
  }
}

/**
 * Every non-error empty listing (R15), each with exactly one action:
 * - `catalog`: nothing live yet, back to the homepage;
 * - `filtered`: filters match nothing, "Clear filters" keeps the sort;
 * - `outOfRange`: past the last page, to page 1 with filters kept;
 * - `collection` / `category`: a known scope with no active products, to `/shop`.
 *
 * Start-aligned in the grid's place, like the 404 page, behind the design system's
 * crescent ornament: the copy says what happened and the link says what to do. Promises nothing about
 * restock dates or delivery.
 */
export async function CatalogEmpty({
  variant,
  route,
  params,
  headingLevel: Heading = 'h3',
}: CatalogEmptyProps) {
  const t = await getTranslations('catalog.empty');

  return (
    <EmptyState
      titleAs={Heading}
      title={t(`${variant}.title`)}
      body={t(`${variant}.body`)}
      actions={
        <EditorialLink href={actionHref(variant, route, params)} underline="always">
          {t(`${variant}.action`)}
        </EditorialLink>
      }
    />
  );
}
