import { getTranslations } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import {
  CATALOG_CARD_SIZES,
  LARGE_CARD_SIZES,
  ProductCard,
} from '@/features/products/components/product-card';
import { curatedEdit } from '@/features/products/data/home-products';
import { fromHomeMock } from '@/features/products/utils/product-card-model';

const HEADING_ID = 'moon-selection-title';

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
 * 08 - The Moon Selection ("one featured item + smaller products", no duplicate
 * treatment of the New Arrivals grid). The first product takes a 2x2 cell; four
 * standard cards fill the rest of the 4x2 desktop grid exactly. On two columns the
 * large card spans both, then the four sit 2x2.
 *
 * Calmer than New Arrivals: shorter rise, longer step. One Reveal plays the feature
 * image first (the section's one editorial beat, `reveal="image"`) and the heading
 * after it; each small card has its own nested Reveal, so on a phone the rows below
 * play when they arrive.
 *
 * **The grid is the section's original structure, kept on purpose** (owner decision,
 * 2026-09-21). An asymmetric spread was built against the redesign brief - five
 * hand-placed frames at four different crops, sharing nothing with `ProductCard` - and
 * the owner preferred this one after seeing it. What survived that pass is the copy and
 * the heading; the composition went back. If a spread is ever wanted again it is in the
 * history at `cebe648`, not deleted work to redo from scratch.
 *
 * **The heading is this section's own, not `SectionHeading`.** It runs the title at
 * `type-h1 lg:type-display` over a gold hairline, where that shared component sets
 * `type-h2` - the brief asked for a significantly stronger heading block, and widening
 * `SectionHeading` would have handed that size to every commerce section on the page.
 * It is still two levels, title and description: the brief's first pass named a
 * "Curated by Moon" eyebrow above them and it was removed the same day (owner decision,
 * 2026-09-21), so the 2026-09-14 no-eyebrows rule holds across the whole page again.
 *
 * **The five frames are editorial photography, not catalogue entries**
 * (`features/products/data/home-products.ts`). They carry no link, no price, no badge,
 * no description and no Add to Bag, because they name no product: the earlier mocks
 * were written to mirror the seed's vocabulary and drifted from it, so three of this
 * section's five tiles published a product link that 404'd on every deploy (HIGH-1 in
 * `docs/audits/2026-09-22-shop-cart-fullstack-audit.md`). A photograph and a caption is
 * the honest state; real commerce data on this page comes from the catalog DTO.
 */
export async function MoonSelection({ locale }: { locale: AppLocale }) {
  const t = await getTranslations('home.selection');
  const tp = await getTranslations('products');

  return (
    <Container as="section" aria-labelledby={HEADING_ID} className="section-y">
      <Reveal className="[--motion-rise:40px] [--motion-step:120ms]">
        <header className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <div className="lg:max-w-[46rem]">
            {/* The section's opening mark, in the eyebrow's place: a gold hairline says
                a chapter starts here and costs no words in either language. */}
            <span
              aria-hidden="true"
              data-motion="fade"
              className="block h-px w-10 bg-metallic [--motion-offset:370ms]"
            />
            <h2
              id={HEADING_ID}
              data-motion="rise"
              className="type-h1 mt-6 text-balance lg:type-display [--motion-offset:470ms] [--motion-rise:24px]"
            >
              {t('title')}
            </h2>
            {/* `ch` is right here and wrong on a display heading: this paragraph is set
                in the body face at its own size, which is what `ch` resolves against. */}
            <p
              data-motion="fade"
              className="type-body-lg mt-5 max-w-[52ch] text-text-secondary [--motion-offset:610ms]"
            >
              {t('description')}
            </p>
          </div>
          <div data-motion="fade" className="mb-1 [--motion-offset:750ms]">
            <EditorialLink href="/shop" tone="brand">
              {t('link')}
            </EditorialLink>
          </div>
        </header>
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
              <div key={product.id} className="col-span-2 row-span-2">
                {card}
              </div>
            ) : (
              <Reveal
                key={product.id}
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
