/**
 * The category and collection keys the homepage links to (`/shop/<category>`,
 * `/collections/<slug>`). `features/home/data/commerce-hrefs.test.ts` fails on any
 * homepage commerce href outside this list.
 *
 * String-coupling twin: `REQUIRED_CATALOG_KEYS` in
 * `apps/server/tests/database/seedCatalogKeys.test.ts`, which proves a freshly seeded
 * database serves every key. Neither app may import the other, so the list is
 * duplicated by hand; change both together (docs/CONVENTIONS.md, global
 * string-coupling contract).
 */
export const REQUIRED_CATALOG_KEYS = {
  categories: ['dresses', 'tops', 'knitwear', 'bags', 'abayas'],
  collections: ['evening', 'linen', 'silk'],
} as const;
