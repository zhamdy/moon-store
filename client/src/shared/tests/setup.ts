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
 * `framer-motion`'s `LazyMotion` is flattened, and `m` is mapped to the full `motion`.
 *
 * HeroUI renders its components inside `LazyMotion`, which loads its feature bundle
 * asynchronously and then calls `setState`. When vitest tears the jsdom environment down
 * before that promise settles, the update lands in React's scheduler, reaches
 * `getCurrentEventPriority`, and touches a `window` that no longer exists — surfacing as
 * an *unhandled* `ReferenceError` that fails the run while every test still passes.
 *
 * Flattening `LazyMotion` removes the async load entirely. `m` must then map to `motion`,
 * because `m` components rely on features that `LazyMotion` would otherwise have supplied.
 *
 * Diagnosed from the CI stack (LazyMotion/index.mjs -> dispatchSetState ->
 * getCurrentEventPriority); it is deterministic there and has never reproduced locally,
 * which is the shape of a teardown race.
 *
 * The mock alone was NOT enough, which is why issue #77 recurred after #67: the component
 * that mounts `LazyMotion` is HeroUI, and vitest loaded `@heroui/*` natively, so HeroUI
 * resolved `framer-motion` through node and never saw this registry — every HeroUI button,
 * modal, tooltip, tab and popover kept the real async load. `server.deps.inline` in
 * `vitest.config.ts` is what puts HeroUI on the transformed path so this mock reaches it.
 * The two are one fix; `./motionMock.test.tsx` fails if either half is removed.
 */
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    LazyMotion: ({ children }: { children: React.ReactNode }) => children,
    m: actual.motion,
  };
});
