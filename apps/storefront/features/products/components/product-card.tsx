import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { editorialImages } from '@/lib/editorial/images';
import { cn } from '@/lib/utils/cn';
import type { HomeProductMock } from '../types/home-product';
import { formatPrice } from '../utils/price';

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
 * The first reusable commerce unit — guideline §13 "Product hover". A Server
 * Component: the hover crossfade is CSS (`group-hover`, which Tailwind wraps in
 * `@media (hover: hover)`, so touch devices never get a stuck alternate view),
 * two stacked lazy `<Image>`s inside a 4:5 frame that scales 1 → 1.02.
 *
 * The whole card is one link whose accessible name is the product name (images
 * are decorative here: `alt=""`). No wishlist control until wishlist behaviour
 * exists — it would be a dead control for keyboard and screen-reader users.
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
    <article className={cn('group', className)}>
      <Link href={`/shop/${product.slug}`} className="block">
        <div className="relative aspect-4/5 overflow-hidden bg-surface-soft">
          <div className="absolute inset-0 transition-transform duration-[260ms] ease-ui group-hover:scale-[1.02]">
            <Image
              src={front}
              alt=""
              fill
              sizes={sizes}
              placeholder="blur"
              className="object-cover"
            />
            <Image
              src={alternate}
              alt=""
              fill
              sizes={sizes}
              placeholder="blur"
              className="object-cover opacity-0 transition-opacity duration-[260ms] ease-ui group-hover:opacity-100"
            />
          </div>
          {product.isNew && (
            <span className="type-caption absolute start-3 top-3 bg-bg px-2 py-1 font-medium tracking-[0.08em] uppercase">
              {newLabel}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <h3 className="type-body font-body">{product.name[locale]}</h3>
          <p className="type-small text-text-secondary shrink-0 tabular-nums">
            {formatPrice(product.price, locale, currencyLabel)}
          </p>
        </div>
      </Link>
    </article>
  );
}
