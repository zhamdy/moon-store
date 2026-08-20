import { describe, expect, it } from 'vitest';
import {
  AUTH_STORAGE_KEY,
  CART_RECOVERY_STORAGE_KEY,
  HELD_CARTS_STORAGE_KEY,
  OFFLINE_QUEUE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from './storageKeys';

// Byte-identical to the five current `persist({ name })` literals. A typo
// here would silently orphan persisted state for existing users, so each
// key is asserted explicitly rather than as a group.
describe('storageKeys', () => {
  it('AUTH_STORAGE_KEY matches the existing authStore persist name', () => {
    expect(AUTH_STORAGE_KEY).toBe('moon-auth');
  });

  it('CART_RECOVERY_STORAGE_KEY matches the existing cartStore persist name', () => {
    expect(CART_RECOVERY_STORAGE_KEY).toBe('moon-cart-recovery');
  });

  it('HELD_CARTS_STORAGE_KEY matches the existing heldCartsStore persist name', () => {
    expect(HELD_CARTS_STORAGE_KEY).toBe('moon-held-carts');
  });

  it('OFFLINE_QUEUE_STORAGE_KEY matches the existing offlineStore persist name', () => {
    expect(OFFLINE_QUEUE_STORAGE_KEY).toBe('moon-offline-queue');
  });

  it('SETTINGS_STORAGE_KEY matches the existing settingsStore persist name', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('moon-settings');
  });
});
