import { describe, expect, it } from 'vitest';
import { decideInitialRevealState } from './reveal-policy';

describe('decideInitialRevealState', () => {
  it('holds back an element that starts below the viewport', () => {
    expect(decideInitialRevealState({ top: 1200, bottom: 1600 }, 900, false)).toBe('pending');
  });

  it('shows an element fully inside the viewport at mount', () => {
    expect(decideInitialRevealState({ top: 100, bottom: 500 }, 900, false)).toBe('in');
  });

  it('shows an element straddling the fold — partially visible is visible', () => {
    expect(decideInitialRevealState({ top: 800, bottom: 1100 }, 900, false)).toBe('in');
  });

  it('shows an element already scrolled past', () => {
    expect(decideInitialRevealState({ top: -600, bottom: -200 }, 900, false)).toBe('in');
  });

  it('shows an element sitting exactly at the fold edge only once it is below it', () => {
    expect(decideInitialRevealState({ top: 900, bottom: 1300 }, 900, false)).toBe('pending');
    expect(decideInitialRevealState({ top: 899, bottom: 1300 }, 900, false)).toBe('in');
  });

  it('falls back to visible for a zero or non-finite viewport', () => {
    expect(decideInitialRevealState({ top: 1200, bottom: 1600 }, 0, false)).toBe('in');
    expect(decideInitialRevealState({ top: 1200, bottom: 1600 }, Number.NaN, false)).toBe('in');
  });

  it('falls back to visible for a rect with non-finite edges', () => {
    expect(decideInitialRevealState({ top: Number.NaN, bottom: 1600 }, 900, false)).toBe('in');
    expect(
      decideInitialRevealState({ top: 1200, bottom: Number.POSITIVE_INFINITY }, 900, false)
    ).toBe('in');
  });

  it('never holds anything back under reduced motion', () => {
    expect(decideInitialRevealState({ top: 5000, bottom: 5400 }, 900, true)).toBe('in');
  });

  it('treats an unknown preference (server snapshot) like motion allowed', () => {
    expect(decideInitialRevealState({ top: 1200, bottom: 1600 }, 900, null)).toBe('pending');
  });
});
