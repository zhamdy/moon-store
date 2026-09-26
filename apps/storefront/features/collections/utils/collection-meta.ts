import type { CatalogCollection } from '../types/catalog-collection';

/** "Summer · 2026", or `null` when the collection carries neither. */
export function collectionMeta(
  collection: Pick<CatalogCollection, 'season' | 'year'>
): string | null {
  const season = collection.season?.trim() || null;
  const parts = [season, collection.year].filter((part) => part !== null && part !== undefined);
  return parts.length > 0 ? parts.join(' · ') : null;
}
