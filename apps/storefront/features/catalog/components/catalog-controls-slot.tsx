import { Suspense, type ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { formatAmount } from '@/features/products/utils/price';
import type { CatalogRoute, CatalogSort } from '../search-params';
import { catalogRouteConfig } from '../utils/catalog-route';
import { formatResultCount } from '../utils/result-count';
import { CatalogControls, type CatalogControlsStrings } from './catalog-controls';
import type { CatalogControlsData } from './product-grid';

const SORT_LABEL_KEYS = {
  newest: 'newest',
  'price-asc': 'priceAsc',
  'price-desc': 'priceDesc',
  curated: 'curated',
} as const satisfies Record<CatalogSort, string>;

export interface CatalogControlsRendererOptions {
  route: CatalogRoute;
  locale: AppLocale;
  /** Defaults to the route table's sorts (`catalogRouteConfig`). */
  sorts?: readonly CatalogSort[];
}

/**
 * Server side of the controls island: resolves every string once, then returns the
 * `renderControls` function `ProductGrid` calls with the listing's total and price
 * range. The island sits in `<Suspense>` because nuqs reads search params; the
 * fallback is an empty 44px box, and the utility row's reserved height keeps the
 * grid still either way.
 *
 * ```tsx
 * const renderControls = await catalogControlsRenderer({ route, locale });
 * <ProductGrid route={route} params={params} locale={locale} renderControls={renderControls} />
 * ```
 */
export async function catalogControlsRenderer({
  route,
  locale,
  sorts = catalogRouteConfig(route).sorts,
}: CatalogControlsRendererOptions): Promise<(data: CatalogControlsData) => ReactNode> {
  const t = await getTranslations('catalog');
  const tp = await getTranslations('products');
  const currencyLabel = tp('currency');

  const sortOptions = sorts.map((value) => ({ value, label: t(`sort.${SORT_LABEL_KEYS[value]}`) }));
  const baseStrings: Omit<CatalogControlsStrings, 'priceHint'> = {
    filter: t('filters.open'),
    filterActive: t.raw('filters.activeCount') as string,
    sheetTitle: t('filters.title'),
    close: t('filters.close'),
    availability: t('filters.availability'),
    inStockOnly: t('filters.inStockOnly'),
    inStock: t('filters.inStock'),
    price: t('filters.price'),
    min: t('filters.min'),
    max: t('filters.max'),
    priceNumberError: t('filters.priceNumberError'),
    priceOrderError: t('filters.priceOrderError'),
    clearAll: t('filters.clearAll'),
    apply: t('filters.apply'),
    summaryLabel: t('filters.summaryLabel'),
    remove: t.raw('filters.remove') as string,
    clear: t('filters.clear'),
    priceSummary: {
      between: t.raw('filters.priceBetween') as string,
      from: t.raw('filters.priceFrom') as string,
      upTo: t.raw('filters.priceUpTo') as string,
    },
    sort: t('sort.label'),
  };

  return function renderCatalogControls({ totalItems, priceRange }: CatalogControlsData) {
    const { min, max } = priceRange;
    const priceHint =
      min !== null && max !== null
        ? t('filters.priceHint', {
            min: formatAmount(min, locale),
            max: formatAmount(max, locale),
            currency: currencyLabel,
          })
        : null;

    return (
      <Suspense fallback={<div aria-hidden="true" className="ms-auto h-11" />}>
        <CatalogControls
          route={route}
          locale={locale}
          currencyLabel={currencyLabel}
          resultCountText={formatResultCount(t, totalItems)}
          sortOptions={sortOptions}
          pricePlaceholders={{
            min: min === null ? '' : String(min),
            max: max === null ? '' : String(max),
          }}
          strings={{ ...baseStrings, priceHint }}
        />
      </Suspense>
    );
  };
}
