// The zustand persist-key literals used across the app. Centralized here so
// the flat localStorage namespace is visible in one file (see
// docs/plans/2026-08-20-001-refactor-client-feature-slice-architecture-plan.md,
// Unit 4). Values are intentionally unchanged from what they always were --
// renaming any of these drops persisted state for existing users.
export const AUTH_STORAGE_KEY = 'moon-auth';
export const CART_RECOVERY_STORAGE_KEY = 'moon-cart-recovery';
export const HELD_CARTS_STORAGE_KEY = 'moon-held-carts';
export const OFFLINE_QUEUE_STORAGE_KEY = 'moon-offline-queue';
export const SETTINGS_STORAGE_KEY = 'moon-settings';
