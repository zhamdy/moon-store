/**
 * The catalogue collections the homepage names (homepage Phase 2). Both are
 * `REQUIRED_CATALOG_KEYS` keys, which `commerce-hrefs.test.ts` holds them to.
 *
 * - `featured`: the Featured collection section's destination ("The Evening Edit").
 * - `selection`: the collection The Moon Selection reads its five pieces from, through
 *   the ordinary listing in its curated order (owner decision, 2026-09-25). The seed
 *   marks `evening` as featured; pointing the selection at another collection is this
 *   one line and the dashboard's curation.
 */
export const homeCollections = {
  featured: 'evening',
  selection: 'evening',
} as const;

export const collectionHref = (slug: string) => `/collections/${slug}`;
