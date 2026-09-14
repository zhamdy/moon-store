import type { HomeCategory } from '../types/home-category';

/**
 * Five tiles from the real seed vocabulary (فساتين، بلوزات، تريكو، حقائب، عبايات).
 * Abayas over Outerwear: a real Moon category, and the one that differentiates
 * the brand. Order matters — the first tile takes the large cell of the grid.
 */
export const homeCategories: readonly HomeCategory[] = [
  {
    key: 'dresses',
    href: '/shop/dresses',
    image: 'category-dresses',
    messageKey: 'dresses',
  },
  { key: 'tops', href: '/shop/tops', image: 'category-tops', messageKey: 'tops' },
  {
    key: 'knitwear',
    href: '/shop/knitwear',
    image: 'category-knitwear',
    messageKey: 'knitwear',
  },
  { key: 'bags', href: '/shop/bags', image: 'category-bags', messageKey: 'bags' },
  { key: 'abayas', href: '/shop/abayas', image: 'category-abayas', messageKey: 'abayas' },
];
