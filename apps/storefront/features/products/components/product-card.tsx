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
 * Hover (CSS `group-hover`, which Tailwind wraps in `@media (hover: hover)`, so
 * touch devices never get a stuck alternate view): the second photograph
 * crossfades in, the frame scales 1 -> 1.03 and the name's underline draws along
 * the reading direction. Keyboard focus draws the underline too.
 *
 * Reveal: the card declares its entrance with `data-motion` and plays it only
 * inside a `<Reveal>`. By default the card rises and its text follows; with
 * `reveal="image"` the photograph wipes upward and settles from 1.06 instead
 * (AD-11: quiet commerce, one editorial beat per section). Outside a Reveal the
 * attributes are inert. Reveal
 * motion and hover motion sit on separate elements because each owns its
 * element's transition.
 *
 * The whole card is one link whose accessible name is the product name (images
 * are decorative here: `alt=""`). No wishlist control until wishlist behaviour
 * exists: it would be a dead control for keyboard and screen-reader users.
 *
 * The badge ("New" or "Sold out", one at most) renders after the name and price
 * in DOM order, so the link's accessible name starts with the product name — but
 * stays visually pinned to the image's top-start corner via `absolute start-3
 * top-3` against the `Link`'s own `relative`, which shares that corner with the
 * image frame (the image is the Link's first child, at the same origin). Any
 * future reorder must keep both in step: Shop and Collections reuse this card.
 *
 * Sold out never greys the photograph; the label is secondary text on `bg-bg`
 * and the price stays visible. A product with no photograph shows the frame with
 * the brand mark, small and faint, so it never reads as a loading skeleton.
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
      data-motion={reveal === 'rise' ? 'rise' : undefined}
      className={cn('group', className)}
    >
      <Link href={product.href} className="relative block">
        <div
          data-motion={reveal === 'image' ? 'image' : undefined}
          className="relative aspect-4/5 overflow-hidden bg-surface-soft"
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

        <div
          data-motion="fade"
          className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 [--motion-offset:240ms]"
        >
          <h3 className="type-body font-body">
            <span
              lang={foreignName ? product.name.lang : undefined}
              dir={foreignName ? 'auto' : undefined}
              className={cn(
                'bg-left-bottom bg-no-repeat rtl:bg-right-bottom',
                '[background-image:linear-gradient(currentColor,currentColor)] bg-[length:0%_1px]',
                'transition-[background-size] duration-base ease-ui',
                'group-hover:bg-[length:100%_1px] group-has-[:focus-visible]:bg-[length:100%_1px]'
              )}
            >
              {product.name.text}
            </span>
          </h3>
          <p className="type-small text-text-secondary shrink-0 tabular-nums">
            {formatPrice(product.price, locale, currencyLabel)}
          </p>
        </div>
        {badge && (
          <span
            className={
              badge === 'soldOut'
                ? 'type-caption absolute start-3 top-3 bg-bg px-2 py-1 font-medium tracking-[0.08em] uppercase text-text-secondary'
                : 'type-caption absolute start-3 top-3 bg-bg px-2 py-1 font-medium tracking-[0.08em] uppercase'
            }
          >
            {badgeLabels[badge]}
          </span>
        )}
      </Link>
    </article>
  );
}
