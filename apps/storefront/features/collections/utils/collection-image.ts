import { editorialSlots, type EditorialSlot } from '@/lib/editorial/slots';

/**
 * The editorial photographs a collection with no image of its own borrows from.
 * Lookbook crops only: they are the one role in the registry that is a figure in
 * a setting rather than a product or a category, so a collection card built on
 * one reads as an edit rather than as a mislabelled garment.
 */
export const COLLECTION_FALLBACK_SLOTS = editorialSlots.filter((slot) =>
  slot.startsWith('lookbook-')
) as readonly EditorialSlot[];

/**
 * Which fallback a slug gets. Deterministic, so a collection keeps the same
 * photograph across renders and locales — a fallback that reshuffled per request
 * would make the index look like it had changed when nothing had.
 *
 * Seeded collections carry no image (`apps/server` seeds them without one), so
 * without this every card but the first would be a typographic row. It is a
 * **stand-in, not a claim**: the photograph does not depict that collection, and
 * a real one replaces it the moment the collection is given an image in the
 * dashboard. The alt text stays empty for exactly that reason.
 */
export function collectionFallbackSlot(slug: string): EditorialSlot {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) % 0xffffffff;
  }
  return COLLECTION_FALLBACK_SLOTS[hash % COLLECTION_FALLBACK_SLOTS.length];
}
