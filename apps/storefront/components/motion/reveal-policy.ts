export type RevealState = 'in' | 'pending';

export interface RevealRect {
  top: number;
  bottom: number;
}

/**
 * Decides what `Reveal` does with an element at mount time. The one rule with a
 * correctness consequence: never hide content the user can already see. Server
 * HTML is the visible state; only an element entirely below the fold, for a user
 * who has not asked for reduced motion, is held back until it scrolls into view.
 *
 * Pure so it is testable without a DOM library. Any input that is not a finite
 * number resolves to `in` — the safe default is always visible.
 */
export function decideInitialRevealState(
  rect: RevealRect,
  viewportHeight: number,
  reducedMotion: boolean | null
): RevealState {
  if (reducedMotion === true) {
    return 'in';
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return 'in';
  }
  if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) {
    return 'in';
  }
  // Straddling the fold, fully inside it, or already scrolled past: all visible.
  return rect.top >= viewportHeight ? 'pending' : 'in';
}
