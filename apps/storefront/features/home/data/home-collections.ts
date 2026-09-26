import type { EditorialSlot } from '@/lib/editorial/slots';

/**
 * Everything the "Shop the Film" homepage (2026-09-26) names in the catalogue, in one
 * place. Every collection here is a `REQUIRED_CATALOG_KEYS` key, which
 * `commerce-hrefs.test.ts` holds it to; the photographs are editorial slots.
 *
 * - `film`: the collection the opening frame shows, and the one its credits row reads
 *   (`loadFilmCredits`). The seed marks `evening` as featured.
 * - `scene`: the editorial frame cut into the New in grid (The Silk Edit).
 * - `looks`: three lookbook photographs, each leading to the collection it was shot
 *   for. A look links to a **collection**, never to named products: the photographs are
 *   editorial and name no piece the shop sells (the HIGH-1 lesson).
 */
export const homeCollections = {
  film: 'evening',
  scene: 'silk',
} as const;

export const collectionHref = (slug: string) => `/collections/${slug}`;

export const filmFrame = {
  /** Wide crop (16:10), used when the viewport is at least 3:2. */
  wide: 'hero-desktop',
  /** Portrait crop (4:5), phones and tablets. */
  portrait: 'hero-mobile',
} as const satisfies Record<string, EditorialSlot>;

export const sceneSlot: EditorialSlot = 'silk-edit-campaign';

export interface Look {
  key: 'evening' | 'linen' | 'silk';
  slot: EditorialSlot;
  collection: string;
}

export const looks: readonly Look[] = [
  { key: 'evening', slot: 'lookbook-03', collection: 'evening' },
  { key: 'linen', slot: 'lookbook-01', collection: 'linen' },
  { key: 'silk', slot: 'lookbook-05', collection: 'silk' },
];
