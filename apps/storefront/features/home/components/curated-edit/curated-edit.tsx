import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Container } from '@/components/ui/container';
import { ProductCard } from '@/features/products/components/product-card';
import { curatedEdit } from '@/features/products/data/home-products';
import { CATALOG_CARD_SIZES } from '../new-arrivals/new-arrivals';
import { SectionHeading } from '../section-heading';

const LARGE_CARD_SIZES = '(min-width: 1440px) 672px, (min-width: 1024px) 48vw, 92vw';

/**
 * 08 — The Edit (guideline §12·08: "one featured item + smaller products", no
 * duplicate treatment of the New Arrivals grid). The first product takes a 2×2
 * cell; four standard cards fill the rest of the 4×2 desktop grid exactly. On
 * two columns the large card spans both, then the four sit 2×2.
 */
export async function CuratedEdit({ locale }: { locale: AppLocale }) {
  const t = await getTranslations('home.curated');
  const tp = await getTranslations('products');

  return (
    <Container as="section" aria-labelledby="curated-title" className="section-y">
      <SectionHeading
        id="curated-title"
        eyebrow={t('eyebrow')}
        title={t('title')}
        link={{ href: '/shop', label: t('link') }}
      />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:mt-14 lg:grid-cols-4 lg:gap-x-8">
        {curatedEdit.map((product, index) => (
          <ProductCard
            key={product.slug}
            product={product}
            locale={locale}
            currencyLabel={tp('currency')}
            newLabel={tp('new')}
            sizes={index === 0 ? LARGE_CARD_SIZES : CATALOG_CARD_SIZES}
            className={index === 0 ? 'col-span-2 row-span-2' : undefined}
          />
        ))}
      </div>
    </Container>
  );
}
