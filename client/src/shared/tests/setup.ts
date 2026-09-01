import { vi } from 'vitest';
import '@testing-library/jest-dom';

// jsdom implements neither the Pointer Capture API nor ResizeObserver, both of
// which Radix's Select reaches for as soon as it opens. Without them the
// component throws before any handler runs, so a test can never drive it.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// auto-animate asks whether the reader prefers reduced motion the moment a
// DataTable mounts, and jsdom has no media queries at all.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.animate) {
  Element.prototype.animate = () =>
    ({
      finished: Promise.resolve(),
      cancel: () => {},
      play: () => {},
      pause: () => {},
      reverse: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as Animation;
}

if (!window.scrollTo) {
  window.scrollTo = () => {};
}

/**
 * `@formkit/auto-animate` is stubbed to a plain ref.
 *
 * It drives real animations through `requestAnimationFrame` and a `MutationObserver`, and
 * those callbacks can outlive the jsdom environment: vitest tears the environment down,
 * a queued frame fires, and the callback touches `window` that no longer exists. The
 * result is `ReferenceError: window is not defined` reported as an *unhandled* error —
 * every test still passes, and the run fails anyway.
 *
 * It surfaced on CI (deterministically) while never reproducing locally, which is exactly
 * the shape of a teardown race. Nothing in the suite asserts on animation, so a no-op ref
 * loses no coverage. Same instinct as the ResizeObserver and Element.animate stubs above.
 */
vi.mock('@formkit/auto-animate/react', () => ({
  useAutoAnimate: () => [{ current: null }, () => {}],
}));
