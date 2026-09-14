import { describe, expect, it } from 'vitest';
import {
  collectionIndexLayout,
  collectionMeta,
  type CollectionIndexBlock,
} from './collection-index-layout';

type Item = { slug: string; isFeatured: boolean; imageUrl: string | null };

const c = (slug: string, image: boolean, isFeatured = false): Item => ({
  slug,
  isFeatured,
  imageUrl: image ? `https://media.example/${slug}.jpg` : null,
});

const shape = (blocks: CollectionIndexBlock<Item>[]) =>
  blocks.map((b) =>
    b.kind === 'pair'
      ? `pair:${b.collections.map((x) => x.slug).join('+')}`
      : `${b.kind}:${b.collection.slug}`
  );

describe('collectionIndexLayout', () => {
  it('is empty for no collections', () => {
    expect(collectionIndexLayout([])).toEqual([]);
  });

  it('renders a single collection as just the split', () => {
    expect(shape(collectionIndexLayout([c('silk', true)]))).toEqual(['feature:silk']);
  });

  it('features the first featured collection with an image, then pairs the rest in order', () => {
    const list = [c('a', true), c('b', true, true), c('d', true), c('e', true)];
    expect(shape(collectionIndexLayout(list))).toEqual(['feature:b', 'pair:a+d', 'pair:e']);
  });

  it('skips an image-less featured collection for the split', () => {
    const list = [c('a', false, true), c('b', true), c('d', true)];
    expect(shape(collectionIndexLayout(list))).toEqual(['feature:b', 'text:a', 'pair:d']);
  });

  it('closes a pair in progress at a text row, keeping order', () => {
    const list = [c('f', true, true), c('a', true), c('t', false), c('b', true), c('d', true)];
    expect(shape(collectionIndexLayout(list))).toEqual([
      'feature:f',
      'pair:a',
      'text:t',
      'pair:b+d',
    ]);
  });

  it('has no split when no collection has an image', () => {
    expect(shape(collectionIndexLayout([c('a', false, true), c('b', false)]))).toEqual([
      'text:a',
      'text:b',
    ]);
  });
});

describe('collectionMeta', () => {
  it('joins season and year, dropping missing parts', () => {
    expect(collectionMeta({ season: 'Summer', year: 2026 })).toBe('Summer · 2026');
    expect(collectionMeta({ season: '  ', year: 2026 })).toBe('2026');
    expect(collectionMeta({ season: 'Resort', year: null })).toBe('Resort');
    expect(collectionMeta({ season: null, year: null })).toBeNull();
  });
});
