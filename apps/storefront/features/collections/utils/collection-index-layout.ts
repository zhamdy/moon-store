import type { CatalogCollection } from '../types/catalog-collection';

type IndexCollection = Pick<CatalogCollection, 'isFeatured' | 'imageUrl'>;

export type CollectionIndexBlock<T extends IndexCollection> =
  /** The large 7/5 split; always has an image. */
  | { kind: 'feature'; collection: T }
  /** One or two image cards side by side from 768px. */
  | { kind: 'pair'; collections: [T] | [T, T] }
  /** No image: a typographic row, never a fake image tile. */
  | { kind: 'text'; collection: T };

/**
 * The collections index is composed by count, not a uniform grid (plan Unit 10).
 * The first featured collection with an image (else the first collection with
 * one) becomes the split; the rest keep the server's order, image collections
 * paired into 2-up rows and image-less ones as text rows. A text row closes a pair
 * in progress, so order is never shuffled to fill a row.
 */
export function collectionIndexLayout<T extends IndexCollection>(
  collections: readonly T[]
): CollectionIndexBlock<T>[] {
  const featured =
    collections.find((c) => c.isFeatured && c.imageUrl) ?? collections.find((c) => c.imageUrl);
  const blocks: CollectionIndexBlock<T>[] = featured
    ? [{ kind: 'feature', collection: featured }]
    : [];

  let pending: T | null = null;
  for (const collection of collections) {
    if (collection === featured) continue;
    if (!collection.imageUrl) {
      if (pending) blocks.push({ kind: 'pair', collections: [pending] });
      pending = null;
      blocks.push({ kind: 'text', collection });
    } else if (pending) {
      blocks.push({ kind: 'pair', collections: [pending, collection] });
      pending = null;
    } else {
      pending = collection;
    }
  }
  if (pending) blocks.push({ kind: 'pair', collections: [pending] });
  return blocks;
}

/** "Summer · 2026", or `null` when the collection carries neither. */
export function collectionMeta(
  collection: Pick<CatalogCollection, 'season' | 'year'>
): string | null {
  const season = collection.season?.trim() || null;
  const parts = [season, collection.year].filter((part) => part !== null && part !== undefined);
  return parts.length > 0 ? parts.join(' · ') : null;
}
