import { describe, expect, it } from 'vitest';
import { editorialSlots } from '@/lib/editorial/slots';
import { COLLECTION_FALLBACK_SLOTS, collectionFallbackSlot } from './collection-image';

describe('collectionFallbackSlot', () => {
  it('only ever picks a lookbook slot that exists in the registry', () => {
    expect(COLLECTION_FALLBACK_SLOTS.length).toBeGreaterThan(0);
    for (const slot of COLLECTION_FALLBACK_SLOTS) {
      expect(editorialSlots).toContain(slot);
      expect(slot).toMatch(/^lookbook-/);
    }
  });

  it('is deterministic for a slug', () => {
    expect(collectionFallbackSlot('evening')).toBe(collectionFallbackSlot('evening'));
  });

  it('spreads neighbouring slugs across the set rather than stacking them', () => {
    const picks = ['evening', 'linen', 'abaya', 'knitwear', 'resort'].map(collectionFallbackSlot);
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it('handles an empty slug', () => {
    expect(COLLECTION_FALLBACK_SLOTS).toContain(collectionFallbackSlot(''));
  });
});
