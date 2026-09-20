import type { AppLocale } from '@/i18n/routing';
import type { CatalogSlot } from '@/lib/editorial/slots';
import type { CatalogProduct } from '../types/catalog-product';
import type { HomeProductMock } from '../types/home-product';
import { localizedDescription, localizedName, type LocalizedText } from './localized-name';
import { displayedPrice } from './variant-selection';

/**
 * Where a card photograph comes from. A static image is carried as its registry slot,
 * not as `StaticImageData`, so this module never imports `lib/editorial/images.ts`
 * (no spec may) and stays testable; `ProductCard` resolves the slot to the static
 * import, which keeps `placeholder="blur"`. A remote URL is already absolute (KD-3).
 */
export type ImageSource = { kind: 'static'; slot: CatalogSlot } | { kind: 'remote'; url: string };

export type ProductCardBadge = 'new' | 'soldOut';

/** What `ProductCard` renders (KD-13); it never sees a data source. */
export interface ProductCardModel {
  /** Locale-less; `@/i18n/navigation`'s `Link` adds the prefix. */
  href: string;
  name: LocalizedText;
  /**
   * The product's own stored description, or null. Never written in the storefront and
   * never truncated here: the card clamps it to two lines in CSS, so what a shopper
   * reads is the opening of the real copy, not a sentence this app invented.
   */
  description: LocalizedText | null;
  /** Whole EGP. The lowest variant price when `priceFrom`, else the exact one. */
  price: number;
  /** Variants differ in price, so the card shows "From {price}" (the product page's rule). */
  priceFrom: boolean;
  primary: ImageSource | null;
  secondary: ImageSource | null;
  /** One badge at most (guideline §11). */
  badge: ProductCardBadge | null;
}

export function productHref(slug: string): string {
  return `/products/${slug}`;
}

export function fromHomeMock(mock: HomeProductMock, locale: AppLocale): ProductCardModel {
  return {
    href: productHref(mock.slug),
    name: { text: mock.name[locale], lang: locale },
    // A mock carries no copy and no variants: the card shows a name and a price, and
    // the caller composes no Add to Bag for it (the slug names no real product).
    description: null,
    price: mock.price,
    priceFrom: false,
    primary: { kind: 'static', slot: mock.images.a },
    secondary: { kind: 'static', slot: mock.images.b },
    badge: mock.isNew ? 'new' : null,
  };
}

function remote(image: { url: string } | undefined): ImageSource | null {
  return image ? { kind: 'remote', url: image.url } : null;
}

export function fromCatalogDto(dto: CatalogProduct, locale: AppLocale): ProductCardModel {
  // The product page's own rule, not a second one: the lowest variant price, marked
  // "from" only when the variants actually differ.
  const price = displayedPrice({}, dto);
  return {
    href: productHref(dto.slug),
    name: localizedName(dto, locale),
    description: localizedDescription(dto, locale),
    price: price.price,
    priceFrom: price.kind === 'from',
    primary: remote(dto.images[0]),
    secondary: remote(dto.images[1]),
    // Sold out wins: it is the fact that changes what the shopper can do.
    badge: !dto.inStock ? 'soldOut' : dto.isNew ? 'new' : null,
  };
}
