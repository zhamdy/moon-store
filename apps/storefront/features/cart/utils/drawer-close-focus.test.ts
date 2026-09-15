import { describe, expect, it } from 'vitest';
import { shouldFocusMainAfterDrawerUnmount } from './drawer-close-focus';

describe('shouldFocusMainAfterDrawerUnmount', () => {
  it('moves focus to the main region after a navigation close', () => {
    expect(
      shouldFocusMainAfterDrawerUnmount({
        closedForNavigation: true,
        open: false,
        remounted: false,
      })
    ).toBe(true);
  });

  it("leaves Headless UI's restore to the invoker after a dismissal", () => {
    expect(
      shouldFocusMainAfterDrawerUnmount({
        closedForNavigation: false,
        open: false,
        remounted: false,
      })
    ).toBe(false);
  });

  it('does nothing when the drawer was opened again before its content unmounted', () => {
    expect(
      shouldFocusMainAfterDrawerUnmount({ closedForNavigation: true, open: true, remounted: false })
    ).toBe(false);
  });

  it('does nothing for a Strict Mode effect re-run, which remounts at once', () => {
    expect(
      shouldFocusMainAfterDrawerUnmount({ closedForNavigation: true, open: false, remounted: true })
    ).toBe(false);
  });
});
