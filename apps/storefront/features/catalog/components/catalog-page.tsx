import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogCategory } from '@/features/collections/types/catalog-category';
import type { LocalizedText } from '@/features/products/utils/localized-name';
import type { CatalogParams, CatalogRoute } from '../search-params';
import { catalogRouteConfig } from '../utils/catalog-route';
import { catalogIntroHeadings, type IntroPage } from '../utils/intro-heading';
import { catalogControlsRenderer } from './catalog-controls-slot';
import { CategoryNav } from './category-nav';
import { PageIntro, type PageIntroProps } from './page-intro';
import { ProductGrid } from './product-grid';
import { ProductGridSkeleton } from './product-grid-skeleton';

export interface CatalogPageProps {
  route: CatalogRoute;
  /** `loadCatalogParams(searchParams, route)`. */
  params: CatalogParams;
  locale: AppLocale;
  /**
   * The intro minus its headings, which `catalogIntroHeadings` derives from the route.
   * `name` is the category's or collection's localized name, required on those routes.
   */
  intro: Omit<PageIntroProps, 'locale' | 'headings'> & { name?: LocalizedText };
  /** Needed where the route table turns category nav on. */
  categories?: CatalogCategory[];
}

/**
 * The one listing composition (Unit 12), driven by `catalogRouteConfig`: intro,
 * category nav where enabled, then the grid streamed inside `<Suspense>`.
 *
 * KD-10 invariants a caller must keep: the page resolves its entity and calls
 * `notFound()` *before* rendering this, so a 404 is sent before anything streams; no
 * `loading.tsx` sits at or above a catalog segment; and the Suspense boundary is never
 * keyed, so a filter transition keeps the old grid (dimmed) instead of the skeleton.
 * The pending hook `[data-catalog]` is on `ProductGrid`'s own section, which holds both
 * the controls island and the grid. Nothing here renders a header boundary: catalog
 * pages keep the solid header.
 */
export async function CatalogPage({ route, params, locale, intro, categories }: CatalogPageProps) {
  const config = catalogRouteConfig(route);
  const t = await getTranslations('catalog');
  const renderControls = await catalogControlsRenderer({ route, locale, sorts: config.sorts });
  const { name, ...introRest } = intro;
  let page: IntroPage;
  if (route.kind === 'category' || route.kind === 'collection') {
    if (!name) throw new Error(`CatalogPage: a ${route.kind} intro needs its name`);
    page = { kind: route.kind, name };
  } else {
    page = { kind: route.kind };
  }

  return (
    <>
      <PageIntro
        locale={locale}
        headings={catalogIntroHeadings(page, await introLabels(), locale)}
        {...introRest}
      />
      {config.categoryNav && categories && (
        <CategoryNav
          categories={categories}
          activeSlug={route.kind === 'category' ? route.slug : null}
          locale={locale}
          label={t('categoryNav.label')}
          allLabel={t('categoryNav.all')}
        />
      )}
      <Suspense fallback={<ProductGridSkeleton loadingLabel={t('loading')} />}>
        <ProductGrid
          route={route}
          params={params}
          locale={locale}
          renderControls={renderControls}
          endLink={
            config.endLink
              ? { href: config.endLink.href, label: t(`wayfinding.${config.endLink.labelKey}`) }
              : undefined
          }
        />
      </Suspense>
    </>
  );
}

/** The `catalog.intro.*` strings `catalogIntroHeadings` chooses from. */
export async function introLabels() {
  const t = await getTranslations('catalog.intro');
  return {
    shop: t('shop'),
    collections: t('collections'),
    allPieces: t('shopTitle'),
    newIn: t('newInTitle'),
  };
}
