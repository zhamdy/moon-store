import type { CatalogSlot } from '@/lib/editorial/slots';

/**
 * The homepage's static mock product — deliberately not named `Product`. The real
 * `products.name` is a single Arabic string; this carries `{ en, ar }` purely so
 * the English homepage reads correctly. The Shop task defines the API DTO; nothing
 * here should be mistaken for it.
 */
export interface HomeProductMock {
  slug: string;
  name: Record<'en' | 'ar', string>;
  /** Whole EGP. */
  price: number;
  /** Registry slot keys: `a` is the front view, `b` the hover alternate. */
  images: { a: CatalogSlot; b: CatalogSlot };
  isNew?: boolean;
}
