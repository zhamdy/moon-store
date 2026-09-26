import { describe, expect, it } from 'vitest';
import { collectionMeta } from './collection-meta';

describe('collectionMeta', () => {
  it('joins season and year, dropping missing parts', () => {
    expect(collectionMeta({ season: 'Summer', year: 2026 })).toBe('Summer · 2026');
    expect(collectionMeta({ season: '  ', year: 2026 })).toBe('2026');
    expect(collectionMeta({ season: 'Resort', year: null })).toBe('Resort');
    expect(collectionMeta({ season: null, year: null })).toBeNull();
  });
});
