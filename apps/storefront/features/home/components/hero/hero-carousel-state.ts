/**
 * Pure navigation rules for the hero carousel, kept out of the component so they
 * are testable without a DOM. Directional input is mirrored under RTL: "next"
 * always moves toward the inline end of the tab row.
 */

export type KeyStep = 1 | -1 | 'first' | 'last';

/** Wraps any integer into `[0, total)`; `0` when there is nothing to show. */
export function wrapIndex(index: number, total: number): number {
  if (!Number.isFinite(index) || total <= 0) {
    return 0;
  }
  return ((Math.trunc(index) % total) + total) % total;
}

/** Maps a tablist key to a step, or `null` for keys the tablist ignores. */
export function stepFromKey(key: string, rtl: boolean): KeyStep | null {
  switch (key) {
    case 'ArrowRight':
      return rtl ? -1 : 1;
    case 'ArrowLeft':
      return rtl ? 1 : -1;
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return null;
  }
}

/** The slide index a key step lands on. Arrows wrap; Home and End do not. */
export function resolveKeyTarget(step: KeyStep, active: number, total: number): number {
  if (step === 'first') {
    return 0;
  }
  if (step === 'last') {
    return Math.max(total - 1, 0);
  }
  return wrapIndex(active + step, total);
}

export type CarouselState = 'idle' | 'running' | 'paused' | 'stopped';

export interface CarouselStateInput {
  hydrated: boolean;
  reducedMotion: boolean;
  stopped: boolean;
  hovered: boolean;
  inView: boolean;
  total: number;
}

/**
 * The carousel's rotation state, pure so it is unit-testable without a DOM.
 * Idle until hydration, so every progress bar renders empty rather than full
 * before emptying the instant rotation starts. Reduced motion and a single
 * slide never autoplay. Once stopped by interaction, hovering or leaving the
 * viewport never resumes it — `stopped` is sticky for the rest of the visit.
 * Hovering and being scrolled out of view both pause a running carousel the
 * same way: the progress fill freezes and resumes from where it left off.
 */
export function carouselState({
  hydrated,
  reducedMotion,
  stopped,
  hovered,
  inView,
  total,
}: CarouselStateInput): CarouselState {
  if (!hydrated) {
    return 'idle';
  }
  const autoplay = !reducedMotion && total > 1 && !stopped;
  if (!autoplay) {
    return 'stopped';
  }
  return hovered || !inView ? 'paused' : 'running';
}

export const SWIPE_THRESHOLD_PX = 50;

/**
 * A horizontal swipe's step. Dragging toward the inline start reveals the next
 * slide: leftward in LTR, rightward in RTL. Short or invalid drags do nothing.
 */
export function stepFromSwipe(
  dx: number,
  rtl: boolean,
  threshold = SWIPE_THRESHOLD_PX
): 1 | -1 | 0 {
  if (!Number.isFinite(dx) || Math.abs(dx) < threshold) {
    return 0;
  }
  const towardLeft = dx < 0;
  return towardLeft !== rtl ? 1 : -1;
}
