import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { CATALOG_CARD_SIZES, ProductCard } from '@/features/products/components/product-card';
import { newArrivals } from '@/features/products/data/home-products';
import { SectionHeading } from '../section-heading';

/**
 * Each card's stagger step, by column: a row always arrives in reading order,
 * 0/80ms in the two-column grid and 0/80/160/240ms in the four-column one.
 */
const CARD_STAGGER = [
  '',
  '[--motion-stagger:1]',
  'lg:[--motion-stagger:2]',
  '[--motion-stagger:1] lg:[--motion-stagger:3]',
];

/**
 * 03 - New Arrivals. Four columns from 1024, two at 768 and below: four products
 * never leave a 3+1 orphan row. Each card is its own Reveal, so a second row on a
 * phone plays when it arrives rather than off-screen with the first.
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
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 [--motion-rise:64px] lg:mt-14 lg:grid-cols-4 lg:gap-x-8">
        {newArrivals.map((product, index) => (
          <Reveal key={product.slug} className={CARD_STAGGER[index % CARD_STAGGER.length]}>
            <ProductCard
              product={product}
              locale={locale}
              currencyLabel={tp('currency')}
              newLabel={tp('new')}
              sizes={CATALOG_CARD_SIZES}
            />
          </Reveal>
        ))}
      </div>
    </Container>
  );
}
