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
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { curatedEdit, newArrivals } from '@/features/products/data/home-products';
import {
  fromCatalogDto,
  fromHomeMock,
  type ProductCardModel,
} from '@/features/products/utils/product-card-model';
import { NEW_ARRIVALS_LIMIT, loadNewArrivals } from '../../api/load-new-arrivals';
import { ProductRail } from './product-rail';

const HEADING_ID = 'new-arrivals-title';

/**
 * A supporting card's rendered width at each step, derived from `[data-rail]`'s
 * visible count and gap in app/globals.css. From 1024 the rail is the composition's
 * second column (three quarters of the content column, less the grid gap), below it
 * the rail spans the column and bleeds a gutter each side; past 1440 the column stops
 * growing, so the card is a constant.
 */
export const RAIL_CARD_SIZES =
  '(min-width: 1440px) 350px, (min-width: 1280px) 26vw, (min-width: 1024px) 31vw, (min-width: 768px) 37vw, 84vw';

/** The lead card: `--rail-lead-scale` times the above (1.4 from 1280, 1.35 from 1024, 1.25 from 768, 1 below). */
export const RAIL_LEAD_SIZES =
  '(min-width: 1440px) 490px, (min-width: 1280px) 36vw, (min-width: 1024px) 42vw, (min-width: 768px) 46vw, 84vw';

/**
 * Entrance stagger for the cards in view; the rest arrive together. Past roughly
 * four cards the rail is off-screen sideways, where a delay buys nothing.
 */
const STAGGER_COUNT = 4;

/**
 * The set the rail falls back to when the catalog has no photographed products.
 * It has to be a *carousel's* worth, not a row's: at four the rail fills the
 * column, has nothing to scroll and hides its own controls, which is how the
 * first fallback silently deleted the feature (2026-09-20).
 *
 * The repository holds exactly nine product photographs (`catalogSlots`), and The
 * Edit further down the page already spends five of them, so a fallback this long
 * necessarily repeats some of them. That is the honest cost of running with no
 * catalog images and it is confined to that case: with a photographed catalog the
 * rail never reads this. Seeding the database's product images removes it.
 */
const FALLBACK_PRODUCTS = [...newArrivals, ...curatedEdit].slice(0, NEW_ARRIVALS_LIMIT);

/**
 * 03 - New Arrivals. The page's one curated carousel, art-directed rather than a
 * strip of equal tiles (owner brief, 2026-09-20, superseding the equal-card pass of
 * the same day).
 *
 * **The composition.** From 1024 the section is two columns: a masthead column
 * holding the title, its gold rule, the lead line, "View all", the two controls and
 * the progress rule, and beside it the rail, which bleeds off the page's inline end
 * so the row reads as continuing past the screen. Below 1024 the masthead sits above
 * a full-bleed rail with the rule under it, by the swipe. The controls living in the
 * masthead rather than over the cards is what makes the heading and the row one
 * block instead of a title with a strip beneath it; `ProductRail` owns that grid.
 *
 * **The lead card.** The first piece renders at `emphasis="lead"`: `--rail-lead-scale`
 * wider (1.4 from 1024, 1.25 from 768, the same width on a phone), the name at heading
 * size in the display face, the price on its own line, three lines of the product's
 * own copy, a filled Add to Bag and a details link beside it. The rest are supporting
 * tiles - outlined action, two lines of copy, name and price on one baseline. A row
 * where every card is equally loud has no hierarchy, and a row where the lead card is
 * a different *component* has no rhythm; this is one card in two registers.
 *
 * On a phone the lead keeps its caption but not its extra width: 1.4x of 84vw is a
 * card you cannot see. Hierarchy there is typographic, which is where it belongs.
 *
 * Geometry lives in `[data-rail]` (app/globals.css), read against the rail's own
 * column rather than the page: ~2.6 supporting cards from 1280, ~2.2 from 1024, ~2.4
 * from 768 (where the rail has the full width) and ~1.15 below, so the next card is
 * always part-visible and a supporting card stays near 300px at every width. It never
 * autoplays.
 *
 * **The masthead** says the section once. `eyebrow` ("Just in") is the title and
 * `title` ("New Arrivals") stays unused in both catalogues: as heading and subtitle
 * the two synonyms stuttered (2026-09-20). What carries the editorial weight instead
 * is a gold rule above the title, the `lead` line under it and the controls below -
 * and `lead` is rendered **only when the rail is the real catalog**, because it names
 * a fact ("the last thirty days", `NEW_IN_DAYS`) the static fallback cannot honour.
 * `type-h2`, not the signature `type-h1`: the promo banner sits directly below at that
 * size.
 *
 * Motion: one Reveal around the whole section (the rails' rule - a card off to the
 * side never intersects until it is swiped into view, so it must not own its own
 * trigger), with the masthead, the cards in view and the link on the shared stagger.
 *
 * Data: `loadNewArrivals` reads New In's first page from the API and the section
 * falls back to `FALLBACK_PRODUCTS` when that read fails *or* answers with products
 * that carry no photographs, so the homepage still renders - and still builds - with
 * no API, and never shows a row of empty frames on the one section whose subject is
 * the photography. A mock's slug names nothing the API knows, so the fallback rail
 * carries no Add to Bag and no lead line.
 */
export async function NewArrivals({ locale }: { locale: AppLocale }) {
  const t = await getTranslations('home.newArrivals');
  const tp = await getTranslations('products');
  const tpr = await getTranslations('product');
  const quickAddStrings = await getQuickAddStrings(locale);

  const dtos = await loadNewArrivals();
  // Only catalog products carry an Add to Bag: a mock's slug names nothing the API
  // knows, so the fallback rail is photographs and captions (see `fromHomeMock`).
  const products: { key: string; model: ProductCardModel; dto?: CatalogProduct }[] = dtos
    ? dtos.map((dto) => ({ key: dto.slug, model: fromCatalogDto(dto, locale), dto }))
    : FALLBACK_PRODUCTS.map((mock) => ({ key: mock.slug, model: fromHomeMock(mock, locale) }));

  const badgeLabels = { new: tp('new'), soldOut: tp('soldOut') };
  const currencyLabel = tp('currency');
  const priceFromLabel = tpr.raw('priceFrom') as string;
  const detailsLabel = tp('viewDetails');

  return (
    <Container as="section" aria-labelledby={HEADING_ID} className="section-y">
      <Reveal className="[--motion-rise:48px]">
        <ProductRail
          count={products.length}
          labels={{ previous: t('previous'), next: t('next') }}
          heading={
            <div>
              {/* The rule opens the masthead rather than closing it: it is the mark
                  the eye meets before the word, the way a printed section rule works.
                  Gold, the one accent this section carries. */}
              <span
                aria-hidden="true"
                data-motion="fade"
                className="block h-px w-10 bg-metallic [--motion-offset:80ms] lg:w-14"
              />
              <h2
                id={HEADING_ID}
                data-motion="rise"
                className="type-h2 mt-5 text-balance [--motion-offset:160ms] [--motion-rise:24px]"
              >
                {t('eyebrow')}
              </h2>
              {/* Only with a real catalog behind it: the line names the thirty-day
                  window the API's `new` scope actually applies. */}
              {dtos && (
                <p
                  data-motion="fade"
                  className="type-small mt-4 max-w-[34ch] text-text-secondary [--motion-offset:320ms]"
                >
                  {t('lead')}
                </p>
              )}
            </div>
          }
          viewAll={
            <div data-motion="fade" className="[--motion-offset:450ms]">
              <EditorialLink href="/new-in" tone="brand">
                {t('link')}
              </EditorialLink>
            </div>
          }
        >
          {products.map(({ key, model, dto }, index) => {
            // One lead card per composition, and only where the rail is the real
            // catalog: the fallback's mocks have no copy and nothing to add.
            const lead = index === 0 && dto !== undefined;
            return (
              <li
                key={key}
                data-rail-lead={lead ? '' : undefined}
                style={
                  index < STAGGER_COUNT
                    ? ({ '--motion-stagger': index } as CSSProperties)
                    : undefined
                }
              >
                <ProductCard
                  product={model}
                  locale={locale}
                  currencyLabel={currencyLabel}
                  badgeLabels={badgeLabels}
                  priceFromLabel={priceFromLabel}
                  sizes={lead ? RAIL_LEAD_SIZES : RAIL_CARD_SIZES}
                  emphasis={lead ? 'lead' : 'supporting'}
                  detailsLabel={lead ? detailsLabel : undefined}
                  action={
                    dto && (
                      <QuickAdd
                        product={toQuickAddModel(dto, locale)}
                        strings={quickAddStrings}
                        emphasis={lead ? 'solid' : 'brand'}
                      />
                    )
                  }
                />
              </li>
            );
          })}
        </ProductRail>
      </Reveal>
    </Container>
  );
}
