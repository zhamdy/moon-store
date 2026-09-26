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
import { langProps, localizedName } from '@/features/products/utils/localized-name';
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
 * "More from {collection}" under the product ("In its chapter", owner decision 2026-09-26;
 * the scope is PD-13's, so a piece in no collection reads "More from {category}"), up to
 * four cards and "Explore {name}", streamed in its own `<Suspense>`. Renders nothing,
 * heading included, when the scope lists nothing but this product or the read fails with
 * an `ApiError`. One Reveal on the list; cards rise (the catalog motion level).
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
  // Only the scope name may need its own `lang`, so each template is split around it.
  const named = (template: string) => {
    const [before = '', after = ''] = template.split('{name}');
    // One span, so a flex parent (the link) sees one item and keeps the spaces.
    return (
      <span>
        {before}
        <span {...langProps(name, locale)}>{name.text}</span>
        {after}
      </span>
    );
  };
  const badgeLabels = { new: tp('new'), soldOut: tp('soldOut') };
  const currencyLabel = tp('currency');
  const priceFromLabel = t.raw('priceFrom') as string;
  const quickAddStrings = await getQuickAddStrings(locale);

  return (
    <Container as="section" aria-labelledby={HEADING_ID} className={SECTION_CLASS}>
      <div
        className={`flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 ${RULE_CLASS}`}
      >
        <h2 id={HEADING_ID} className="type-page-title text-balance">
          {named(t.raw('related.heading') as string)}
        </h2>
        <EditorialLink href={catalogPath(relatedRoute(related.scope))}>
          {named(tc.raw('collections.exploreName') as string)}
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
            {/* Card A's compact caption at its own line heights: name, price. */}
            <span className="mt-3.5 block h-[1.375rem] w-3/5 bg-surface-soft" />
            <span className="mt-1 block h-[1.375rem] w-24 bg-surface-soft" />
          </li>
        ))}
      </ul>
    </Container>
  );
}
