import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { langProps, localizedName, localizedText } from '../utils/localized-name';
import { formatPrice } from '../utils/price';
import { productLead } from '../utils/product-details-model';

export interface ProductDetailProps {
  locale: AppLocale;
  product: CatalogProductDetail;
  /** Listing hrefs built by the page, so this slice never imports `features/catalog`. */
  hrefs: { category: string | null; collections: Record<string, string> };
  /** The breadcrumb row above the split. */
  breadcrumb?: ReactNode;
  /** The image column (Unit 5). Omitted: an empty 4:5 frame holds its place. */
  gallery?: ReactNode;
  /** Price, availability and options (Unit 6). Omitted: the static price and status. */
  purchase?: ReactNode;
  /** The details tabs, full container width under the split. */
  details?: ReactNode;
  /** The related row under the product (Unit 7), in its own Suspense. */
  related?: ReactNode;
}

const LINK_HOVER =
  'underline-offset-4 transition-colors duration-fast ease-ui hover:text-text hover:underline';

/**
 * The product page layout: breadcrumb, then a 50/50 split from 1024 with a sticky info
 * column (PD-15), one column below, then the details tabs and the related row. The
 * gallery column carries no Reveal, since it holds the LCP image.
 *
 * The info column holds only what decides a purchase: category eyebrow, name, a short
 * lead (the description's first paragraph; the full text is the Description tab), the
 * purchase slot, a glance at material and fit (the full list is the Details tab) and
 * "Part of" links. `[data-product-action]` is the reserved Add to Bag
 * place (PD-B): empty, no copy, and outside the purchase slot, so the island that
 * replaces the static summary never owns it. Hover lives on the links, the entrance on
 * their parents.
 */
export async function ProductDetail({
  locale,
  product,
  hrefs,
  breadcrumb,
  gallery,
  purchase,
  details,
  related,
}: ProductDetailProps) {
  const [t, tp] = await Promise.all([
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'products' }),
  ]);
  const name = localizedName(product, locale);
  const lead = productLead(product, locale);
  const category = product.category ? localizedName(product.category, locale) : null;
  const facts = [
    {
      key: 'material' as const,
      value: localizedText(product.material, product.materialEn, locale),
    },
    { key: 'fit' as const, value: localizedText(product.fit, product.fitEn, locale) },
  ].flatMap(({ key, value }) => (value ? [{ key, value }] : []));
  // Only the collection name is the link, so the template is split around its placeholder.
  const [partOfBefore = '', partOfAfter = ''] = (t.raw('partOf') as string).split('{collection}');

  return (
    <>
      <Container className="pt-6 pb-16 md:pt-8 lg:pb-24">
        {breadcrumb && <div className="mb-6 lg:mb-8">{breadcrumb}</div>}

        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-16">
          <div>{gallery ?? <div aria-hidden className="aspect-4/5 w-full bg-surface-soft" />}</div>

          <Reveal className="mt-8 max-w-[30rem] lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:mt-0">
            {hrefs.category && category && (
              <p data-motion="fade" className="type-label text-text-secondary">
                <Link
                  href={hrefs.category}
                  {...langProps(category, locale)}
                  className={`-my-3 inline-block py-3 ${LINK_HOVER}`}
                >
                  {category.text}
                </Link>
              </p>
            )}
            <h1
              {...langProps(name, locale)}
              data-motion="rise"
              className="type-h2 mt-3 text-balance [--motion-offset:120ms] [--motion-rise:24px]"
            >
              {name.text}
            </h1>

            {lead && (
              <p
                {...langProps(lead, locale)}
                data-motion="fade"
                className="type-body mt-4 max-w-[34rem] whitespace-pre-line text-text-secondary [--motion-offset:200ms]"
              >
                {lead.text}
              </p>
            )}

            <div data-product-purchase className="mt-6">
              {purchase ?? (
                <>
                  <p className="type-body-lg tabular-nums">
                    {formatPrice(product.price, locale, tp('currency'))}
                  </p>
                  <p className="type-small mt-2 text-text-secondary">
                    {product.inStock ? t('availability.inStock') : t('availability.soldOut')}
                  </p>
                </>
              )}
            </div>

            <div data-product-action className="mt-8" />

            {facts.length > 0 && (
              <dl className="type-small mt-8 space-y-2 border-t border-border pt-6">
                {facts.map(({ key, value }) => (
                  <div key={key} className="grid grid-cols-[7rem_1fr] gap-x-4">
                    <dt className="text-text-secondary">{t(`details.${key}`)}</dt>
                    <dd {...langProps(value, locale)} className="text-text">
                      {value.text}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {product.collections.length > 0 && (
              <ul className="type-small mt-8 space-y-2 text-text-secondary">
                {product.collections.map((collection) => {
                  const collectionName = localizedName(collection, locale);
                  return (
                    <li key={collection.slug}>
                      {partOfBefore}
                      <Link
                        href={hrefs.collections[collection.slug]}
                        {...langProps(collectionName, locale)}
                        className={`underline ${LINK_HOVER}`}
                      >
                        {collectionName.text}
                      </Link>
                      {partOfAfter}
                    </li>
                  );
                })}
              </ul>
            )}
          </Reveal>
        </div>

        {details && <div className="mt-16 lg:mt-24">{details}</div>}
      </Container>
      {related}
    </>
  );
}
