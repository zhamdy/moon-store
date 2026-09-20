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
import { toProductQuery, type CatalogParams, type CatalogRoute } from '../search-params';
import { catalogEmptyVariant } from '../utils/catalog-empty-state';
import { CATALOG_RESULTS_ID } from '../utils/catalog-path';
import {
  CATALOG_GRID_CLASS,
  CATALOG_GRID_SIZES,
  CATALOG_TOOLBAR_CLASS,
  catalogImageLoading,
  catalogStagger,
} from '../utils/grid-layout';
import { formatResultCount, formatResultsHeading } from '../utils/result-count';
import { CatalogEmpty } from './catalog-empty';
import { CatalogPagination } from './catalog-pagination';

const RESULT_COUNT_ID = 'catalog-result-count';

/** What the controls island (Unit 11) needs from this listing's response. */
export interface CatalogControlsData {
  totalItems: number;
  priceRange: CatalogPriceRange;
}

export interface ProductGridProps {
  route: CatalogRoute;
  /** `loadCatalogParams` output for this route. */
  params: CatalogParams;
  locale: AppLocale;
  /**
   * Renders the controls island as direct items of the utility row (no wrapper; see
   * `catalogControlsRenderer` in `catalog-controls-slot.tsx`). Called only when
   * controls make sense: a listing with products, filters matching nothing, or a
   * page out of range. The island's root carries `data-catalog-controls` (and
   * `data-pending` during a transition) to drive the pending rule in globals.css.
   */
  renderControls?: (data: CatalogControlsData) => ReactNode;
  /** The end-of-listing editorial link (KD-16), shown only when there are products. */
  endLink?: { href: string; label: string };
}

/**
 * The listing, streamed inside `<Suspense fallback={<ProductGridSkeleton/>}>`
 * (KD-10; never keyed by search params, so a filter transition keeps this grid on
 * screen, dimmed). Fetches one page and renders the utility row, the grid or its
 * empty state, pagination and the closing link.
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

  return (
    <Container
      as="section"
      data-catalog=""
      aria-labelledby={CATALOG_RESULTS_ID}
      className="pb-(--section-space)"
    >
      <div className={CATALOG_TOOLBAR_CLASS}>
        {showControls && (
          <p id={RESULT_COUNT_ID} className="type-small text-text-secondary tabular-nums">
            {formatResultCount(t, pagination.totalItems)}
          </p>
        )}
        {/* No wrapper: the island's root is `display: contents`, so its summary,
            Filter and Sort are items of this row and can wrap independently. */}
        {showControls && renderControls?.({ totalItems: pagination.totalItems, priceRange })}
      </div>

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
            className={`mt-6 md:mt-8 [--motion-rise:40px] ${CATALOG_GRID_CLASS}`}
          >
            {items.map((dto, index) => {
              const stagger = catalogStagger(index);
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
                    product={fromCatalogDto(dto, locale)}
                    locale={locale}
                    currencyLabel={currencyLabel}
                    badgeLabels={badgeLabels}
                    priceFromLabel={priceFromLabel}
                    sizes={CATALOG_GRID_SIZES}
                    action={
                      <QuickAdd product={toQuickAddModel(dto, locale)} strings={quickAddStrings} />
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
    </Container>
  );
}
