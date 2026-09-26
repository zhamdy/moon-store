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
import { StatusText } from '@/components/ui/status';

/** Card width in the homepage's 4-up desktop grid / 2-up below. */
export const CATALOG_CARD_SIZES = '(min-width: 1440px) 320px, (min-width: 1024px) 23vw, 46vw';
/** The Moon Selection's 2x2 feature card. */
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
  /**
   * The quiet line under the price — today "4 sizes" (`products.sizes` over
   * `product.sizeCount`), resolved by the caller. Omitted, there is no line: the
   * related row leaves it out on purpose, and a product with no size option has none.
   */
  meta?: string;
  /** Honest `sizes` for the grid this card sits in. */
  sizes: string;
  /**
   * The commerce action, composed by the page (`features/cart`'s `QuickAdd`). This slice
   * never imports the cart slice — the product page composes Add to Bag into the purchase
   * panel the same way (CD-11). Omitted, the card is a photograph and a caption, which is
   * what the homepage's editorial frames are: they name no product, so `href` and `price`
   * are null and there is nothing to add.
   */
  action?: ReactNode;
  /**
   * `supporting` (default) is the tile every listing uses. `lead` is the art-directed
   * one: a wider frame given a fuller caption — the name in the display face at heading
   * size, three lines of the product's own copy and a details link beside a worded
   * action. One per composition (owner brief, 2026-09-20).
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
 * `blurDataURL`, so it loads over the frame's `bg-surface-media` mat instead.
 */
function imageProps(image: ImageSource) {
  return image.kind === 'static'
    ? { src: editorialImages[image.slot].src, placeholder: 'blur' as const }
    : { src: image.url };
}

/** New: the word in ink behind a gold dot. Sold out: the danger status. Never colour alone. */
function CardStatus({ badge, label }: { badge: ProductCardBadge; label: string }) {
  return badge === 'soldOut' ? (
    <StatusText tone="danger">{label}</StatusText>
  ) : (
    <span className="type-supporting inline-flex items-center gap-2 font-medium text-text">
      <span aria-hidden="true" className="size-[7px] shrink-0 rounded-pill bg-metallic" />
      {label}
    </span>
  );
}

/**
 * The first reusable commerce unit. A Server Component.
 *
 * **Card A, "Atelier"** (design system 2026-09-25, owner-approved on the product-card
 * canvas). A photograph that is left alone, and a caption that says what a shopper
 * chooses by — in that order, and nothing else: no wishlist, no rating, no icon strip,
 * no badge plate on the photograph.
 *
 * - The frame is a **4:5** packshot on the Stone mat (`bg-surface-media`),
 *   `rounded-media` (square since 2026-09-25), no border, no shadow. The only thing on
 *   the photograph is the page-composed action: a 44px disc at the bottom **inline end**
 *   (`[data-card-action='overlay']` in app/globals.css).
 * - The caption is three short lines. The **name** (`type-product-title`: Hanken /
 *   Tajawal 500, never the display face in a listing), clamped to two lines. The
 *   **price** (`type-price`, full ink, tabular; "From {price}" when variants differ), with
 *   the **status** beside it where there is one: "New" in ink behind a gold dot, "Sold
 *   out" in the danger colour — a word and a mark, never colour alone. Then the
 *   **meta** line, quiet (`type-caption`, secondary ink): how many sizes, when the product
 *   has a size option. Low stock is not shown: the listing exposes `inStock` only.
 * - **No description on a tile.** The product's own copy stays on the lead card and the
 *   product page; on a grid it made every row a paragraph.
 * - **Sold out** keeps the photograph in full colour and the price visible; the status
 *   says the word and the tile carries **no action** — there is nothing to add. The lead
 *   card keeps its worded "Sold out" action, which it has the room to explain.
 *
 * **Two registers.** `emphasis="supporting"` is the tile above. `emphasis="lead"` is the
 * feature card: the name at heading size in the display face (Tajawal in Arabic), the
 * price and status on their own line, three clamped lines of copy, and a worded action
 * with a details link beside it. Same component, never a second one.
 *
 * **One link, one overlay.** The title's `Link` carries a transparent `::after` over the
 * whole card, so the photograph and the caption open the product page while the DOM
 * holds a single link whose accessible name is the product name (images are decorative:
 * `alt=""`). The action sits above that overlay on `z-10`, which keeps a button out of an
 * anchor. A supporting tile carries no second "View details" link.
 *
 * Hover (CSS `group-hover`, wrapped in `@media (hover: hover)` by Tailwind, so touch never
 * gets a stuck alternate view): the second photograph crossfades in, the frame scales
 * 1 → 1.03 and the name's rule draws along the reading direction; keyboard focus draws
 * the rule too. A product with no photograph shows the mat with the brand mark, small
 * and faint, so it never reads as a loading skeleton.
 *
 * Text in another language than the page (an Arabic fallback on an English page) carries
 * `lang` and `dir="auto"`.
 */
export function ProductCard({
  product,
  locale,
  currencyLabel,
  badgeLabels,
  priceFromLabel,
  meta,
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
  // An editorial card has no product behind it: no link, no price (HIGH-1 / MED-3).
  const href = product.href;
  const price = product.price === null ? null : formatPrice(product.price, locale, currencyLabel);
  const priceText =
    price !== null && product.priceFrom && priceFromLabel
      ? fillTemplate(priceFromLabel, { price })
      : price;
  const descriptionLang =
    description && description.lang !== locale
      ? { lang: description.lang, dir: 'auto' as const }
      : {};
  // A sold-out tile has nothing to add; the lead card keeps its worded "Sold out".
  const showAction = Boolean(action) && (lead || badge !== 'soldOut');

  return (
    <article
      data-product-card=""
      data-emphasis={lead ? 'lead' : undefined}
      data-motion={reveal === 'rise' ? 'rise' : undefined}
      // A grid, not a flex column: the caption row takes the slack so the lead card's
      // action still sits at the card's bottom edge, and the tile's disc is placed into
      // the frame's own row instead (`[data-card-action]` in app/globals.css) -
      // overlapping it onto the photograph without touching DOM order, so the name is
      // still read and tabbed before the button. `h-full` so the column can fill the
      // row: both the grid `li` and the rail's flex item stretch, the card does not.
      className={cn('group relative grid h-full grid-cols-1 grid-rows-[auto_1fr_auto]', className)}
    >
      <div
        data-motion={reveal === 'image' ? 'image' : undefined}
        // `row-start-1` (and the caption's `row-start-2`) because the action is placed
        // into this same cell by hand: auto-placement skips a cell an explicitly-placed
        // item already holds, so without these the photograph would slide into row 2 and
        // the disc would sit above the card. `col-start-1` on both, or grid creates an
        // implicit second column and shrinks the photograph (AGENTS.md learning).
        className="relative isolate col-start-1 row-start-1 aspect-4/5 overflow-hidden rounded-media bg-surface-media"
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
      </div>

      {/* The caption: name, then price with its status, then the meta line. The link
          names the card, so the reading order is "<name>", "<price> <status>", "<meta>". */}
      <div
        data-motion="fade"
        className={cn(
          'col-start-1 row-start-2 mt-3.5',
          lead && 'mt-5 lg:mt-6',
          '[--motion-offset:240ms]'
        )}
      >
        <h3
          className={cn(
            'min-w-0 text-balance text-text',
            lead
              ? 'type-h4 leading-[1.15] [:lang(ar)_&]:leading-[1.4]'
              : 'type-product-title line-clamp-2'
          )}
        >
          {/* data-product-name carries the face and the reading-direction rule
              (app/globals.css); the span is inline so the rule is the width of the name,
              not the column. An editorial card renders it bare: with no product behind the
              caption there is nothing to open. */}
          {href === null ? (
            <span
              data-product-name=""
              lang={foreignName ? product.name.lang : undefined}
              dir={foreignName ? 'auto' : undefined}
            >
              {product.name.text}
            </span>
          ) : (
            /* The one link on the card: its ::after covers the whole tile, so the
               photograph and the caption open the product page with no second anchor. */
            <Link href={href} className="after:absolute after:inset-0 after:content-['']">
              <span
                data-product-name=""
                lang={foreignName ? product.name.lang : undefined}
                dir={foreignName ? 'auto' : undefined}
              >
                {product.name.text}
              </span>
            </Link>
          )}
        </h3>

        {(priceText !== null || badge) && (
          <div
            className={cn('flex flex-wrap items-center gap-x-3 gap-y-0.5', lead ? 'mt-2' : 'mt-1')}
          >
            {priceText !== null && (
              <p
                className={cn(
                  'text-text tabular-nums',
                  lead ? 'type-body font-medium' : 'type-price'
                )}
              >
                {priceText}
              </p>
            )}
            {badge && <CardStatus badge={badge} label={badgeLabels[badge]} />}
          </div>
        )}

        {!lead && meta && <p className="type-caption mt-0.5 text-text-secondary">{meta}</p>}

        {/* The product's own copy, on the lead card only: three clamped lines, height
            reserved so the action lines up. Nothing is written here and nothing is
            truncated server-side. */}
        {lead && description && (
          <p
            {...descriptionLang}
            // The clamp height is the line-height x font-size product in rem rather than
            // `3lh`: the unit is newer than the browsers this site serves.
            className="type-body mt-3 line-clamp-3 min-h-[4.8rem] max-w-[46ch] text-text-secondary"
          >
            {description.text}
          </p>
        )}
      </div>

      {/* Above the title link's overlay (the action's own root carries `z-10`). On a tile
          it is placed into the photograph's cell; on the lead card it sits in flow at the
          card's bottom edge with the details link beside it — a second anchor to the same
          page that only the lead card is wide enough to carry. */}
      {showAction && (
        <div
          // Share the photograph's grid cell explicitly; auto-placement would create
          // a second column and shrink the image.
          data-card-action={lead ? 'flow' : 'overlay'}
          className={cn(
            'col-start-1 row-start-3',
            lead && [
              'pt-6',
              detailsLabel && 'relative z-10 flex flex-wrap items-center gap-x-6 gap-y-3',
            ]
          )}
        >
          {lead && detailsLabel && href !== null ? (
            <>
              <div className="min-w-0 grow basis-48">{action}</div>
              <EditorialLink href={href} className="shrink-0">
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
