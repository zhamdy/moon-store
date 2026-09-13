/**
 * Every editorial image slot the homepage composes, as plain data. Deliberately
 * free of image imports so data tests (`features/products/data/*.test.ts`) can
 * validate slot references under vitest's node environment, where a static `.jpg`
 * import is meaningless. `lib/editorial/images.ts` binds each slot to its file.
 *
 * Expected ratio and minimum pixels per slot live in
 * `docs/design/editorial-image-brief.md`, not here: every frame is CSS
 * `aspect-ratio` + `object-cover`, so a wrong-shape swap crops rather than
 * distorts, and the screenshot review is the guard.
 */
export const editorialSlots = [
  // Hero slides, one desktop (16:10) and one mobile (4:5) crop each. The Evening
  // slide keeps the original `hero-desktop` / `hero-mobile` names.
  'hero-desktop',
  'hero-mobile',
  'hero-linen-desktop',
  'hero-linen-mobile',
  'hero-abaya-desktop',
  'hero-abaya-mobile',
  'hero-knitwear-desktop',
  'hero-knitwear-mobile',
  'strip-01',
  'strip-02',
  'strip-03',
  'strip-04',
  'moment',
  // 16:9 desktop crop of the editorial moment; `moment` stays the 4:5 mobile crop.
  'moment-wide',
  'featured-large',
  'featured-small',
  'category-dresses',
  'category-tops',
  'category-knitwear',
  'category-bags',
  'category-abayas',
  'campaign',
  'lookbook-01',
  'lookbook-02',
  'lookbook-03',
  'lookbook-04',
  'lookbook-05',
] as const;

export type EditorialSlot = (typeof editorialSlots)[number];

/** Nine products × two views (`a` front, `b` alternate/detail) — all 4:5. */
export const catalogSlots = [
  'product-01-a',
  'product-01-b',
  'product-02-a',
  'product-02-b',
  'product-03-a',
  'product-03-b',
  'product-04-a',
  'product-04-b',
  'product-05-a',
  'product-05-b',
  'product-06-a',
  'product-06-b',
  'product-07-a',
  'product-07-b',
  'product-08-a',
  'product-08-b',
  'product-09-a',
  'product-09-b',
] as const;

export type CatalogSlot = (typeof catalogSlots)[number];

export type ImageSlot = EditorialSlot | CatalogSlot;

export type ImageRole = 'hero' | 'editorial' | 'catalog' | 'category' | 'lookbook';
