/**
 * Cart limits. `MAX_LINE_QUANTITY` and `MAX_CART_LINES` mirror the server quote contract
 * (CD-7); the storefront cannot import `apps/server`, so a change moves both together.
 */

/** The `localStorage` key of the persisted bag (plan 2026-09-15-001, *Persisted shape (v1)*). */
export const CART_STORAGE_KEY = 'moon-fashion-cart';

/** The only persisted version. A v2 adds a migration in `cart-storage.ts`, never a silent reset. */
export const CART_VERSION = 1;

export const MAX_LINE_QUANTITY = 10;
export const MAX_CART_LINES = 30;

export const MAX_SLUG_LENGTH = 80;
export const MAX_LINE_OPTIONS = 5;
export const MAX_OPTION_KEY_LENGTH = 40;
export const MAX_OPTION_VALUE_LENGTH = 60;
