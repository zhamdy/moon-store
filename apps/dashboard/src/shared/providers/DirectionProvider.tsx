import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

export type Direction = 'ltr' | 'rtl';

export interface DirectionContextValue {
  direction: Direction;
  isRtl: boolean;
}

const DirectionContext = createContext<DirectionContextValue | null>(null);

export interface DirectionProviderProps {
  children: ReactNode;
  /**
   * The direction to publish. `UIProvider` derives this from the active locale; tests
   * pass it directly to render a subtree in one direction without touching the store.
   */
  direction?: Direction;
}

/**
 * Publishes the writing direction to the components that need it in JS rather than CSS —
 * a drawer choosing which edge to open from, tabs choosing which arrow key moves forward.
 *
 * ## Direction is derived from locale, and is not separately stored (#54)
 *
 * This used to hold its own state, seeded from a `moon-store-direction` key in
 * localStorage and written back by `setDirection` / `toggleDirection`. That made two
 * sources of truth for one question:
 *
 *   - `settingsStore.locale` drove `useTranslation().isRtl` and wrote `<html lang>` and
 *     `<html dir>` — the source almost every feature component reads.
 *   - this provider drove `useDirection().isRtl` from its own key, and its effect wrote
 *     `<html dir>` again, last-writer-wins against the store.
 *
 * Two persisted keys that nothing kept in agreement. When they disagreed — trivially
 * possible, since only the locale is user-visible — `TabsNav` and `SlideOverDrawer` laid
 * out one way while the rest of the screen laid out the other, and `<html>` could end up
 * announcing `lang="ar"` with `dir="ltr"`. That is WCAG 1.3.2 (meaningful sequence) and
 * 3.1.1 (language of page) failing together, and it is invisible until it isn't.
 *
 * Nothing outside a test ever called `setDirection` or `toggleDirection`, so the writable
 * half was persisting state no user could set. Both are gone: direction is a pure
 * function of locale, `settingsStore` is the only writer of `<html lang>`/`<html dir>`,
 * and the two `isRtl` values cannot disagree because there is only one input.
 *
 * To change direction, change the locale.
 */
export function DirectionProvider({
  children,
  direction = 'ltr',
}: DirectionProviderProps): React.JSX.Element {
  const value = useMemo<DirectionContextValue>(
    () => ({ direction, isRtl: direction === 'rtl' }),
    [direction]
  );

  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDirection(): DirectionContextValue {
  const context = useContext(DirectionContext);
  // LTR outside a provider: a component rendered in isolation (a test, a storybook-style
  // harness) should lay out rather than throw.
  return context ?? { direction: 'ltr', isRtl: false };
}
