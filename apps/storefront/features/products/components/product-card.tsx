import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import type { HomeProductMock } from '../types/home-product';
import { formatPrice } from '../utils/price';

/** Card width in the homepage's 4-up desktop grid / 2-up below. */
export const CATALOG_CARD_SIZES = '(min-width: 1440px) 320px, (min-width: 1024px) 23vw, 46vw';
/** The Curated Edit's 2x2 feature card. */
export const LARGE_CARD_SIZES = '(min-width: 1440px) 672px, (min-width: 1024px) 48vw, 92vw';

export interface ProductCardProps {
  product: HomeProductMock;
  locale: AppLocale;
  /** `products.currency`, resolved by the owning Server Component. */
  currencyLabel: string;
  /** `products.new`, resolved by the owning Server Component. */
  newLabel: string;
  /** Honest `sizes` for the grid this card sits in. */
  sizes: string;
  className?: string;
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
 * inside a `<Reveal>` (the card rises, the photograph wipes upward and settles
 * from 1.06, the text follows). Outside one the attributes are inert. Reveal
 * motion and hover motion sit on separate elements because each owns its
 * element's transition.
 *
 * The whole card is one link whose accessible name is the product name (images
 * are decorative here: `alt=""`). No wishlist control until wishlist behaviour
 * exists: it would be a dead control for keyboard and screen-reader users.
 *
 * The "New" badge renders after the name and price in DOM order, so the link's
 * accessible name starts with the product name, not "New" — but stays visually
 * pinned to the image's top-start corner via `absolute start-3 top-3` against
 * the `Link`'s own `relative`, which shares that corner with the image frame
 * (the image is the Link's first child, at the same origin). Any future
 * reorder must keep both in step: Shop and Collections reuse this card.
 */
export function ProductCard({
  product,
  locale,
  currencyLabel,
  newLabel,
  sizes,
  className,
}: ProductCardProps) {
  const front = editorialImages[product.images.a].src;
  const alternate = editorialImages[product.images.b].src;

  return (
    <article data-motion="rise" className={cn('group', className)}>
      <Link href={`/shop/${product.slug}`} className="relative block">
        <div data-motion="image" className="relative aspect-4/5 overflow-hidden bg-surface-soft">
          <div data-motion-zoom="" className="absolute inset-0">
            <div className="absolute inset-0 transition-transform duration-[400ms] ease-ui group-hover:scale-[1.03]">
              <Image
                src={front}
                alt=""
                fill
                sizes={sizes}
                placeholder="blur"
                className="object-cover"
              />
              {/* .hover-alt-image (app/globals.css): display:none unless
                  (hover: hover) and (min-width: 768px), so this lazy image is
                  never fetched on touch devices, which have no hover to reveal it. */}
              <div className="hover-alt-image absolute inset-0">
                <Image
                  src={alternate}
                  alt=""
                  fill
                  sizes={sizes}
                  placeholder="blur"
                  className="object-cover opacity-0 transition-opacity duration-[350ms] ease-ui group-hover:opacity-100"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          data-motion="fade"
          className="mt-4 flex items-baseline justify-between gap-4 [--motion-offset:240ms]"
        >
          <h3 className="type-body font-body">
            <span
              className={cn(
                'bg-left-bottom bg-no-repeat rtl:bg-right-bottom',
                '[background-image:linear-gradient(currentColor,currentColor)] bg-[length:0%_1px]',
                'transition-[background-size] duration-[350ms] ease-ui',
                'group-hover:bg-[length:100%_1px] group-has-[:focus-visible]:bg-[length:100%_1px]'
              )}
            >
              {product.name[locale]}
            </span>
          </h3>
          <p className="type-small text-text-secondary shrink-0 tabular-nums">
            {formatPrice(product.price, locale, currencyLabel)}
          </p>
        </div>
        {product.isNew && (
          <span className="type-caption absolute start-3 top-3 bg-bg px-2 py-1 font-medium tracking-[0.08em] uppercase">
            {newLabel}
          </span>
        )}
      </Link>
    </article>
  );
}
