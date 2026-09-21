import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { formatPrice } from '@/features/products/utils/price';
import { productHref } from '@/features/products/utils/product-card-model';
import { cn } from '@/lib/utils/cn';
import type { SelectionPiece } from '../../data/moon-selection';
import { SelectionFrame } from './selection-frame';

export interface SelectionTileProps {
  piece: SelectionPiece;
  locale: AppLocale;
  /** `products.currency`, resolved by the owning Server Component. */
  currencyLabel: string;
  /** Its placement in the spread, and its entrance offset. */
  className?: string;
}

/**
 * A supporting piece in The Moon Selection: a photograph, a name and a price, and
 * nothing else. It is deliberately lighter than `ProductCard` - no badge, no
 * description, no Quick Add, no second link - because four of these have to sit around
 * the feature without competing with it. A shopper discovers here and decides on the
 * product page.
 *
 * **One link per tile.** The name's `Link` carries a transparent `::after` over the
 * whole article, so the photograph and the caption open the piece while the DOM holds a
 * single anchor named by the piece. A "View details" beside it would double the tab
 * stops to reach the page the name already opens - the feature is the one register that
 * earns a second anchor.
 *
 * `data-product-card` and `data-product-name` are the hooks for the shared hover rule in
 * `app/globals.css`: the gold rule draws under the name on hover *and* on keyboard
 * focus, so the affordance exists for a keyboard user and on a touch screen, where
 * hovering does not. Nothing this tile says is hover-only.
 *
 * The entrance rises the whole tile (`data-motion="rise"` on the article) at the offset
 * its placement passes in, so the four arrive in the reading order of the spread rather
 * than together. The feature is the only frame that wipes open; a fifth identical
 * entrance is what made the old grid read as a listing.
 */
export function SelectionTile({ piece, locale, currencyLabel, className }: SelectionTileProps) {
  const { product } = piece;

  return (
    <article
      data-product-card=""
      data-motion="rise"
      className={cn('group relative [--motion-rise:28px]', className)}
    >
      <SelectionFrame
        primary={product.images.a}
        secondary={product.images.b}
        frame={piece.frame}
        sizes={piece.sizes}
      />
      <div className="mt-4">
        <h3 className="type-body-lg font-medium leading-[1.375] text-balance text-text [:lang(ar)_&]:leading-[1.55]">
          <Link
            href={productHref(product.slug)}
            className="after:absolute after:inset-0 after:content-['']"
          >
            <span data-product-name="">{product.name[locale]}</span>
          </Link>
        </h3>
        <p className="type-small mt-2 font-medium tabular-nums tracking-[0.02em] text-text-secondary">
          {formatPrice(product.price, locale, currencyLabel)}
        </p>
      </div>
    </article>
  );
}
