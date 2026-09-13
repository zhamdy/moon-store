import type { HomeProductMock } from '../types/home-product';

/**
 * Static mock content for the homepage, mirroring the seed catalogue's vocabulary
 * and price band (1,200–4,500 EGP) rather than inventing a domain. Two datasets,
 * no overlap: four for New Arrivals, five for the Curated Edit (one large card
 * plus four standard, filling the 4×2 desktop grid exactly).
 */
export const newArrivals: readonly HomeProductMock[] = [
  {
    slug: 'silk-midi-dress',
    name: { en: 'Silk midi dress', ar: 'فستان حرير متوسط الطول' },
    price: 2850,
    images: { a: 'product-01-a', b: 'product-01-b' },
    isNew: true,
  },
  {
    slug: 'cashmere-pullover',
    name: { en: 'Cashmere pullover', ar: 'بلوفر كشمير' },
    price: 3200,
    images: { a: 'product-04-a', b: 'product-04-b' },
    isNew: true,
  },
  {
    slug: 'cross-body-leather-bag',
    name: { en: 'Cross-body leather bag', ar: 'حقيبة جلد كروس' },
    price: 2400,
    images: { a: 'product-06-a', b: 'product-06-b' },
    isNew: true,
  },
  {
    slug: 'silk-blouse',
    name: { en: 'Silk blouse', ar: 'بلوزة حرير' },
    price: 1650,
    images: { a: 'product-08-a', b: 'product-08-b' },
    isNew: true,
  },
];

export const curatedEdit: readonly HomeProductMock[] = [
  {
    slug: 'embroidered-evening-dress',
    name: { en: 'Embroidered evening dress', ar: 'فستان سهرة مطرّز' },
    price: 4500,
    images: { a: 'product-02-a', b: 'product-02-b' },
  },
  {
    slug: 'linen-summer-dress',
    name: { en: 'Linen summer dress', ar: 'فستان كتان صيفي' },
    price: 1950,
    images: { a: 'product-03-a', b: 'product-03-b' },
  },
  {
    slug: 'long-wool-cardigan',
    name: { en: 'Long wool cardigan', ar: 'كارديجان صوف طويل' },
    price: 2750,
    images: { a: 'product-05-a', b: 'product-05-b' },
  },
  {
    slug: 'velvet-evening-bag',
    name: { en: 'Velvet evening bag', ar: 'حقيبة سهرة مخمل' },
    price: 1800,
    images: { a: 'product-07-a', b: 'product-07-b' },
  },
  {
    slug: 'wool-tailored-jacket',
    name: { en: 'Wool tailored jacket', ar: 'جاكيت صوف مفصّل' },
    price: 3900,
    images: { a: 'product-09-a', b: 'product-09-b' },
  },
];
