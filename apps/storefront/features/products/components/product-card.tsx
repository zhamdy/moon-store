import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
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
  /** Honest `sizes` for the grid this card sits in. */
  sizes: string;
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
 * **The editorial tile** (owner brief, 2026-09-20, superseding every boxed pass
 * before it). There is no card: there is a photograph, and under it a caption.
 *
 * - The frame is a bare **4:5** photograph on `bg-surface-soft` - no border, no
 *   radius, no shadow, no plate. `[--radius-media:0px]` squares the
 *   `data-motion="image"` wipe with it; every other frame on the site keeps
 *   `rounded-media`, so this is scoped to the product card. 4:5 is the fashion
 *   ratio the brief asks for, and `object-cover` means the garment fills the
 *   frame's width rather than floating inside a letterboxed plate - how much of
 *   the frame the garment itself occupies is then a property of the source crop,
 *   not of this component.
 * - The badge is **printed on the photograph**, not stuck to it: `type-caption`,
 *   uppercase, widely tracked, bronze for "New" and ink for "Sold out", pinned to
 *   the image's top inline start. No pill, no capsule, no backdrop - the tile's
 *   surfaces are ivory and sand, so the corner it sits in is nearly always quiet.
 *   It renders **after** the name and price in DOM order, so the link's
 *   accessible name still starts with the product name; the `absolute` placement
 *   is against the `Link`'s own `relative`, which shares its origin with the image
 *   frame. Any future reorder must keep both in step - Shop, Collections and
 *   Related Products all reuse this card.
 * - Name and price share **one baseline**, 14px under the photograph (16 from
 *   `lg`). The name takes the space it needs (`min-w-0`, clamped to two lines,
 *   with a two-line `min-h` so a one-line and a two-line card end at the same
 *   height) and the price is anchored at the inline end, tabular and quiet. A
 *   price dropped underneath read as an afterthought.
 * - The name is `type-body-lg` at weight 500 in the **display face** (set on
 *   `[data-product-name]`) with tight leading; the price is `type-small` in the
 *   body face, secondary ink. One serif/sans pairing carries the character and it
 *   adds no element. Arabic relaxes the leading - Tajawal needs the room.
 *
 * Hover (CSS `group-hover`, which Tailwind wraps in `@media (hover: hover)`, so
 * touch devices never get a stuck alternate view): the second photograph
 * crossfades in, the frame scales 1 -> 1.03 and the name's rule draws along the
 * reading direction. Keyboard focus draws the rule too. The rule is gold
 * (`--rule-accent`) rather than currentColor and lives in app/globals.css keyed
 * on `data-product-card` / `data-product-name` - the one editorial accent on an
 * otherwise colourless tile. Nothing lifts, nothing casts a shadow, no control
 * appears over the photograph.
 *
 * The whole card is one link whose accessible name is the product name (images
 * are decorative here: `alt=""`). No wishlist control until wishlist behaviour
 * exists: it would be a dead control for keyboard and screen-reader users.
 *
 * Sold out never greys the photograph and the price stays visible; only the badge
 * word changes. A product with no photograph shows the frame with the brand mark,
 * small and faint, so it never reads as a loading skeleton.
 *
 * A name in another language than the page (an Arabic fallback on an English
 * page) carries `lang` and `dir="auto"` on the underline span: Tajawal applies,
 * the bidi run is isolated from the price and screen readers switch voice. When
 * the languages match, the span carries neither attribute.
 */
export function ProductCard({
  product,
  locale,
  currencyLabel,
  badgeLabels,
  sizes,
  reveal = 'rise',
  loading,
  fetchPriority,
  className,
}: ProductCardProps) {
  const { primary, secondary, badge } = product;
  const foreignName = product.name.lang !== locale;

  return (
    <article
      data-product-card=""
      data-motion={reveal === 'rise' ? 'rise' : undefined}
      className={cn('group', className)}
    >
      <Link href={product.href} className="relative block">
        <div
          data-motion={reveal === 'image' ? 'image' : undefined}
          // `[--radius-media:0px]` so the `data-motion="image"` wipe, whose clip-path
          // insets carry `round var(--radius-media)`, squares off with the frame.
          className="relative isolate aspect-4/5 overflow-hidden bg-surface-soft [--radius-media:0px]"
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

        {/* The caption: one baseline, the name taking the space it needs and the
            price anchored at the inline end. 14px under the photograph, 16 from
            `lg` - close enough to read as its caption, not as a second block. */}
        <div data-motion="fade" className="mt-3.5 [--motion-offset:240ms] lg:mt-4">
          <div className="flex items-baseline justify-between gap-4">
            {/* min-w-0 so a long name wraps inside its own column instead of
                pushing the price out of the card; two lines at most, and the
                two-line min-height keeps every card in a row the same height. */}
            <h3 className="type-body-lg line-clamp-2 min-h-[2.75em] min-w-0 font-medium leading-[1.375] text-text [:lang(ar)_&]:min-h-[3.1em] [:lang(ar)_&]:leading-[1.55]">
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
            </h3>
            <p className="type-small shrink-0 text-text-secondary tabular-nums tracking-[0.06em]">
              {formatPrice(product.price, locale, currencyLabel)}
            </p>
          </div>
        </div>

        {/* Printed on the photograph, last in DOM order so the link still reads
            "<name>, <price>" first. Positioned against this Link, whose origin is
            the image frame's. */}
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
      </Link>
    </article>
  );
}
