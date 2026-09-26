import type { EditorialSlot } from '@/lib/editorial/slots';
import { collectionFrames, type EditorialFrame } from '../data/collection-frames';
import type { CatalogCollection } from '../types/catalog-collection';
import { collectionFallbackSlot } from './collection-image';

/**
 * Where a collection's photograph comes from, as slots and URLs only, so it stays
 * testable without importing the image registry (no spec may import `images.ts`).
 * `CollectionFrameImage` resolves it.
 */
export type CollectionFrame =
  | { kind: 'remote'; url: string }
  | ({ kind: 'editorial' } & EditorialFrame);

/**
 * In order: the collection's own image (set in the dashboard; already absolute), the
 * frame art-directed for a seeded collection (`collectionFrames`), else one lookbook
 * crop for both shapes (`collectionFallbackSlot`). The last two are stand-ins: they do
 * not depict the collection, which is why every consumer renders them with empty alt.
 */
export function collectionFrame(
  collection: Pick<CatalogCollection, 'slug' | 'imageUrl'>
): CollectionFrame {
  if (collection.imageUrl) return { kind: 'remote', url: collection.imageUrl };

  // An own-property check: a slug is API data, and `collectionFrames.constructor` exists.
  if (Object.hasOwn(collectionFrames, collection.slug)) {
    const own = collectionFrames[collection.slug as keyof typeof collectionFrames];
    return { kind: 'editorial', ...own };
  }

  const slot: EditorialSlot = collectionFallbackSlot(collection.slug);
  return { kind: 'editorial', wide: slot, portrait: slot };
}
