import { describe, expect, it } from 'vitest';
import { railEdges, railStep, snapTarget } from './rail-scroll';

describe('railEdges', () => {
  const track = { scrollWidth: 2000, clientWidth: 1000 };

  it('reports both edges and hides itself when there is nothing to scroll', () => {
    expect(railEdges({ scrollLeft: 0, scrollWidth: 1000, clientWidth: 1000 })).toEqual({
      scrollable: false,
      atStart: true,
      atEnd: true,
      progress: 0,
      thumb: 1,
    });
  });

  it('is at the start before any travel', () => {
    const edges = railEdges({ scrollLeft: 0, ...track });
    expect(edges).toMatchObject({ scrollable: true, atStart: true, atEnd: false, progress: 0 });
    expect(edges.thumb).toBe(0.5);
  });

  it('is at the end within the sub-pixel tolerance', () => {
    expect(railEdges({ scrollLeft: 999.4, ...track })).toMatchObject({
      atStart: false,
      atEnd: true,
      progress: expect.closeTo(0.999, 3),
    });
  });

  // RTL scrollers count the same travel as a negative scrollLeft.
  it('reads a right-to-left scroller from the same distance', () => {
    expect(railEdges({ scrollLeft: -500, ...track })).toEqual(
      railEdges({ scrollLeft: 500, ...track })
    );
  });

  it('clamps an over-scrolled (rubber-banded) position', () => {
    expect(railEdges({ scrollLeft: 1400, ...track }).progress).toBe(1);
  });
});

describe('railStep', () => {
  it('travels four fifths of the visible width toward the reading direction', () => {
    expect(railStep(1000, 1, false)).toBe(800);
    expect(railStep(1000, -1, false)).toBe(-800);
  });

  it('flips the sign under RTL, where the end is a negative scrollLeft', () => {
    expect(railStep(1000, 1, true)).toBe(-800);
    expect(railStep(1000, -1, true)).toBe(800);
  });

  it('never resolves to a zero step on a hairline-wide rail', () => {
    expect(railStep(1, 1, false)).toBe(1);
  });
});

describe('snapTarget', () => {
  it('settles on the nearest card boundary', () => {
    expect(snapTarget(310, 300, 1200)).toBe(300);
    expect(snapTarget(460, 300, 1200)).toBe(600);
  });

  it('never lands past either end', () => {
    expect(snapTarget(1190, 300, 1200)).toBe(1200);
    expect(snapTarget(-40, 300, 1200)).toBe(0);
  });

  it('leaves the position alone when the step or the track is unmeasurable', () => {
    expect(snapTarget(120, 0, 1200)).toBe(120);
    expect(snapTarget(120, 300, 0)).toBe(0);
  });
});
