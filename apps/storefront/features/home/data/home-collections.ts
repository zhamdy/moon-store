import { collectionFrames } from '@/features/collections/data/collection-frames';
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

/**
 * The film is the Evening collection, so its opening frame is Evening's own photograph:
 * the 16:10 crop when the viewport is at least 3:2, the 4:5 crop below (`collectionFrames`,
 * which the collections index and the Evening page read too).
 */
export const filmFrame = collectionFrames[homeCollections.film];

/** The Silk Edit: the Silk collection's own wide frame, cut into the New in grid. */
export const sceneSlot: EditorialSlot = collectionFrames[homeCollections.scene].wide;

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
