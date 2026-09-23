import type { HomeProductMock } from '../types/home-product';

/**
 * Static editorial photography for the homepage: a frame and a caption, no product
 * behind it. Two sets, no overlap — four for the New Arrivals fallback, five for The
 * Moon Selection.
 *
 * These are **not** catalogue entries and no longer pretend to be. They carried slugs
 * and prices written to mirror the seed's vocabulary, which drifted from it: five of
 * the nine product links the homepage published led to a 404, and one price disagreed
 * with the catalogue by 350 EGP on the same garment (HIGH-1 / MED-3 in
 * `docs/audits/2026-09-22-shop-cart-fullstack-audit.md`). Real names, prices and links
 * come from the catalog DTO; what stays here is the photography.
 */
export const newArrivals: readonly HomeProductMock[] = [
  {
    id: 'silk-midi-dress',
    name: { en: 'Silk midi dress', ar: 'فستان ميدي من الحرير' },
    images: { a: 'product-01-a', b: 'product-01-b' },
  },
  {
    id: 'cashmere-pullover',
    name: { en: 'Cashmere pullover', ar: 'كنزة كشمير' },
    images: { a: 'product-04-a', b: 'product-04-b' },
  },
  {
    id: 'cross-body-leather-bag',
    name: { en: 'Cross-body leather bag', ar: 'حقيبة كتف جلدية' },
    images: { a: 'product-06-a', b: 'product-06-b' },
  },
  {
    id: 'silk-blouse',
    name: { en: 'Silk blouse', ar: 'بلوزة حريرية' },
    images: { a: 'product-08-a', b: 'product-08-b' },
  },
];

export const curatedEdit: readonly HomeProductMock[] = [
  {
    id: 'embroidered-evening-dress',
    name: { en: 'Embroidered evening dress', ar: 'فستان سهرة مطرّز' },
    images: { a: 'product-02-a', b: 'product-02-b' },
  },
  {
    id: 'linen-summer-dress',
    name: { en: 'Linen summer dress', ar: 'فستان كتان صيفي' },
    images: { a: 'product-03-a', b: 'product-03-b' },
  },
  {
    id: 'long-wool-cardigan',
    name: { en: 'Long wool cardigan', ar: 'كارديغان صوفي طويل' },
    images: { a: 'product-05-a', b: 'product-05-b' },
  },
  {
    id: 'velvet-evening-bag',
    name: { en: 'Velvet evening bag', ar: 'حقيبة سهرة مخملية' },
    images: { a: 'product-07-a', b: 'product-07-b' },
  },
  {
    id: 'wool-tailored-jacket',
    name: { en: 'Wool tailored jacket', ar: 'جاكيت صوفي مفصّل' },
    images: { a: 'product-09-a', b: 'product-09-b' },
  },
];
