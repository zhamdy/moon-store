/** The `sessionStorage` key of the typed-details draft (plan 2026-09-15-002, CO-16). */
export const CHECKOUT_DRAFT_KEY = 'moon-fashion-checkout';

/** The only draft version. Anything else is discarded, never migrated: it is a convenience. */
export const CHECKOUT_DRAFT_VERSION = 1;

/** How long typing waits before the draft is written. */
export const CHECKOUT_DRAFT_DEBOUNCE_MS = 400;
