import { describe, expect, it } from 'vitest';
import {
  CATALOG_EAGER_COUNT,
  CATALOG_GRID_SIZES,
  catalogImageLoading,
  catalogStagger,
} from './grid-layout';

describe('catalog grid layout', () => {
  it('derives sizes from columns, gaps, gutters and the container cap', () => {
    expect(CATALOG_GRID_SIZES).toBe(
      [
        '(min-width: 1440px) 310px',
        '(min-width: 1280px) calc(25vw - 42px)',
        '(min-width: 1024px) calc(33.33vw - 48px)',
        '(min-width: 768px) calc(50vw - 42px)',
        'calc(50vw - 26px)',
      ].join(', ')
    );
  });

  it('loads the widest first row eagerly, with high priority only on the always-first-row cards', () => {
    expect(CATALOG_EAGER_COUNT).toBe(4);
    expect(catalogImageLoading(0)).toEqual({ loading: 'eager', fetchPriority: 'high' });
    expect(catalogImageLoading(1)).toEqual({ loading: 'eager', fetchPriority: 'high' });
    expect(catalogImageLoading(2)).toEqual({ loading: 'eager' });
    expect(catalogImageLoading(3)).toEqual({ loading: 'eager' });
    expect(catalogImageLoading(4)).toEqual({});
  });

  it('staggers the first eight cards only', () => {
    expect(catalogStagger(0)).toBe(0);
    expect(catalogStagger(7)).toBe(7);
    expect(catalogStagger(8)).toBeNull();
  });
});
