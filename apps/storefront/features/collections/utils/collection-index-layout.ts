import type { CatalogCollection } from '../types/catalog-collection';

type IndexCollection = Pick<CatalogCollection, 'isFeatured'>;

export type CollectionIndexBlock<T extends IndexCollection> =
  /** The index's opening card, the full container width. */
  | { kind: 'feature'; collection: T }
  /** One or two cards side by side from 768px. */
  | { kind: 'pair'; collections: [T] | [T, T] };

/**
 * The collections index is composed by count, not a uniform grid (plan Unit 10).
 * The first featured collection (else the first) opens the page at full width;
 * the rest keep the server's order, paired into 2-up rows.
 *
 * It no longer branches on whether a collection carries an image: every card is
 * a photograph with its name over it, and one with no image of its own borrows
 * an editorial crop (owner decision, 2026-09-21). The `text` block kind and the
 * pair-closing rule it needed went with it.
 */
export function collectionIndexLayout<T extends IndexCollection>(
  collections: readonly T[]
): CollectionIndexBlock<T>[] {
  const featured = collections.find((c) => c.isFeatured) ?? collections[0];
  if (!featured) return [];

  const blocks: CollectionIndexBlock<T>[] = [{ kind: 'feature', collection: featured }];
  const rest = collections.filter((c) => c !== featured);
  for (let i = 0; i < rest.length; i += 2) {
    const pair = rest.slice(i, i + 2) as [T] | [T, T];
    blocks.push({ kind: 'pair', collections: pair });
  }
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
