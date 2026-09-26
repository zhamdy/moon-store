import { describe, expect, it } from 'vitest';
import { editorialSlots } from '@/lib/editorial/slots';
import { collectionFrames } from '../data/collection-frames';
import { REQUIRED_CATALOG_KEYS } from '../data/required-catalog-keys';
import { collectionFrame } from './collection-frame';
import { COLLECTION_FALLBACK_SLOTS, collectionFallbackSlot } from './collection-image';

describe('collectionFrame', () => {
  it("prefers the collection's own image", () => {
    expect(collectionFrame({ slug: 'evening', imageUrl: 'https://media.example/e.jpg' })).toEqual({
      kind: 'remote',
      url: 'https://media.example/e.jpg',
    });
  });

  it('gives a seeded collection the frame art-directed for it', () => {
    expect(collectionFrame({ slug: 'evening', imageUrl: null })).toEqual({
      kind: 'editorial',
      wide: 'hero-desktop',
      portrait: 'hero-mobile',
    });
    expect(collectionFrame({ slug: 'silk', imageUrl: null })).toMatchObject({
      wide: 'silk-edit-campaign',
      portrait: 'moment',
    });
  });

  it('falls back to one lookbook crop for any other slug', () => {
    const frame = collectionFrame({ slug: 'winter-tailoring', imageUrl: null });
    expect(frame).toEqual({
      kind: 'editorial',
      wide: collectionFallbackSlot('winter-tailoring'),
      portrait: collectionFallbackSlot('winter-tailoring'),
    });
    expect(COLLECTION_FALLBACK_SLOTS).toContain(frame.kind === 'editorial' && frame.wide);
  });

  it('never reads an inherited property as a frame', () => {
    for (const slug of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const frame = collectionFrame({ slug, imageUrl: null });
      expect(frame.kind === 'editorial' && COLLECTION_FALLBACK_SLOTS.includes(frame.wide)).toBe(
        true
      );
    }
  });

  it('art-directs exactly the seeded collections, with registered slots', () => {
    expect(Object.keys(collectionFrames).sort()).toEqual(
      [...REQUIRED_CATALOG_KEYS.collections].sort()
    );
    for (const frame of Object.values(collectionFrames)) {
      expect(editorialSlots).toContain(frame.wide);
      expect(editorialSlots).toContain(frame.portrait);
    }
  });
});
