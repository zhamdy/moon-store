import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { SectionHeader } from '@/components/ui/section-header';
import { QuickAdd } from '@/features/cart/components/quick-add';
import { getQuickAddStrings } from '@/features/cart/utils/bag-strings';
import { toQuickAddModel } from '@/features/cart/utils/quick-add-model';
import { ProductCard } from '@/features/products/components/product-card';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { fromCatalogDto } from '@/features/products/utils/product-card-model';
import { loadSelection } from '../../api/load-selection';
import { collectionHref, homeCollections } from '../../data/home-collections';

const HEADING_ID = 'moon-selection-title';

const FEATURE_SIZES = '(min-width: 1440px) 660px, (min-width: 1024px) 48vw, 100vw';
const TILE_SIZES = '(min-width: 1440px) 320px, (min-width: 1024px) 23vw, 46vw';

/**
 * 08 - The Moon Selection (homepage Phase 2, 2026-09-25: the Claude Design board and
 * owner decision D3). **Real catalogue pieces now**, the first five of the selection
 * collection (`homeCollections.selection`, today `evening`) in its curated order, with
 * real prices, links and Quick Add — the editorial frames it used to show named no
 * product and read as a broken product grid (plan finding 12). With nothing to show
 * (no API at build, an empty or unreleased collection) the section is not rendered at
 * all: there is no static fallback (see `loadSelection`).
 *
 * Composition, from 1024 on twelve columns: the feature piece as the lead card in 1-6
 * (the display-face name, the product's own copy, a worded action and a details link);
 * two tiles stacked in 7-9, dropped 2.5rem; two more in 10-12, dropped 8.75rem, so the
 * three columns step down like a spread. Below 1024 the feature runs full width and the
 * four sit two by two, the second column dropped. The header is the design system's
 * split `SectionHeader` (title in 1-7, lead and link in 9-12).
 *
 * Commerce register, calm motion: the header rises, the feature's photograph is the
 * section's one image wipe, the tiles fade-rise with the offset column 140ms later.
 * Prices and actions never animate on their own.
 */
export async function MoonSelection({ locale }: { locale: AppLocale }) {
  const dtos = await loadSelection();
  if (!dtos) {
    return null;
  }

  const t = await getTranslations('home.selection');
  const tp = await getTranslations('products');
  const tpr = await getTranslations('product');
  const quickAddStrings = await getQuickAddStrings(locale);
  const [feature, ...rest] = dtos;
  const columns = [rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)];

  const common = {
    locale,
    currencyLabel: tp('currency'),
    badgeLabels: { new: tp('new'), soldOut: tp('soldOut') },
    priceFromLabel: tpr.raw('priceFrom') as string,
  };

  const tile = (dto: CatalogProduct) => {
    const model = fromCatalogDto(dto, locale);
    return (
      <ProductCard
        {...common}
        product={model}
        sizes={TILE_SIZES}
        meta={model.sizeCount ? tp('sizes', { count: model.sizeCount }) : undefined}
        action={<QuickAdd product={toQuickAddModel(dto, locale)} strings={quickAddStrings} />}
      />
    );
  };

  return (
    <Container as="section" aria-labelledby={HEADING_ID} className="section-y">
      <Reveal className="[--motion-rise:24px] [--motion-step:140ms]">
        <SectionHeader
          id={HEADING_ID}
          layout="split"
          size="section"
          motion="calm"
          title={t('title')}
          lead={t('description')}
          action={
            <EditorialLink href={collectionHref(homeCollections.selection)} underline="always">
              {t('link')}
            </EditorialLink>
          }
        />
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 md:gap-x-6 lg:grid-cols-12 lg:gap-x-6">
          <div className="col-span-2 lg:col-span-6">
            <ProductCard
              {...common}
              product={fromCatalogDto(feature, locale)}
              emphasis="lead"
              reveal="image"
              sizes={FEATURE_SIZES}
              detailsLabel={tp('viewDetails')}
              action={
                <QuickAdd
                  product={toQuickAddModel(feature, locale)}
                  strings={quickAddStrings}
                  emphasis="solid"
                />
              }
            />
          </div>
          {columns.map((column, index) =>
            column.length > 0 ? (
              <ul
                key={index}
                role="list"
                className={
                  index === 0
                    ? 'col-span-1 grid content-start gap-y-12 lg:col-span-3 lg:mt-10 lg:gap-y-14'
                    : 'col-span-1 mt-10 grid content-start gap-y-12 lg:col-span-3 lg:mt-35 lg:gap-y-14'
                }
              >
                {column.map((dto) => (
                  // The card carries its own `rise`; the item only sets the stagger step.
                  <li key={dto.slug} style={{ '--motion-stagger': index + 1 } as CSSProperties}>
                    {tile(dto)}
                  </li>
                ))}
              </ul>
            ) : null
          )}
        </div>
      </Reveal>
    </Container>
  );
}
