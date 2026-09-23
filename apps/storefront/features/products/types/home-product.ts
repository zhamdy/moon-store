import type { CatalogSlot } from '@/lib/editorial/slots';

/**
 * A homepage editorial photograph with a caption — deliberately not named `Product`,
 * and deliberately carrying **no product identity at all**.
 *
 * It has no slug, no price and no availability, because it names nothing the catalogue
 * knows: these entries were authored to mirror the seed's vocabulary, never from its
 * real slugs, and nothing tied the two together. Five of the nine links the homepage
 * published this way were dead (HIGH-1 in
 * `docs/audits/2026-09-22-shop-cart-fullstack-audit.md`). The type is the guard —
 * with no slug there is no product href to build, so the drift cannot return by
 * accident. Commerce data on the homepage comes from the catalog DTO instead.
 *
 * `name` carries `{ en, ar }` purely so the English homepage reads; the real
 * `products.name` is a single Arabic string.
 */
export interface HomeProductMock {
  /** Editorial key, for React lists only. Never a slug, never a URL segment. */
  id: string;
  name: Record<'en' | 'ar', string>;
  /** Registry slot keys: `a` is the front view, `b` the hover alternate. */
  images: { a: CatalogSlot; b: CatalogSlot };
}
