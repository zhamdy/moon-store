/**
 * Browser storage seeding.
 *
 * Two mechanisms, kept visibly distinct because they are not interchangeable:
 *
 * - **`storageState`** serializes cookies and **localStorage** only. That covers
 *   `moon-auth` and `moon-settings`.
 * - **`sessionStorage`** is not in `storageState` at all. `moon-startup-dismissed` lives
 *   there (`StartupPrompt.tsx`), so writing it into a storage state silently does
 *   nothing, and every spec meant to skip the startup gate would instead sit behind it,
 *   looking like an application bug. It must be seeded with `addInitScript` before the
 *   first navigation.
 */
import type { BrowserContext } from '@playwright/test';
import { DEFAULT_TEST_LOCALE, type Locale } from '../support/i18n';
import type { AuthUser } from './types';

/**
 * Imported from the client rather than retyped. These are literal `localStorage` keys
 * under the global string-coupling contract, and a stale copy fails quietly — the app
 * would boot unauthenticated or in Arabic and the specs would report locator misses
 * rather than "the key changed". `support/i18n.ts` crosses the same boundary the same
 * way for the translation catalogs.
 */
import {
  AUTH_STORAGE_KEY,
  HELD_CARTS_STORAGE_KEY,
  OFFLINE_QUEUE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from '../../client/src/shared/lib/storageKeys';

export {
  AUTH_STORAGE_KEY,
  HELD_CARTS_STORAGE_KEY,
  OFFLINE_QUEUE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
};

/**
 * Not in `storageKeys.ts`: it is a `sessionStorage` key private to `StartupPrompt.tsx`,
 * which declares its own `SESSION_KEY` literal. Duplicated here because there is nothing
 * to import — the coupling is real and is asserted by the startup-prompt spec.
 */
export const STARTUP_DISMISSED_KEY = 'moon-startup-dismissed';

/** The zustand-persist envelope both stores are written in. */
function persisted(state: unknown): string {
  return JSON.stringify({ state, version: 0 });
}

export function authStorageValue(user: AuthUser, accessToken: string): string {
  return persisted({ user, accessToken, isAuthenticated: true });
}

export function settingsStorageValue(locale: Locale = DEFAULT_TEST_LOCALE): string {
  return persisted({ locale, theme: 'light' });
}

/**
 * Pins the locale before the app's first render.
 *
 * The app defaults to Arabic RTL, so without this every locator built from the `en`
 * catalog silently fails to match. The bulk of the suite runs pinned to `en` for readable
 * diagnostics; `locale-rtl.spec.ts` deliberately omits this and covers the shipped
 * default.
 */
export async function seedLocale(context: BrowserContext, locale: Locale): Promise<void> {
  const value = settingsStorageValue(locale);
  await context.addInitScript(
    ([key, json]) => {
      window.localStorage.setItem(key as string, json as string);
    },
    [SETTINGS_STORAGE_KEY, value]
  );
}

/**
 * Skips the shift/register gate for a cashier that already has both open.
 *
 * Note this is *not* the same as having no shift: `checkout-cash.spec.ts` deliberately
 * mints a cashier with neither and drives the prompt for real.
 */
export async function dismissStartupPrompt(context: BrowserContext): Promise<void> {
  await context.addInitScript((key) => {
    window.sessionStorage.setItem(key as string, '1');
  }, STARTUP_DISMISSED_KEY);
}
