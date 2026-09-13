import { describe, expect, it } from 'vitest';
import {
  resolveKeyTarget,
  stepFromKey,
  stepFromSwipe,
  SWIPE_THRESHOLD_PX,
  wrapIndex,
} from './hero-carousel-state';

describe('wrapIndex', () => {
  it('keeps an in-range index', () => {
    expect(wrapIndex(2, 4)).toBe(2);
  });

  it('wraps past the end back to the first slide', () => {
    expect(wrapIndex(4, 4)).toBe(0);
    expect(wrapIndex(9, 4)).toBe(1);
  });

  it('wraps before the start to the last slide', () => {
    expect(wrapIndex(-1, 4)).toBe(3);
    expect(wrapIndex(-5, 4)).toBe(3);
  });

  it('returns 0 when there are no slides or the index is not finite', () => {
    expect(wrapIndex(3, 0)).toBe(0);
    expect(wrapIndex(Number.NaN, 4)).toBe(0);
  });
});

describe('stepFromKey', () => {
  it('moves forward with ArrowRight and back with ArrowLeft in LTR', () => {
    expect(stepFromKey('ArrowRight', false)).toBe(1);
    expect(stepFromKey('ArrowLeft', false)).toBe(-1);
  });

  it('mirrors the arrows in RTL', () => {
    expect(stepFromKey('ArrowRight', true)).toBe(-1);
    expect(stepFromKey('ArrowLeft', true)).toBe(1);
  });

  it('maps Home and End regardless of direction', () => {
    expect(stepFromKey('Home', true)).toBe('first');
    expect(stepFromKey('End', false)).toBe('last');
  });

  it('ignores every other key', () => {
    expect(stepFromKey('Enter', false)).toBeNull();
    expect(stepFromKey('ArrowDown', false)).toBeNull();
    expect(stepFromKey('Tab', true)).toBeNull();
  });
});

describe('resolveKeyTarget', () => {
  it('wraps arrow steps at both ends', () => {
    expect(resolveKeyTarget(1, 3, 4)).toBe(0);
    expect(resolveKeyTarget(-1, 0, 4)).toBe(3);
  });

  it('jumps to the first and last slide', () => {
    expect(resolveKeyTarget('first', 2, 4)).toBe(0);
    expect(resolveKeyTarget('last', 0, 4)).toBe(3);
  });

  it('stays at 0 with no slides', () => {
    expect(resolveKeyTarget('last', 0, 0)).toBe(0);
  });
});

describe('stepFromSwipe', () => {
  it('advances on a leftward swipe and goes back on a rightward one in LTR', () => {
    expect(stepFromSwipe(-80, false)).toBe(1);
    expect(stepFromSwipe(80, false)).toBe(-1);
  });

  it('mirrors swipe direction in RTL', () => {
    expect(stepFromSwipe(80, true)).toBe(1);
    expect(stepFromSwipe(-80, true)).toBe(-1);
  });

  it('ignores drags shorter than the threshold', () => {
    expect(stepFromSwipe(SWIPE_THRESHOLD_PX - 1, false)).toBe(0);
    expect(stepFromSwipe(-(SWIPE_THRESHOLD_PX - 1), true)).toBe(0);
    expect(stepFromSwipe(-SWIPE_THRESHOLD_PX, false)).toBe(1);
  });

  it('ignores a non-finite distance', () => {
    expect(stepFromSwipe(Number.NaN, false)).toBe(0);
  });
});
