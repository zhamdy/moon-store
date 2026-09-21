import { describe, expect, it } from 'vitest';
import {
  collectionIndexLayout,
  collectionMeta,
  type CollectionIndexBlock,
} from './collection-index-layout';

type Item = { slug: string; isFeatured: boolean };

const c = (slug: string, isFeatured = false): Item => ({ slug, isFeatured });

const shape = (blocks: CollectionIndexBlock<Item>[]) =>
  blocks.map((b) =>
    b.kind === 'grid'
      ? `grid:${b.collections.map((x) => x.slug).join('+')}`
      : `${b.kind}:${b.collection.slug}`
  );

describe('collectionIndexLayout', () => {
  it('is empty for no collections', () => {
    expect(collectionIndexLayout([])).toEqual([]);
  });

  it('renders a single collection as just the opening card, with no empty grid', () => {
    expect(shape(collectionIndexLayout([c('silk')]))).toEqual(['feature:silk']);
  });

  it('opens on the first featured collection, then grids the rest in order', () => {
    const list = [c('a'), c('b', true), c('d'), c('e')];
    expect(shape(collectionIndexLayout(list))).toEqual(['feature:b', 'grid:a+d+e']);
  });

  it('opens on the first collection when none is featured', () => {
    expect(shape(collectionIndexLayout([c('a'), c('b'), c('d')]))).toEqual([
      'feature:a',
      'grid:b+d',
    ]);
  });

  it('composes every collection the same way, image or not', () => {
    const list = [c('f', true), c('a'), c('t'), c('b'), c('d')];
    expect(shape(collectionIndexLayout(list))).toEqual(['feature:f', 'grid:a+t+b+d']);
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
