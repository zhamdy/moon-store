import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { CATALOG_CARD_SIZES, ProductCard } from '@/features/products/components/product-card';
import { newArrivals } from '@/features/products/data/home-products';
import { SectionHeading } from '../section-heading';

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
