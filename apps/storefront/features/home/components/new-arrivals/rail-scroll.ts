/**
 * Pure scroll rules for the product rail, kept out of the island so they are
 * testable without a DOM. The rail is a CSS scroll-snap scroller: these functions
 * only read its geometry and say where a control should take it.
 *
 * Direction is handled by one fact: in a right-to-left scroller `scrollLeft` is 0
 * at the inline start and goes *negative* toward the end (the CSSOM View rule every
 * current engine follows). Every measurement below therefore works on the absolute
 * distance travelled, and only `railStep` re-signs its result.
 */

/** Sub-pixel slack: a scroller at its end can report a fractional gap. */
export const RAIL_TOLERANCE_PX = 2;

/** How much of the visible width one press of a control travels. */
export const RAIL_STEP_RATIO = 0.8;

export interface RailGeometry {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export interface RailEdges {
  /** There is nothing to scroll: the controls and the progress rule are hidden. */
  scrollable: boolean;
  atStart: boolean;
  atEnd: boolean;
  /** 0 at the inline start, 1 at the end. */
  progress: number;
  /** The visible fraction of the track, which is the progress thumb's width. */
  thumb: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** What the controls and the progress rule read. A rail with nothing to scroll reports both edges. */
export function railEdges({ scrollLeft, scrollWidth, clientWidth }: RailGeometry): RailEdges {
  const max = Math.max(scrollWidth - clientWidth, 0);
  const scrollable = max > RAIL_TOLERANCE_PX;
  if (!scrollable) {
    return { scrollable: false, atStart: true, atEnd: true, progress: 0, thumb: 1 };
  }
  const distance = clamp(Math.abs(scrollLeft), 0, max);
  return {
    scrollable: true,
    atStart: distance <= RAIL_TOLERANCE_PX,
    atEnd: distance >= max - RAIL_TOLERANCE_PX,
    progress: distance / max,
    thumb: clamp(clientWidth / scrollWidth, 0, 1),
  };
}

/**
 * The signed `scrollBy` delta for one press. `direction` is 1 for the next card
 * and -1 for the previous one, always in reading order, so RTL flips the sign.
 */
export function railStep(clientWidth: number, direction: 1 | -1, rtl: boolean): number {
  const magnitude = Math.max(1, Math.round(clientWidth * RAIL_STEP_RATIO));
  return direction * magnitude * (rtl ? -1 : 1);
}

/**
 * Where a released mouse drag settles: the nearest card boundary, as a distance
 * from the inline start. Snapping is off during a drag (a mandatory snap fights
 * every frame of it), so the island puts the rail back on a boundary itself
 * rather than relying on the browser re-snapping when the property comes back.
 */
export function snapTarget(distance: number, step: number, max: number): number {
  if (!(step > 0) || !(max > 0)) {
    return clamp(distance, 0, Math.max(max, 0));
  }
  return clamp(Math.round(clamp(distance, 0, max) / step) * step, 0, max);
}
