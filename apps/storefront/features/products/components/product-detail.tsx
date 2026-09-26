import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { langProps, localizedName } from '../utils/localized-name';
import { formatPrice } from '../utils/price';
import { ProductImagePlaceholder } from './product-image-placeholder';

export interface ProductDetailProps {
  locale: AppLocale;
  product: CatalogProductDetail;
  /** The breadcrumb row above the split. */
  breadcrumb?: ReactNode;
  /** The image column. Omitted: an empty 4:5 frame holds its place. */
  gallery?: ReactNode;
  /** Price, lead, options and the action. Omitted: the static price and status. */
  purchase?: ReactNode;
  /** The facts list and the folds under the action (`ProductInfo`). */
  details?: ReactNode;
  /** The share row, last in the info column. */
  share?: ReactNode;
  /** "More from {collection}" under the product, in its own Suspense. */
  related?: ReactNode;
}

/**
 * The product page layout ("In its chapter", owner decision 2026-09-26): breadcrumb, then
 * the page's twelve columns from 1024, the gallery on six and the info column on five
 * (from the eighth, so one column of air separates them), sticky under the header (PD-15);
 * one column below. The info column reads name, then the purchase slot (price and status,
 * the lead, options, Add to Bag), then the facts list and folds, then share, so the
 * description is said once and nothing sits between the price and the sizes. The row of
 * the collection's pieces follows the Container.
 *
 * The gallery column carries no Reveal, since it holds the LCP image. Add to Bag is not
 * placed here: the page composes it into the purchase panel's `action` slot (CD-11).
 */
export async function ProductDetail({
  locale,
  product,
  breadcrumb,
  gallery,
  purchase,
  details,
  share,
  related,
}: ProductDetailProps) {
  const [t, tp] = await Promise.all([
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'products' }),
  ]);
  const name = localizedName(product, locale);

  return (
    <>
      <Container className="pt-5 pb-16 md:pt-8 lg:pb-24">
        {breadcrumb && <div className="mb-5 lg:mb-8">{breadcrumb}</div>}

        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-6">
          <div className="lg:col-span-6">
            {gallery ?? (
              <div className="relative -mx-(--page-gutter) aspect-4/5 bg-surface-media md:mx-0">
                <ProductImagePlaceholder />
              </div>
            )}
          </div>

          <Reveal className="mt-7 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:col-span-5 lg:col-start-8 lg:mt-0 lg:pt-2">
            <h1
              {...langProps(name, locale)}
              data-motion="rise"
              className="type-page-title text-balance [--motion-rise:24px]"
            >
              {name.text}
            </h1>

            <div data-product-purchase className="mt-4">
              {purchase ?? (
                <p className="type-body-lg font-medium tabular-nums">
                  {formatPrice(product.price, locale, tp('currency'))}
                  <span className="type-supporting ms-4 text-text-secondary">
                    {product.inStock ? t('availability.inStock') : t('availability.soldOut')}
                  </span>
                </p>
              )}
            </div>

            {details && <div className="mt-8">{details}</div>}

            {share && <div className={details ? 'mt-3' : 'mt-8'}>{share}</div>}
          </Reveal>
        </div>
      </Container>
      {related}
    </>
  );
}
