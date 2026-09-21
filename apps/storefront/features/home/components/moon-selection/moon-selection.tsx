import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { productHref } from '@/features/products/utils/product-card-model';
import { formatPrice } from '@/features/products/utils/price';
import { selectionFeature, selectionSupporting } from '../../data/moon-selection';
import { SelectionFrame } from './selection-frame';
import { SelectionTile } from './selection-tile';

const HEADING_ID = 'moon-selection-title';

/**
 * 08 - The Moon Selection (owner brief, 2026-09-21), replacing The Edit's four-up grid
 * with a feature card in it.
 *
 * The section it replaces was a product listing with one card enlarged: five
 * `ProductCard`s in a 4x2 grid, the same unit New Arrivals renders. That is what made it
 * read as a second commerce row rather than a chapter. This one is a **spread**: one
 * dominant piece, four supporting ones at four different crops, placed rather than
 * tiled, with the editorial weight in the photography, the typography and the air
 * between them. Nothing here is a card - no border, no shadow, no plate, no badge, no
 * Quick Add, no wishlist.
 *
 * **It reuses no part of `ProductCard` on purpose.** That component is the commerce
 * tile: a 4:5 frame on sand, a badge printed on the photograph, a clamped description
 * and an action slot, all of it tuned to keep a *row* of tiles level. Every one of those
 * properties is something this brief asked not to have, and bending the shared card into
 * a second personality would have cost both surfaces their clarity. The two share what
 * they should share - the photograph-with-alternate-view mechanic, the
 * `[data-product-card]` / `[data-product-name]` hover rule, `productHref` and
 * `formatPrice` - and nothing else. `ProductCard` is untouched, so New Arrivals, Shop
 * and the related row are too.
 *
 * **The three-level heading is a deliberate exception** to the 2026-09-14 "no eyebrows"
 * decision (owner brief, 2026-09-21, which names all three levels and their copy). This
 * is the one section on the page that carries an eyebrow, a display title and a
 * description; `SectionHeading`'s two-level rule still governs everywhere else, which is
 * also why this composes its own header rather than widening that component.
 *
 * **On the pieces.** The five are exactly the ones this section already carried, from
 * `features/products/data/home-products.ts`, with their existing names, prices,
 * photographs and routes. They are static mocks, and two of their slugs and one of their
 * prices do not match the seeded catalogue. That predates this brief, is shared with the
 * New Arrivals fallback rail, and is left alone here rather than corrected inside a
 * redesign - see the repository CLAUDE.md's Learnings entry.
 *
 * **The feature carries no description**, and that is the brief's own instruction
 * followed rather than a gap: `HomeProductMock` exposes none, the real copy for these
 * pieces lives in the catalogue behind slugs two of these mocks do not use, and writing
 * a sentence here would be inventing product copy. The line appears the day the section
 * reads the catalogue, or the day the mocks agree with it.
 */
export async function MoonSelection({ locale }: { locale: AppLocale }) {
  const t = await getTranslations('home.selection');
  const tp = await getTranslations('products');
  const currencyLabel = tp('currency');
  const feature = selectionFeature.product;
  const [besideA, besideB, belowA, belowB] = selectionSupporting;

  return (
    <Container as="section" aria-labelledby={HEADING_ID} className="section-y">
      <Reveal>
        <header className="flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
          <div className="lg:max-w-[46rem]">
            <p
              data-motion="fade"
              className="type-caption uppercase tracking-[0.22em] text-brand rtl:tracking-normal [--motion-offset:120ms]"
            >
              {t('eyebrow')}
            </p>
            <span
              aria-hidden="true"
              data-motion="fade"
              className="mt-5 block h-px w-10 bg-metallic [--motion-offset:220ms]"
            />
            <h2
              id={HEADING_ID}
              data-motion="rise"
              className="type-h1 mt-6 text-balance lg:type-display [--motion-offset:300ms] [--motion-rise:24px]"
            >
              {t('title')}
            </h2>
            {/* An absolute measure would be wrong here and `ch` is right: the paragraph
                is set in the body face at its own size, which is exactly what `ch`
                resolves against. The rule this page has been bitten by is the opposite
                one - a `ch` on a wrapper around a display heading. */}
            <p
              data-motion="fade"
              className="type-body-lg mt-5 max-w-[52ch] text-text-secondary [--motion-offset:440ms]"
            >
              {t('description')}
            </p>
          </div>
          <div data-motion="fade" className="mb-1 [--motion-offset:580ms]">
            <EditorialLink href="/shop" tone="brand">
              {t('link')}
            </EditorialLink>
          </div>
        </header>
      </Reveal>

      {/* The spread. Two bands rather than one grid: the feature and the column beside
          it balance each other at roughly equal height, then the pair below opens back
          out to the full measure. `items-start` is what lets the ratios differ - every
          frame keeps its own height instead of being stretched to its neighbour's. */}
      <Reveal className="mt-12 lg:mt-20" amount={0.2}>
        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8">
          <article data-product-card="" className="group relative lg:col-span-7">
            <SelectionFrame
              primary={feature.images.a}
              secondary={feature.images.b}
              frame={selectionFeature.frame}
              sizes={selectionFeature.sizes}
              reveal="image"
            />
            <div
              data-motion="fade"
              className="mt-6 lg:mt-8 lg:max-w-[34rem] [--motion-offset:420ms]"
            >
              <h3 className="type-h4 font-medium text-balance text-text lg:type-h3">
                {/* The one navigation link on the feature: its ::after covers the whole
                    article, so the photograph opens the piece too. */}
                <Link
                  href={productHref(feature.slug)}
                  className="after:absolute after:inset-0 after:content-['']"
                >
                  <span data-product-name="">{feature.name[locale]}</span>
                </Link>
              </h3>
              <p className="type-body mt-3 font-medium tabular-nums tracking-[0.02em] text-text">
                {formatPrice(feature.price, locale, currencyLabel)}
              </p>
              {/* Above the card overlay, the same layering that keeps a control out of
                  an anchor on `ProductCard`. A feature card is the one register allowed
                  a second anchor to its own page (the 2026-09-20 lead-card decision):
                  it has the width to place it, and it is one extra tab stop on one
                  piece rather than on all five. */}
              <div className="relative z-10 mt-6 inline-flex">
                <EditorialLink href={productHref(feature.slug)} tone="brand">
                  {tp('viewDetails')}
                </EditorialLink>
              </div>
            </div>
          </article>

          {/* The column beside the feature, set a little lower than it so the two never
              start on one line. Under RTL the grid counts columns from the right, so the
              composition mirrors while the photographs do not. */}
          <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-10 min-[420px]:grid-cols-2 lg:col-span-4 lg:col-start-9 lg:mt-12 lg:grid-cols-1 lg:gap-y-12">
            <SelectionTile
              piece={besideA}
              locale={locale}
              currencyLabel={currencyLabel}
              className="[--motion-offset:120ms]"
            />
            <SelectionTile
              piece={besideB}
              locale={locale}
              currencyLabel={currencyLabel}
              className="min-[420px]:mt-10 lg:mt-0 [--motion-offset:260ms]"
            />
          </div>
        </div>

        {/* The closing pair, flush to both margins with three columns of air between
            them. The second hangs lower than the first, the same beat the column above
            plays against the feature. */}
        <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-10 min-[420px]:grid-cols-2 lg:mt-24 lg:grid-cols-12 lg:gap-x-8">
          <SelectionTile
            piece={belowA}
            locale={locale}
            currencyLabel={currencyLabel}
            className="lg:col-span-5 [--motion-offset:120ms]"
          />
          <SelectionTile
            piece={belowB}
            locale={locale}
            currencyLabel={currencyLabel}
            className="min-[420px]:mt-10 lg:col-span-4 lg:col-start-9 lg:mt-24 [--motion-offset:300ms]"
          />
        </div>
      </Reveal>
    </Container>
  );
}
