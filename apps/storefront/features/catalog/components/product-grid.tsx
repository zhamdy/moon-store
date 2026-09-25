import type { CSSProperties, ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import type { AppLocale } from '@/i18n/routing';
import { QuickAdd } from '@/features/cart/components/quick-add';
import { getQuickAddStrings } from '@/features/cart/utils/bag-strings';
import { toQuickAddModel } from '@/features/cart/utils/quick-add-model';
import { listCatalogProducts } from '@/features/products/api/list-catalog-products';
import { ProductCard } from '@/features/products/components/product-card';
import type { CatalogPriceRange } from '@/features/products/types/catalog-product';
import { fromCatalogDto } from '@/features/products/utils/product-card-model';
import { cn } from '@/lib/utils/cn';
import { toProductQuery, type CatalogParams, type CatalogRoute } from '../search-params';
import { catalogEmptyVariant } from '../utils/catalog-empty-state';
import { CATALOG_RESULTS_ID } from '../utils/catalog-path';
import {
  CATALOG_GRID_CLASS,
  CATALOG_GRID_SIZES,
  CATALOG_INDEX_CLASS,
  CATALOG_LAYOUT_CLASS,
  catalogImageLoading,
  catalogStagger,
} from '../utils/grid-layout';
import { formatResultsHeading } from '../utils/result-count';
import { CatalogEmpty } from './catalog-empty';
import { CatalogPagination } from './catalog-pagination';

const RESULT_COUNT_ID = 'catalog-result-count';

/** What the controls island (Unit 11) needs from this listing's response. */
export interface CatalogControlsData {
  /** The toolbar above the grid, or the index column's inline filters (from 1024). */
  layout: 'toolbar' | 'index';
  /** The toolbar's count carries this id; the grid is described by it. */
  countId?: string;
  totalItems: number;
  priceRange: CatalogPriceRange;
  /**
   * What the **server** resolved this URL to. The controls island reads the URL through
   * nuqs, which takes a repeated key's first *occurrence*, while the loader takes its
   * first *valid* value — so `?sort=best&sort=price-asc` sorted the grid while the
   * control showed the default, and the next interaction serialized that default and
   * silently dropped the filter in effect (MED-4).
   */
  resolved: CatalogParams;
}

export interface ProductGridProps {
  route: CatalogRoute;
  /** `loadCatalogParams` output for this route. */
  params: CatalogParams;
  locale: AppLocale;
  /**
   * Renders the controls island (`catalogControlsRenderer` in
   * `catalog-controls-slot.tsx`), once as the toolbar and once as the index column's
   * filters. Called only when controls make sense: a listing with products, filters
   * matching nothing, or a page out of range. The island's root carries `data-catalog-controls` (and
   * `data-pending` during a transition) to drive the pending rule in globals.css.
   */
  renderControls?: (data: CatalogControlsData) => ReactNode;
  /** The end-of-listing editorial link (KD-16), shown only when there are products. */
  endLink?: { href: string; label: string };
  /**
   * The category nav (`CategoryNav`, server-rendered by `CatalogPage`), at the top of
   * the index column: chips above the rack below 1024, a list beside it from 1024.
   * The skeleton renders the same node, so nothing in the column moves as this streams.
   */
  indexNav?: ReactNode;
}

/**
 * The listing, streamed inside `<Suspense fallback={<ProductGridSkeleton/>}>`
 * (KD-10; never keyed by search params, so a filter transition keeps this grid on
 * screen, dimmed). Fetches one page and renders the "Atelier" layout (owner decision
 * 2026-09-26): from 1024 the index column (categories, then the inline filters) beside
 * the rack (toolbar, grid or its empty state, pagination, closing link); below 1024
 * the category chips above the rack, whose toolbar sticks under the header.
 *
 * Semantics: the section is labelled by a visually hidden `h2#catalog-results`
 * (the pagination target, `tabIndex=-1`); the grid is a `ul role="list"` described
 * by the result count. Cards are `h3`s inside `article`s.
 *
 * Motion (R21): one Reveal on the `ul`, each card rising, staggered for the first
 * eight only. `decideInitialRevealState` only holds back a grid entirely below the
 * fold, so a filter re-render never replays the entrance.
 */
export async function ProductGrid({
  route,
  params,
  locale,
  renderControls,
  endLink,
  indexNav,
}: ProductGridProps) {
  const { items, pagination, priceRange } = await listCatalogProducts(
    toProductQuery(params, route)
  );
  const t = await getTranslations('catalog');
  const tp = await getTranslations('products');
  const tpr = await getTranslations('product');
  // Resolved once for the page, not per card: the island takes strings, never the
  // catalogue (the client boundary rule).
  const quickAddStrings = await getQuickAddStrings(locale);

  const variant = catalogEmptyVariant({
    route,
    // Sort alone never empties a listing, so it is not a filter here.
    hasFilters: params.stock !== null || params.min !== null || params.max !== null,
    page: params.page,
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
  });
  const showControls = variant === null || variant === 'filtered' || variant === 'outOfRange';
  const badgeLabels = { new: tp('new'), soldOut: tp('soldOut') };
  const currencyLabel = tp('currency');
  const priceFromLabel = tpr.raw('priceFrom') as string;

  const controlsData = { totalItems: pagination.totalItems, priceRange, resolved: params };
  const hasIndex = Boolean(indexNav) || (showControls && Boolean(renderControls));

  return (
    <Container
      as="section"
      data-catalog=""
      aria-labelledby={CATALOG_RESULTS_ID}
      className={cn('pb-(--section-space)', hasIndex && CATALOG_LAYOUT_CLASS)}
    >
      {hasIndex && (
        <div data-catalog-index="" className={CATALOG_INDEX_CLASS}>
          {indexNav}
          {showControls && renderControls && (
            <div className={cn('hidden lg:block', indexNav && 'lg:mt-10')}>
              {renderControls({ ...controlsData, layout: 'index' })}
            </div>
          )}
        </div>
      )}

      <div className={cn('min-w-0', indexNav && 'mt-4 lg:mt-0')}>
        {showControls &&
          renderControls?.({ ...controlsData, layout: 'toolbar', countId: RESULT_COUNT_ID })}

        <h2 id={CATALOG_RESULTS_ID} tabIndex={-1} className="sr-only">
          {formatResultsHeading(t, params.page, pagination.totalPages)}
        </h2>

        {variant ? (
          <CatalogEmpty variant={variant} route={route} params={params} />
        ) : (
          <>
            <Reveal
              as="ul"
              role="list"
              data-catalog-grid=""
              aria-describedby={RESULT_COUNT_ID}
              className={`mt-4 lg:mt-8 [--motion-rise:40px] ${CATALOG_GRID_CLASS}`}
            >
              {items.map((dto, index) => {
                const stagger = catalogStagger(index);
                const model = fromCatalogDto(dto, locale);
                return (
                  <li
                    key={dto.slug}
                    style={
                      stagger === null
                        ? undefined
                        : ({ '--motion-stagger': stagger } as CSSProperties)
                    }
                  >
                    <ProductCard
                      product={model}
                      meta={model.sizeCount ? tp('sizes', { count: model.sizeCount }) : undefined}
                      locale={locale}
                      currencyLabel={currencyLabel}
                      badgeLabels={badgeLabels}
                      priceFromLabel={priceFromLabel}
                      sizes={CATALOG_GRID_SIZES}
                      action={
                        <QuickAdd
                          product={toQuickAddModel(dto, locale)}
                          strings={quickAddStrings}
                        />
                      }
                      {...catalogImageLoading(index)}
                    />
                  </li>
                );
              })}
            </Reveal>

            <CatalogPagination route={route} params={params} pagination={pagination} />

            {endLink && (
              <div className="mt-16 flex justify-center md:mt-20">
                <EditorialLink href={endLink.href}>{endLink.label}</EditorialLink>
              </div>
            )}
          </>
        )}
      </div>
    </Container>
  );
}
