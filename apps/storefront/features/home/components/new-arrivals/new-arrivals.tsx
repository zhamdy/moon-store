import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import type { AppLocale } from '@/i18n/routing';
import { QuickAdd } from '@/features/cart/components/quick-add';
import { getQuickAddStrings } from '@/features/cart/utils/bag-strings';
import { toQuickAddModel } from '@/features/cart/utils/quick-add-model';
import { ProductCard } from '@/features/products/components/product-card';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { curatedEdit, newArrivals } from '@/features/products/data/home-products';
import {
  fromCatalogDto,
  fromHomeMock,
  type ProductCardModel,
} from '@/features/products/utils/product-card-model';
import { NEW_ARRIVALS_LIMIT, loadNewArrivals } from '../../api/load-new-arrivals';
import { ProductRail } from './product-rail';

const HEADING_ID = 'new-arrivals-title';

/** Equal portrait cards across the full container, with a next-card peek. */
export const RAIL_CARD_SIZES =
  '(min-width: 1300px) 355px, (min-width: 1024px) 29vw, (min-width: 768px) 40vw, 78vw';

const STAGGER_COUNT = 4;
const FALLBACK_PRODUCTS = [...newArrivals, ...curatedEdit].slice(0, NEW_ARRIVALS_LIMIT);

/** Full-width masthead and a uniform, manually browsed product rail. */
export async function NewArrivals({ locale }: { locale: AppLocale }) {
  const t = await getTranslations('home.newArrivals');
  const tp = await getTranslations('products');
  const tpr = await getTranslations('product');
  const quickAddStrings = await getQuickAddStrings(locale);

  const dtos = await loadNewArrivals();
  // Only catalog products carry an Add to Bag: a mock's slug names nothing the API
  // knows, so the fallback rail is photographs and captions (see `fromHomeMock`).
  const products: { key: string; model: ProductCardModel; dto?: CatalogProduct }[] = dtos
    ? dtos.map((dto) => ({ key: dto.slug, model: fromCatalogDto(dto, locale), dto }))
    : FALLBACK_PRODUCTS.map((mock) => ({ key: mock.slug, model: fromHomeMock(mock, locale) }));

  const badgeLabels = { new: tp('new'), soldOut: tp('soldOut') };
  const currencyLabel = tp('currency');
  const priceFromLabel = tpr.raw('priceFrom') as string;

  return (
    <Container as="section" aria-labelledby={HEADING_ID} className="py-16 md:py-20 lg:py-24">
      <Reveal className="[--motion-rise:48px]">
        <ProductRail
          count={products.length}
          labels={{ previous: t('previous'), next: t('next') }}
          heading={
            <div>
              <h2
                id={HEADING_ID}
                data-motion="rise"
                className="type-h2 text-balance [--motion-offset:160ms] [--motion-rise:24px]"
              >
                {t('eyebrow')}
              </h2>
              {/* Only with a real catalog behind it: the line names the thirty-day
                  window the API's `new` scope actually applies. */}
              {dtos && (
                <p
                  data-motion="fade"
                  className="type-small mt-3 max-w-[48ch] text-text-secondary [--motion-offset:320ms]"
                >
                  {t('lead')}
                </p>
              )}
            </div>
          }
          viewAll={
            <div data-motion="fade" className="[--motion-offset:450ms]">
              <EditorialLink href="/new-in" tone="brand">
                {t('link')}
              </EditorialLink>
            </div>
          }
        >
          {products.map(({ key, model, dto }, index) => {
            return (
              <li
                key={key}
                style={
                  index < STAGGER_COUNT
                    ? ({ '--motion-stagger': index } as CSSProperties)
                    : undefined
                }
              >
                <ProductCard
                  product={model}
                  locale={locale}
                  currencyLabel={currencyLabel}
                  badgeLabels={badgeLabels}
                  priceFromLabel={priceFromLabel}
                  sizes={RAIL_CARD_SIZES}
                  captionLayout="stacked"
                  action={
                    dto && (
                      <QuickAdd
                        product={toQuickAddModel(dto, locale)}
                        strings={quickAddStrings}
                        emphasis="brand"
                      />
                    )
                  }
                />
              </li>
            );
          })}
        </ProductRail>
      </Reveal>
    </Container>
  );
}
