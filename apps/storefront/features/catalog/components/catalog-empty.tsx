import { getTranslations } from 'next-intl/server';
import { EditorialLink } from '@/components/ui/editorial-link';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils/cn';
import type { CatalogParams, CatalogRoute } from '../search-params';
import type { CatalogEmptyVariant } from '../utils/catalog-empty-state';
import { catalogClearFiltersHref, catalogPageHref } from '../utils/catalog-path';

export interface CatalogEmptyProps {
  variant: CatalogEmptyVariant;
  route: CatalogRoute;
  params: CatalogParams;
  /** The heading level under the page's structure; `h3` beneath the grid's `h2`. */
  headingLevel?: 'h2' | 'h3';
  /** With no toolbar above it, the panel's top lines up with the index column's. */
  flush?: boolean;
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
 * Centred in a Stone panel that takes the grid's place ("Atelier", owner feedback
 * 2026-09-26): start-aligned, the state floated in the top corner of an empty rack beside
 * a tall index column and read as a layout fault. The panel is the packshot mat's tone,
 * an empty rack rather than a card, and keeps a minimum height so the page does not
 * collapse under the toolbar. Behind the design system's crescent ornament: the copy says
 * what happened and the link says what to do. Promises nothing about restock dates or
 * delivery.
 */
export async function CatalogEmpty({
  variant,
  route,
  params,
  headingLevel: Heading = 'h3',
  flush = false,
}: CatalogEmptyProps) {
  const t = await getTranslations('catalog.empty');

  return (
    <div
      data-catalog-empty=""
      className={cn(
        'mt-4 flex min-h-[22rem] items-center justify-center bg-surface-media px-6 md:min-h-[26rem] lg:min-h-[30rem]',
        flush ? 'lg:mt-1' : 'lg:mt-8'
      )}
    >
      <EmptyState
        align="center"
        titleAs={Heading}
        title={t(`${variant}.title`)}
        body={t(`${variant}.body`)}
        actions={
          <EditorialLink href={actionHref(variant, route, params)} underline="always">
            {t(`${variant}.action`)}
          </EditorialLink>
        }
      />
    </div>
  );
}
