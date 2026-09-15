/**
 * Where focus goes once the Bag drawer's content has unmounted.
 *
 * Headless UI 2.2's `Dialog` keeps `FocusTrap`'s RestoreFocus feature on through the leave
 * transition (the transition still provides `Open | Closing`) and, when the trap unmounts,
 * focuses the element that was focused before the dialog opened, in a microtask and without
 * checking where focus is. That is right for Escape, the backdrop, the X and Continue shopping
 * (back to the header Bag link) and wrong after a navigation, where focus belongs on the new
 * page's main region. The drawer therefore moves focus after that microtask, only when:
 *
 * - the close was for a navigation (a line name, View bag, the empty state's link, a pathname
 *   change), not a dismissal;
 * - the drawer has not been opened again since;
 * - the content really unmounted (a Strict Mode effect re-run remounts it at once).
 */
export interface DrawerUnmountState {
  closedForNavigation: boolean;
  open: boolean;
  remounted: boolean;
}

export function shouldFocusMainAfterDrawerUnmount({
  closedForNavigation,
  open,
  remounted,
}: DrawerUnmountState): boolean {
  return closedForNavigation && !open && !remounted;
}
