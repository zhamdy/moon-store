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
import type { CatalogProductDetail } from '@/features/products/types/catalog-product-detail';
import { localizedName } from '@/features/products/utils/localized-name';
import { fromCatalogDto } from '@/features/products/utils/product-card-model';
import { loadRelatedProducts } from '../api/load-related-products';
import { catalogPath } from '../utils/catalog-path';
import { RELATED_GRID_CLASS, RELATED_GRID_SIZES, catalogStagger } from '../utils/grid-layout';
import { RELATED_LIMIT, relatedRoute } from '../utils/related-scope';

const HEADING_ID = 'related-heading';
const SECTION_CLASS = 'pb-(--section-space)';
const RULE_CLASS = 'border-t border-border pt-12 md:pt-16';

export interface RelatedProductsProps {
  locale: AppLocale;
  product: CatalogProductDetail;
}

/**
 * "Related products" under the product (PD-13), with a line naming the collection or
 * category it draws from, streamed in its own `<Suspense>`. Renders nothing, heading
 * included, when the scope lists nothing but this product or the read fails with an
 * `ApiError`. One Reveal on the list; cards rise (the catalog motion level).
 */
export async function RelatedProducts({ locale, product }: RelatedProductsProps) {
  const related = await loadRelatedProducts(product);
  if (!related) return null;

  const [t, tc, tp] = await Promise.all([
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'catalog' }),
    getTranslations({ locale, namespace: 'products' }),
  ]);
  const name = localizedName(related.scope.entity, locale);
  // Only the scope name may need its own `lang`, so the template is split around it.
  const [before = '', after = ''] = (t.raw('related.description') as string).split('{name}');
  const badgeLabels = { new: tp('new'), soldOut: tp('soldOut') };
  const currencyLabel = tp('currency');
  const priceFromLabel = t.raw('priceFrom') as string;
  const quickAddStrings = await getQuickAddStrings(locale);

  return (
    <Container as="section" aria-labelledby={HEADING_ID} className={SECTION_CLASS}>
      <div className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-4 ${RULE_CLASS}`}>
        <div>
          <h2 id={HEADING_ID} className="type-h2 text-balance">
            {t('related.heading')}
          </h2>
          <p className="type-body mt-2 text-text-secondary">
            {before}
            <span {...(name.lang === locale ? {} : { lang: name.lang, dir: 'auto' as const })}>
              {name.text}
            </span>
            {after}
          </p>
        </div>
        <EditorialLink href={catalogPath(relatedRoute(related.scope))} className="mb-1">
          {tc('collections.explore')}
        </EditorialLink>
      </div>

      <Reveal
        as="ul"
        role="list"
        className={`mt-8 md:mt-10 [--motion-rise:40px] ${RELATED_GRID_CLASS}`}
      >
        {related.items.map((dto, index) => {
          const stagger = catalogStagger(index);
          return (
            <li
              key={dto.slug}
              style={
                stagger === null ? undefined : ({ '--motion-stagger': stagger } as CSSProperties)
              }
            >
              <ProductCard
                product={fromCatalogDto(dto, locale)}
                locale={locale}
                currencyLabel={currencyLabel}
                badgeLabels={badgeLabels}
                priceFromLabel={priceFromLabel}
                sizes={RELATED_GRID_SIZES}
                action={
                  <QuickAdd product={toQuickAddModel(dto, locale)} strings={quickAddStrings} />
                }
              />
            </li>
          );
        })}
      </Reveal>
    </Container>
  );
}

/** The related row's fallback: the heading line and four frames in `ProductGridSkeleton`'s proportions. */
export function RelatedProductsSkeleton() {
  return (
    <Container as="section" aria-hidden="true" className={SECTION_CLASS}>
      <div className={RULE_CLASS}>
        <span className="block h-8 w-56 bg-surface-soft md:h-10" />
      </div>
      <ul role="list" className={`mt-8 md:mt-10 ${RELATED_GRID_CLASS}`}>
        {Array.from({ length: RELATED_LIMIT }, (_, index) => (
          <li key={index}>
            <div className="aspect-4/5 rounded-media bg-surface-soft" />
            {/* The card's caption and its action, at the card's own heights: name and
              price on one baseline, two clamped description lines, a 48px button. */}
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="block h-[1.7rem] w-3/5 bg-surface-soft" />
              <span className="block h-[1.36rem] w-20 bg-surface-soft" />
            </div>
            <span className="mt-1.5 block h-[2.72rem] bg-surface-soft" />
            <span className="mt-4 block h-12 bg-surface-soft" />
          </li>
        ))}
      </ul>
    </Container>
  );
}
