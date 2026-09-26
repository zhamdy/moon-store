import { describe, expect, it } from 'vitest';
import type { CatalogCollection } from '@/features/collections/types/catalog-collection';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { collectionChapters, type ChapterPieces } from './collection-chapters';

function collection(slug: string, over: Partial<CatalogCollection> = {}): CatalogCollection {
  return {
    slug,
    name: slug,
    nameEn: slug,
    description: null,
    descriptionEn: null,
    season: null,
    year: null,
    imageUrl: null,
    isFeatured: false,
    productCount: 0,
    ...over,
  };
}

function pieces(count: number, total = count, range = { min: 650, max: 6750 }): ChapterPieces {
  return {
    items: Array.from({ length: count }, (_, i) => ({ slug: `p${i + 1}` }) as CatalogProduct),
    total,
    priceRange: range,
  };
}

const EVENING = collection('evening', { isFeatured: true, productCount: 6 });
const LINEN = collection('linen', { productCount: 5 });
const SILK = collection('silk', { productCount: 6 });

describe('collectionChapters', () => {
  it('numbers the chapters in server order and alternates the photograph side', () => {
    const chapters = collectionChapters([EVENING, LINEN, SILK], [null, null, null]);
    expect(chapters.map((c) => [c.numeral, c.side])).toEqual([
      ['01', 'start'],
      ['02', 'end'],
      ['03', 'start'],
    ]);
  });

  it('gives Midnight to the first featured collection only, and rules between Ivory chapters', () => {
    const second = collection('second', { isFeatured: true });
    const chapters = collectionChapters([EVENING, second, LINEN, SILK], []);
    expect(chapters.map((c) => c.surface)).toEqual(['navy', null, null, null]);
    expect(chapters.map((c) => c.ruleAbove)).toEqual([false, false, true, true]);
  });

  it('has no Midnight chapter when nothing is featured', () => {
    const chapters = collectionChapters([LINEN, SILK], [null, null]);
    expect(chapters.map((c) => c.surface)).toEqual([null, null]);
    expect(chapters.map((c) => c.ruleAbove)).toEqual([false, true]);
  });

  it('names the first four pieces and counts the rest, three on phones', () => {
    const [evening] = collectionChapters([EVENING], [pieces(6)]);
    expect(evening.credits.map((p) => p.slug)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(evening.total).toBe(6);
    expect(evening.more).toBe(2);
    expect(evening.moreCompact).toBe(3);
    expect(evening.priceRange).toEqual({ min: 650, max: 6750 });
  });

  it('counts the whole listing, not just page 1', () => {
    const [big] = collectionChapters([collection('big', { productCount: 30 })], [pieces(24, 30)]);
    expect(big.total).toBe(30);
    expect(big.more).toBe(26);
  });

  it('says nothing more when every piece is named', () => {
    const [small] = collectionChapters([collection('small')], [pieces(3)]);
    expect(small.credits).toHaveLength(3);
    expect(small.more).toBe(0);
    expect(small.moreCompact).toBe(0);

    const [four] = collectionChapters([collection('four')], [pieces(4)]);
    expect(four.more).toBe(0);
    expect(four.moreCompact).toBe(1);
  });

  it('keeps the chapter when its listing failed: no credits, no more line, no range', () => {
    const [linen] = collectionChapters([LINEN], [null]);
    expect(linen.credits).toEqual([]);
    expect(linen.total).toBe(5);
    expect(linen.more).toBe(0);
    expect(linen.moreCompact).toBe(0);
    expect(linen.priceRange).toBeNull();
  });

  it('drops a price range with a missing bound, and a nonsensical count', () => {
    const [open] = collectionChapters(
      [collection('open', { productCount: -3 })],
      [{ items: [], total: Number.NaN, priceRange: { min: null, max: 900 } }]
    );
    expect(open.priceRange).toBeNull();
    expect(open.total).toBe(0);
  });
});
