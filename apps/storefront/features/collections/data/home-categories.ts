import type { HomeCategory } from '../types/home-category';

/**
 * Five tiles from the real seed vocabulary (فساتين، بلوزات، تريكو، حقائب، عبايات).
 * Abayas over Outerwear: a real Moon category, and the one that differentiates
 * the brand. Order matters — the first tile takes the large cell of the grid — and follows
 * the shop's own `CATEGORY_ORDER` (QA pass 2026-09-27: the header, footer and wayfinding
 * listed Abayas last while the Shop page lists it third), held by `category-order.test.ts`.
 */
export const homeCategories: readonly HomeCategory[] = [
  {
    key: 'dresses',
    href: '/shop/dresses',
    image: 'category-dresses',
    messageKey: 'dresses',
  },
  { key: 'tops', href: '/shop/tops', image: 'category-tops', messageKey: 'tops' },
  { key: 'abayas', href: '/shop/abayas', image: 'category-abayas', messageKey: 'abayas' },
  {
    key: 'knitwear',
    href: '/shop/knitwear',
    image: 'category-knitwear',
    messageKey: 'knitwear',
  },
  { key: 'bags', href: '/shop/bags', image: 'category-bags', messageKey: 'bags' },
];
