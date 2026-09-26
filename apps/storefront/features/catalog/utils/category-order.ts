/**
 * The order the shop lists its categories in ("Atelier", 2026-09-26): garments first,
 * dresses leading as on the homepage, then shoes, bags and the smaller pieces. The API
 * returns categories in its own order (by Arabic name), which reads as arbitrary in
 * either language.
 *
 * Slugs are the seed's; a category this list does not name keeps its API position
 * after the named ones, so a new category appears without a code change — just last.
 */
export const CATEGORY_ORDER: readonly string[] = [
  'dresses',
  'tops',
  'abayas',
  'knitwear',
  'outerwear',
  'trousers-skirts',
  'kimonos',
  'shoes',
  'bags',
  'accessories',
  'jewellery',
  'scarves-hijabs',
];

/** A new array in `CATEGORY_ORDER`, unknown slugs after it in their original order. */
export function orderCategories<T extends { slug: string }>(categories: readonly T[]): T[] {
  const rank = (slug: string) => {
    const index = CATEGORY_ORDER.indexOf(slug);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };
  return categories
    .map((category, index) => ({ category, index }))
    .sort((a, b) => rank(a.category.slug) - rank(b.category.slug) || a.index - b.index)
    .map(({ category }) => category);
}
