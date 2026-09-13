import type { HomeCategory } from '../types/home-category';

/**
 * Five tiles from the real seed vocabulary (فساتين، بلوزات، تريكو، حقائب، عبايات).
 * Abayas over Outerwear: a real Moon category, and the one that differentiates
 * the brand. Order matters — the first tile takes the large cell of the grid.
 */
export const homeCategories: readonly HomeCategory[] = [
  {
    key: 'dresses',
    href: '/collections/dresses',
    image: 'category-dresses',
    messageKey: 'dresses',
  },
  { key: 'tops', href: '/collections/tops', image: 'category-tops', messageKey: 'tops' },
  {
    key: 'knitwear',
    href: '/collections/knitwear',
    image: 'category-knitwear',
    messageKey: 'knitwear',
  },
  { key: 'bags', href: '/collections/bags', image: 'category-bags', messageKey: 'bags' },
  { key: 'abayas', href: '/collections/abayas', image: 'category-abayas', messageKey: 'abayas' },
];
