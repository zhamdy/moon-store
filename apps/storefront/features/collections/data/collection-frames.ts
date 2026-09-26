import type { EditorialSlot } from '@/lib/editorial/slots';
import type { REQUIRED_CATALOG_KEYS } from './required-catalog-keys';

type SeededCollection = (typeof REQUIRED_CATALOG_KEYS.collections)[number];

/** One collection's photograph in its two crops: 16:10 (or wider) and 4:5. */
export interface EditorialFrame {
  wide: EditorialSlot;
  portrait: EditorialSlot;
}

/**
 * The photograph each seeded collection shows until it is given an image of its own in
 * the dashboard ("Chapters", owner decision 2026-09-26). These are the frames the image
 * brief (`docs/design/editorial-image-brief.md`) art-directed for those collections: the
 * Evening slide (the homepage's opening frame, `filmFrame`), the Linen slide and The Silk
 * Edit. Like `collectionFallbackSlot`'s lookbook crops, it is a **stand-in, not a
 * claim**: the alt text stays empty, and a collection's own `imageUrl` always wins.
 *
 * Keyed by `REQUIRED_CATALOG_KEYS.collections`, so a key the seed does not serve fails
 * typecheck here rather than silently never matching. Any other slug falls back to a
 * lookbook crop (`collectionFrame`).
 */
export const collectionFrames: Record<SeededCollection, EditorialFrame> = {
  evening: { wide: 'hero-desktop', portrait: 'hero-mobile' },
  linen: { wide: 'hero-linen-desktop', portrait: 'hero-linen-mobile' },
  silk: { wide: 'silk-edit-campaign', portrait: 'moment' },
};
