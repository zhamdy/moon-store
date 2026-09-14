import { describe, expect, it } from 'vitest';
import { paginationWindow } from './pagination-window';

describe('paginationWindow', () => {
  it('gives [1] for a single page', () => {
    expect(paginationWindow(1, 1)).toEqual([1]);
  });

  it('lists every page when there are few enough', () => {
    expect(paginationWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('gaps both sides of a middle page', () => {
    expect(paginationWindow(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
  });

  it('gaps only the leading side on the last page', () => {
    expect(paginationWindow(12, 12)).toEqual([1, 'gap', 10, 11, 12]);
  });

  it('shows a single hidden page instead of a gap', () => {
    expect(paginationWindow(4, 12)).toEqual([1, 2, 3, 4, 5, 'gap', 12]);
    expect(paginationWindow(9, 12)).toEqual([1, 'gap', 8, 9, 10, 11, 12]);
  });

  it('keeps the window three wide on the first page', () => {
    expect(paginationWindow(1, 12)).toEqual([1, 2, 3, 'gap', 12]);
  });

  it('never exceeds 7 slots', () => {
    for (let total = 1; total <= 40; total++) {
      for (let current = 1; current <= total; current++) {
        expect(paginationWindow(current, total).length).toBeLessThanOrEqual(7);
      }
    }
  });

  it('clamps an out-of-range current page and returns nothing for no pages', () => {
    expect(paginationWindow(99, 3)).toEqual([1, 2, 3]);
    expect(paginationWindow(0, 12)).toEqual([1, 2, 3, 'gap', 12]);
    expect(paginationWindow(1, 0)).toEqual([]);
  });
});
