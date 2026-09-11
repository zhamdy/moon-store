/**
 * Postponed-feature registry.
 *
 * Branches (with Transfers), Bundles, Feedback, Online Orders, Storefront and
 * Warranty are shipped features whose code is retained but must be
 * unreachable: not in the sidebar, not by direct URL, not on the POS screen.
 * This is the single list all three consumers (Sidebar, the `_admin` guard,
 * POS) read, so re-enabling a feature is a one-line removal here rather than
 * un-deleting anything.
 *
 * Reactivation checklist, per feature removed from this list:
 * 1. Delete its entry from `POSTPONED_PATHS` below.
 * 2. Restore its accessibility scan in `e2e/specs/a11y.spec.ts` (removed for
 *    `/bundles` while it is postponed).
 * 3. Re-check `README.md` and `server/CLAUDE.md` for wording that still
 *    lists the feature as postponed.
 */
export const BUNDLES_PATH = '/bundles';

export const POSTPONED_PATHS = [
  '/branches',
  BUNDLES_PATH,
  '/feedback',
  '/online-orders',
  '/storefront',
  '/warranty',
] as const;

/**
 * True when `pathname` is a postponed path, or a `/`-delimited descendant of
 * one (`/branches/3`), so a hidden feature cannot be reached by drilling into
 * a sub-route. `/bundlesx` is a different path entirely and is not hidden.
 */
export function isPostponedPath(pathname: string): boolean {
  return POSTPONED_PATHS.some(
    (postponed) => pathname === postponed || pathname.startsWith(`${postponed}/`)
  );
}
