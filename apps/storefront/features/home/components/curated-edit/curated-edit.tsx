import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import {
  CATALOG_CARD_SIZES,
  LARGE_CARD_SIZES,
  ProductCard,
} from '@/features/products/components/product-card';
import { curatedEdit } from '@/features/products/data/home-products';
import { fromHomeMock } from '@/features/products/utils/product-card-model';
import { SectionHeading } from '../section-heading';

/**
 * The small cards' stagger steps (120ms each here): after the feature card and
 * the heading, beside the feature from 1024, in rows of two below it.
 */
const SMALL_STAGGER = [
  'lg:[--motion-stagger:4]',
  '[--motion-stagger:1] lg:[--motion-stagger:5]',
  'lg:[--motion-stagger:6]',
  '[--motion-stagger:1] lg:[--motion-stagger:7]',
];

/**
 * 08 - The Edit ("one featured item + smaller products", no duplicate treatment
 * of the New Arrivals grid). The first product takes a 2x2 cell; four standard
 * cards fill the rest of the 4x2 desktop grid exactly. On two columns the large
 * card spans both, then the four sit 2x2.
 *
 * Calmer than New Arrivals: shorter rise, longer step. One Reveal plays the
 * feature image first (the section's one editorial beat, `reveal="image"`) and
 * the heading after it; each small card has its own
 * nested Reveal, so on a phone the rows below play when they arrive.
 */
export async function CuratedEdit({ locale }: { locale: AppLocale }) {
  const t = await getTranslations('home.curated');
  const tp = await getTranslations('products');

  return (
    <Container as="section" aria-labelledby="curated-title" className="section-y">
      <Reveal className="[--motion-rise:40px] [--motion-step:120ms]">
        <SectionHeading
          grouped
          offset={250}
          id="curated-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          link={{ href: '/shop', label: t('link') }}
        />
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:mt-14 lg:grid-cols-4 lg:gap-x-8">
          {curatedEdit.map((product, index) => {
            const card = (
              <ProductCard
                product={fromHomeMock(product, locale)}
                locale={locale}
                currencyLabel={tp('currency')}
                badgeLabels={{ new: tp('new'), soldOut: tp('soldOut') }}
                sizes={index === 0 ? LARGE_CARD_SIZES : CATALOG_CARD_SIZES}
                reveal={index === 0 ? 'image' : 'rise'}
              />
            );
            return index === 0 ? (
              <div key={product.slug} className="col-span-2 row-span-2">
                {card}
              </div>
            ) : (
              <Reveal
                key={product.slug}
                className={SMALL_STAGGER[(index - 1) % SMALL_STAGGER.length]}
              >
                {card}
              </Reveal>
            );
          })}
        </div>
      </Reveal>
    </Container>
  );
}
