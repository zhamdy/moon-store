import { describe, it, expect } from 'vitest';
import { POSTPONED_PATHS, isPostponedPath } from './postponedFeatures';

describe('isPostponedPath', () => {
  it.each(POSTPONED_PATHS)('is true for %s', (path) => {
    expect(isPostponedPath(path)).toBe(true);
  });

  it('is true for a sub-path of a postponed path', () => {
    expect(isPostponedPath('/branches/3')).toBe(true);
  });

  it('is false for a path that merely starts with the same letters', () => {
    expect(isPostponedPath('/bundlesx')).toBe(false);
  });

  it('is false for unrelated paths', () => {
    expect(isPostponedPath('/')).toBe(false);
    expect(isPostponedPath('/inventory')).toBe(false);
  });
});
