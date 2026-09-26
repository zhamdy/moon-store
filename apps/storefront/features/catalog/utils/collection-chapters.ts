import type { CatalogCollection } from '@/features/collections/types/catalog-collection';
import type { CatalogPriceRange, CatalogProduct } from '@/features/products/types/catalog-product';

/** Pieces a chapter names from 768 up, and below it (the phone's shorter list). */
export const CHAPTER_CREDITS = 4;
export const CHAPTER_CREDITS_COMPACT = 3;

/** What `loadCollectionPieces` read: the collection's listing page 1. */
export interface ChapterPieces {
  items: CatalogProduct[];
  /** The listing's `totalItems`: every active piece, not just page 1. */
  total: number;
  priceRange: CatalogPriceRange;
}

export interface CollectionChapterModel {
  collection: CatalogCollection;
  /** Its place in the server's order, two digits: "01". */
  numeral: string;
  /** `navy` (Midnight) for the page's one nocturnal chapter, else the page's own Ivory. */
  surface: 'navy' | null;
  /** Which side of the chapter the photograph takes from 1024, alternating. */
  side: 'start' | 'end';
  /** A hairline above it: two Ivory chapters in a row need one between them. */
  ruleAbove: boolean;
  /** The first pieces in curated order; empty when the listing could not be read. */
  credits: CatalogProduct[];
  /** Pieces the list does not name ("+ 2 more pieces"), from 768 and below it. */
  more: number;
  moreCompact: number;
  /** Every active piece in the collection. */
  total: number;
  /** Lowest and highest price, or null when the listing gave none. */
  priceRange: { min: number; max: number } | null;
}

function wholeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

/**
 * The collections index as chapters ("Chapters", owner decision 2026-09-26), one per live
 * collection in the server's order (featured first). Pure: `pieces[i]` is the listing
 * read for `collections[i]`, or `null` when that read failed.
 *
 * - **Midnight once.** The design system reserves Midnight for one cinematic moment per
 *   page and names the Evening chapter as one; the first featured collection gets it. No
 *   featured collection, no Midnight: every chapter is Ivory.
 * - **The photograph alternates sides**, starting at the inline start, so no two
 *   neighbouring chapters share a composition.
 * - **Credits are real pieces only.** The count comes from the same listing when it was
 *   read (it is what the collection page will show), else from the collection's own
 *   `productCount`; the "more" line never counts a piece twice or below zero.
 */
export function collectionChapters(
  collections: readonly CatalogCollection[],
  pieces: readonly (ChapterPieces | null)[]
): CollectionChapterModel[] {
  const nocturnal = collections.findIndex((collection) => collection.isFeatured);
  const surfaceOf = (index: number) => (index === nocturnal ? 'navy' : null);

  return collections.map((collection, index) => {
    const read = pieces[index] ?? null;
    const credits = read ? read.items.slice(0, CHAPTER_CREDITS) : [];
    const total = wholeCount(read ? read.total : collection.productCount);
    const { min, max } = read?.priceRange ?? { min: null, max: null };
    // "+ n more" only follows a list: with no credits it would count the whole collection.
    const unnamed = (shown: number) => (shown > 0 ? Math.max(0, total - shown) : 0);

    return {
      collection,
      numeral: String(index + 1).padStart(2, '0'),
      surface: surfaceOf(index),
      side: index % 2 === 0 ? 'start' : 'end',
      ruleAbove: index > 0 && surfaceOf(index) === null && surfaceOf(index - 1) === null,
      credits,
      more: unnamed(credits.length),
      moreCompact: unnamed(Math.min(credits.length, CHAPTER_CREDITS_COMPACT)),
      total,
      priceRange: min !== null && max !== null ? { min, max } : null,
    };
  });
}
