import { describe, expect, it } from 'vitest';
import { canonicalProductIds, chunkProductIds, mergeProductsById } from './useProductCatalog';

describe('product catalog identity', () => {
  it('canonicalizes equivalent id sets', () => {
    expect(canonicalProductIds([3, 1, 3])).toEqual([1, 3]);
    expect(canonicalProductIds([1, 3])).toEqual([1, 3]);
  });

  it('creates deterministic bounded lookup chunks', () => {
    const chunks = chunkProductIds([...Array.from({ length: 101 }, (_, index) => 101 - index), 1]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(chunks[1]).toEqual([101]);
  });

  it('merges pages and hydrated selections without duplicates', () => {
    expect(mergeProductsById([{ id: 2 }, { id: 1 }], [{ id: 2 }, { id: 3 }])).toEqual([
      { id: 2 },
      { id: 1 },
      { id: 3 },
    ]);
  });
});
