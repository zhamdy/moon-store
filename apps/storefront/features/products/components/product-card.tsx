import type { ReactNode } from 'react';
import Image from 'next/image';
import { EditorialLink } from '@/components/ui/editorial-link';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import { fillTemplate } from '@/lib/utils/fill-template';
import type { ImageSource, ProductCardBadge, ProductCardModel } from '../utils/product-card-model';
import { formatPrice } from '../utils/price';
import { ProductImagePlaceholder } from './product-image-placeholder';

/** Card width in the homepage's 4-up desktop grid / 2-up below. */
export const CATALOG_CARD_SIZES = '(min-width: 1440px) 320px, (min-width: 1024px) 23vw, 46vw';
/** The Curated Edit's 2x2 feature card. */
export const LARGE_CARD_SIZES = '(min-width: 1440px) 672px, (min-width: 1024px) 48vw, 92vw';

export interface ProductCardProps {
  /** Built by `fromHomeMock` or `fromCatalogDto`; the card never sees a data source. */
  product: ProductCardModel;
  locale: AppLocale;
  /** `products.currency`, resolved by the owning Server Component. */
  currencyLabel: string;
  /** `products.new` / `products.soldOut`, resolved by the owning Server Component. */
  badgeLabels: Record<ProductCardBadge, string>;
  /** `product.priceFrom` ("From {price}"), needed only where a listing has variants. */
  priceFromLabel?: string;
  /** Honest `sizes` for the grid this card sits in. */
  sizes: string;
  /**
   * The commerce action, composed by the page (`features/cart`'s `QuickAdd`). This slice
   * never imports the cart slice — the product page composes Add to Bag into the purchase
   * panel the same way (CD-11). Omitted, the card is a photograph and a caption, which is
   * what the homepage's static mock products are: no slug the API knows, nothing to add.
   */
  action?: ReactNode;
  /**
   * `supporting` (default) is the tile every listing uses. `lead` is the art-directed
   * one: a wider frame given a fuller caption — the name in the display face at heading
   * size, the price on its own line, three lines of copy and a details link beside the
   * action. One per composition (owner brief, 2026-09-20): a row where every card shouts
   * has no hierarchy at all.
   */
  emphasis?: 'lead' | 'supporting';
  /** `products.viewDetails`. Rendered beside the action, on a `lead` card only. */
  detailsLabel?: string;
  /**
   * Its entrance inside a `<Reveal>`, mirroring `CategoryTile`: `rise` (default)
   * lifts the whole card, the quiet commerce entrance; `image` wipes the
   * photograph open and settles it from 1.06, reserved for a feature card.
   */
  reveal?: 'image' | 'rise';
  /**
   * The primary photograph's `next/image` loading, for a listing's first row
   * (`catalogImageLoading`). Omitted, the image stays lazy as on the homepage. The
   * hover image is never eager.
   */
  loading?: 'eager';
  fetchPriority?: 'high';
  className?: string;
}

/**
 * Static registry images keep their build-time blur; a remote image has no
 * `blurDataURL`, so it loads over the frame's `bg-surface-soft` fill instead.
 */
function imageProps(image: ImageSource) {
  return image.kind === 'static'
    ? { src: editorialImages[image.slot].src, placeholder: 'blur' as const }
    : { src: image.url };
}

/**
 * The first reusable commerce unit. A Server Component.
 *
 * **The editorial commerce tile** (owner brief, 2026-09-20, superseding the caption-only
 * tile of the same day). A photograph, a caption that says enough to choose by, and one
 * action. Nothing else: no wishlist, no rating, no second badge row, no icon strip.
 *
 * - The frame is a **4:5** photograph on `bg-surface-soft`, `rounded-media` (12px) — no
 *   border, no shadow, no plate. The pale-on-pale product shots have no edge of their
 *   own against an ivory page, so the corner radius is the only thing drawing the tile;
 *   keep the surface under the photograph rather than letting it go to page ivory. The
 *   editorial assets are authored at exactly 4:5, so `object-cover` crops nothing: how
 *   much of the frame a garment fills is a property of the source crop (see
 *   `docs/design/editorial-image-brief.md`), never of a `scale` baked in here.
 * - The badge is **printed on the photograph**, `type-caption`, uppercase, widely
 *   tracked, bronze for "New" and ink for "Sold out". No pill, no capsule, no backdrop.
 * - The caption is **name and price on one baseline**, then the description under it.
 *   The name is the strongest thing: `type-body-lg`, weight 500, full ink, in the
 *   **display face** (set on `[data-product-name]`); the price is `type-small`, weight
 *   500, full ink, `tabular-nums`, anchored at the inline end — quieter than the name,
 *   never hard to find. A name that wraps takes two lines and the price stays on the
 *   first baseline beside it, which is why the name column is `min-w-0` and balanced.
 * - The description is the product's **own stored copy** (`localizedDescription`),
 *   clamped to two lines in secondary ink. It is never written here and never
 *   truncated by the API; a product with no description simply has no line, and on a
 *   grid that keeps the cards level because the clamp reserves its two lines.
 * - The action is composed by the page into `action` — one Add to Bag, bronze hairline,
 *   full width, 48px tall. It is the only control on the tile.
 *
 * **Two registers.** `emphasis="supporting"` is the tile every listing uses: name and
 * price on one baseline, two lines of copy, one outlined action. `emphasis="lead"` is
 * the art-directed card the New Arrivals rail opens with (owner brief, 2026-09-20): a
 * wider frame, the name at heading size in the display face, the price on its own line,
 * three lines of copy and a details link beside a filled action. The difference is
 * hierarchy, not decoration — nothing is added to the lead card that the tile hides.
 *
 * **One link, one overlay.** The title's `Link` carries a transparent `::after` over the
 * whole card, so the photograph and the caption open the product page while the DOM
 * holds a single link whose accessible name is the product name (images are decorative:
 * `alt=""`). The action sits above that overlay on `z-10`, which is what keeps a button
 * out of an anchor — a nested control would be invalid and unreachable by keyboard. A
 * supporting tile carries no second "View details" link: it would double every card's
 * tab stops to reach the page the title already opens. The lead card does, because it
 * has the width to place it beside the action rather than under it.
 *
 * Hover (CSS `group-hover`, which Tailwind wraps in `@media (hover: hover)`, so touch
 * devices never get a stuck alternate view): the second photograph crossfades in, the
 * frame scales 1 → 1.03 and the name's gold rule draws along the reading direction.
 * Keyboard focus draws the rule too. Nothing lifts, nothing casts a shadow, no control
 * appears over the photograph.
 *
 * Sold out never greys the photograph and the price stays visible; the badge word
 * changes and the action reads "Sold out". A product with no photograph shows the frame
 * with the brand mark, small and faint, so it never reads as a loading skeleton.
 *
 * Text in another language than the page (an Arabic fallback on an English page) carries
 * `lang` and `dir="auto"`: Tajawal applies, the bidi run is isolated from the price and
 * screen readers switch voice.
 */
export function ProductCard({
  product,
  locale,
  currencyLabel,
  badgeLabels,
  priceFromLabel,
  sizes,
  action,
  emphasis = 'supporting',
  detailsLabel,
  reveal = 'rise',
  loading,
  fetchPriority,
  className,
}: ProductCardProps) {
  const { primary, secondary, badge, description } = product;
  const foreignName = product.name.lang !== locale;
  const lead = emphasis === 'lead';
  const price = formatPrice(product.price, locale, currencyLabel);
  const priceText =
    product.priceFrom && priceFromLabel ? fillTemplate(priceFromLabel, { price }) : price;
  const descriptionLang =
    description && description.lang !== locale
      ? { lang: description.lang, dir: 'auto' as const }
      : {};

  return (
    <article
      data-product-card=""
      data-motion={reveal === 'rise' ? 'rise' : undefined}
      // `h-full` so the column can push its action to the bottom: both the grid `li`
      // and the rail's flex item stretch to the row, the card inside them does not.
      className={cn('group relative flex h-full flex-col', className)}
    >
      <div
        data-motion={reveal === 'image' ? 'image' : undefined}
        // `rounded-media` (12px), the site-wide media radius, so the
        // `data-motion="image"` wipe — whose clip-path insets carry
        // `round var(--radius-media)` — matches the frame without an override.
        className="relative isolate aspect-4/5 overflow-hidden rounded-media bg-surface-soft"
      >
        <div data-motion-zoom={reveal === 'image' ? '' : undefined} className="absolute inset-0">
          <div className="absolute inset-0 transition-transform duration-base ease-ui group-hover:scale-[1.03]">
            {primary ? (
              <Image
                {...imageProps(primary)}
                alt=""
                fill
                sizes={sizes}
                loading={loading}
                fetchPriority={fetchPriority}
                className="object-cover"
              />
            ) : (
              <ProductImagePlaceholder />
            )}
            {/* .hover-alt-image (app/globals.css): display:none unless
                (hover: hover) and (min-width: 768px), so this lazy image is
                never fetched on touch devices, which have no hover to reveal it. */}
            {primary && secondary && (
              <div className="hover-alt-image absolute inset-0">
                <Image
                  {...imageProps(secondary)}
                  alt=""
                  fill
                  sizes={sizes}
                  className="object-cover opacity-0 transition-opacity duration-base ease-ui group-hover:opacity-100"
                />
              </div>
            )}
          </div>
        </div>

        {/* Printed on the photograph. Last inside the frame, and the caption below is
            what the link names, so the reading order stays "<name>, <price>". */}
        {badge && (
          <p
            className={cn(
              'type-caption absolute start-3 top-3 uppercase tracking-[0.22em] rtl:tracking-normal lg:start-4 lg:top-4',
              badge === 'soldOut' ? 'text-text' : 'text-brand'
            )}
          >
            {badgeLabels[badge]}
          </p>
        )}
      </div>

      {/* The caption. A supporting card sets name and price on one baseline, the tight
          reading a row of tiles wants. The lead card stacks them and lets the name run
          at heading size: it is the one piece in the row being introduced rather than
          listed, and the stack is what gives the price its own beat. */}
      <div
        data-motion="fade"
        className={cn('mt-3', lead && 'mt-5 lg:mt-6', '[--motion-offset:240ms]')}
      >
        <div className={cn(!lead && 'flex items-baseline justify-between gap-3')}>
          <h3
            className={cn(
              'min-w-0 font-medium text-balance text-text',
              lead
                ? 'type-h4 leading-[1.15] [:lang(ar)_&]:leading-[1.4]'
                : 'type-body-lg leading-[1.375] [:lang(ar)_&]:leading-[1.55]'
            )}
          >
            {/* The one link on the card: its ::after covers the whole tile, so the
                photograph and the caption open the product page with no second anchor. */}
            <Link href={product.href} className="after:absolute after:inset-0 after:content-['']">
              {/* data-product-name carries the display face and the gold rule
                  (app/globals.css); the span is inline so the rule is the width of
                  the name, not the column. */}
              <span
                data-product-name=""
                lang={foreignName ? product.name.lang : undefined}
                dir={foreignName ? 'auto' : undefined}
              >
                {product.name.text}
              </span>
            </Link>
          </h3>
          <p
            className={cn(
              'font-medium text-text tabular-nums tracking-[0.02em]',
              lead ? 'type-body mt-2' : 'type-small shrink-0'
            )}
          >
            {priceText}
          </p>
        </div>

        {/* The product's own copy, clamped — two lines on a tile, three on the lead card,
            with the height reserved either way so a row stays level and the actions line
            up. Nothing is written here and nothing is truncated server-side. */}
        {description && (
          <p
            {...descriptionLang}
            // The clamp heights are the line-height x font-size products in rem rather
            // than `2lh`/`3lh`: the unit is newer than the browsers this site serves.
            className={cn(
              'text-text-secondary',
              lead
                ? 'type-body mt-3 line-clamp-3 min-h-[4.8rem] max-w-[46ch]'
                : 'type-small mt-1.5 line-clamp-2 min-h-[2.72rem]'
            )}
          >
            {description.text}
          </p>
        )}
      </div>

      {/* Above the title link's overlay (the action's own root carries `z-10`), and
          pushed to the card's bottom edge so a wrapped name never leaves one card's
          button low. On the lead card the details link shares the row with the action:
          a second anchor to the same page, which only the lead card is wide enough to
          carry without competing with its own button. */}
      {action && (
        <div
          className={cn(
            'mt-auto pt-1',
            lead && detailsLabel && 'relative z-10 flex flex-wrap items-center gap-x-6 gap-y-3'
          )}
        >
          {lead && detailsLabel ? (
            <>
              <div className="min-w-0 grow basis-48">{action}</div>
              <EditorialLink href={product.href} className="shrink-0">
                {detailsLabel}
              </EditorialLink>
            </>
          ) : (
            action
          )}
        </div>
      )}
    </article>
  );
}
