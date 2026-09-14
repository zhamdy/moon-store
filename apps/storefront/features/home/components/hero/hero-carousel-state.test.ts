import { describe, expect, it } from 'vitest';
import {
  carouselState,
  resolveKeyTarget,
  slideMediaVisible,
  stepFromKey,
  stepFromSwipe,
  SWIPE_THRESHOLD_PX,
  wrapIndex,
} from './hero-carousel-state';

const BASE = {
  hydrated: true,
  reducedMotion: false,
  stopped: false,
  hovered: false,
  inView: true,
  total: 4,
};

describe('carouselState', () => {
  it('runs when hydrated, in view, not stopped, no reduced motion, not hovered, total > 1', () => {
    expect(carouselState(BASE)).toBe('running');
  });

  it('pauses when out of view, and resumes running when back in view', () => {
    expect(carouselState({ ...BASE, inView: false })).toBe('paused');
    expect(carouselState({ ...BASE, inView: true })).toBe('running');
  });

  it('stays stopped throughout, whether in view or not', () => {
    expect(carouselState({ ...BASE, stopped: true, inView: true })).toBe('stopped');
    expect(carouselState({ ...BASE, stopped: true, inView: false })).toBe('stopped');
  });

  it('never runs under reduced motion, regardless of other inputs', () => {
    expect(carouselState({ ...BASE, reducedMotion: true })).toBe('stopped');
    expect(carouselState({ ...BASE, reducedMotion: true, inView: false, hovered: true })).toBe(
      'stopped'
    );
  });

  it('pauses while hovered in view, and resumes when hover ends', () => {
    expect(carouselState({ ...BASE, hovered: true })).toBe('paused');
    expect(carouselState({ ...BASE, hovered: false })).toBe('running');
  });

  it('is idle before hydration', () => {
    expect(carouselState({ ...BASE, hydrated: false })).toBe('idle');
  });

  it('never runs with a single slide', () => {
    expect(carouselState({ ...BASE, total: 1 })).toBe('stopped');
  });
});

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

describe('slideMediaVisible', () => {
  const visible = (input: Partial<Parameters<typeof slideMediaVisible>[0]>) =>
    [0, 1, 2, 3].filter((index) =>
      slideMediaVisible({
        index,
        active: 0,
        previous: null,
        total: 4,
        rotating: false,
        primed: [],
        ...input,
      })
    );

  it('renders only the lead photograph before rotation starts (server HTML, no JS)', () => {
    expect(visible({})).toEqual([0]);
  });

  it('adds the next slide while rotating, so the change never shows an empty frame', () => {
    expect(visible({ rotating: true })).toEqual([0, 1]);
  });

  it('wraps the next slide from the last one back to the first', () => {
    expect(visible({ active: 3, previous: 2, rotating: true })).toEqual([0, 2, 3]);
  });

  it('keeps the leaving slide so its exit can play', () => {
    expect(visible({ active: 2, previous: 1 })).toEqual([1, 2]);
  });

  it('keeps primed slides once shown, hovered or focused', () => {
    expect(visible({ active: 1, previous: 0, primed: [0, 3] })).toEqual([0, 1, 3]);
  });

  it('does not preload the next slide once rotation has stopped', () => {
    expect(visible({ active: 1, rotating: false })).toEqual([1]);
  });

  it('never preloads with a single slide', () => {
    expect(
      slideMediaVisible({
        index: 0,
        active: 0,
        previous: null,
        total: 1,
        rotating: true,
        primed: [],
      })
    ).toBe(true);
  });
});
