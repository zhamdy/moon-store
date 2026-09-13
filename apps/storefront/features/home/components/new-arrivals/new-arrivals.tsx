import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { ProductCard } from '@/features/products/components/product-card';
import { newArrivals } from '@/features/products/data/home-products';
import { SectionHeading } from '../section-heading';

/** Card width in the 4-up desktop grid / 2-up below (guideline §12·03, §16). */
export const CATALOG_CARD_SIZES = '(min-width: 1440px) 320px, (min-width: 1024px) 23vw, 46vw';

/**
 * 03 — New Arrivals. Four columns from 1024, two at 768 and below: four products
 * never leave a 3+1 orphan row.
 */
export async function NewArrivals({ locale }: { locale: AppLocale }) {
  const t = await getTranslations('home.newArrivals');
  const tp = await getTranslations('products');

  return (
    <Container as="section" aria-labelledby="new-arrivals-title" className="section-y">
      <SectionHeading
        id="new-arrivals-title"
        eyebrow={t('eyebrow')}
        title={t('title')}
        link={{ href: '/new-in', label: t('link') }}
      />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:mt-14 lg:grid-cols-4 lg:gap-x-8">
        {newArrivals.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            locale={locale}
            currencyLabel={tp('currency')}
            newLabel={tp('new')}
            sizes={CATALOG_CARD_SIZES}
          />
        ))}
      </div>
    </Container>
  );
}
