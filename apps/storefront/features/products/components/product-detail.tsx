import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import { localizedDescription, localizedName, type LocalizedText } from '../utils/localized-name';
import { formatPrice } from '../utils/price';

export interface ProductDetailProps {
  locale: AppLocale;
  product: CatalogProductDetail;
  /** Listing hrefs built by the page, so this slice never imports `features/catalog`. */
  hrefs: { category: string | null; collections: Record<string, string> };
  /** The image column (Unit 5). Omitted: an empty 4:5 frame holds its place. */
  gallery?: ReactNode;
  /** Price, availability and options (Unit 6). Omitted: the static price and status. */
  purchase?: ReactNode;
  /** The related row under the product (Unit 7), in its own Suspense. */
  related?: ReactNode;
}

/** Only set `lang`/`dir` when the text is not in the page's language (KD-13). */
function langProps(text: LocalizedText, locale: AppLocale) {
  return text.lang === locale ? {} : { lang: text.lang, dir: 'auto' as const };
}

const LINK_HOVER =
  'underline-offset-4 transition-colors duration-fast ease-ui hover:text-text hover:underline';

/**
 * The product page layout: a 7/5 split from 1024 with a sticky info column (PD-15), one
 * column below. The gallery column carries no Reveal, since it holds the LCP image.
 *
 * `[data-product-action]` is the reserved Add to Bag place (PD-B): empty, no copy, and
 * outside the purchase slot, so the island that replaces the static summary never owns
 * it. Hover lives on the links, the entrance on their parents.
 */
export async function ProductDetail({
  locale,
  product,
  hrefs,
  gallery,
  purchase,
  related,
}: ProductDetailProps) {
  const [t, tp] = await Promise.all([
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'products' }),
  ]);
  const name = localizedName(product, locale);
  const description = localizedDescription(product, locale);
  const category = product.category ? localizedName(product.category, locale) : null;
  // Only the collection name is the link, so the template is split around its placeholder.
  const [partOfBefore = '', partOfAfter = ''] = (t.raw('partOf') as string).split('{collection}');

  return (
    <>
      <Container className="pt-6 pb-16 md:pt-10 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:pt-12 lg:pb-24">
        <div className="lg:col-span-7">
          {gallery ?? <div aria-hidden className="aspect-4/5 w-full bg-surface-soft" />}
        </div>

        <Reveal className="mt-8 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:col-span-5 lg:mt-0">
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
            className="type-h1 mt-4 text-balance [--motion-offset:120ms] [--motion-rise:24px]"
          >
            {name.text}
          </h1>

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

          {description && (
            <div
              {...langProps(description, locale)}
              className="type-body mt-10 max-w-[38rem] space-y-4 border-t border-border pt-8 text-text-secondary"
            >
              {description.text
                .split(/\n\s*\n/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
            </div>
          )}
        </Reveal>
      </Container>
      {related}
    </>
  );
}
