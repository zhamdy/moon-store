/**
 * The app's own translation catalogs, read straight from `client/src/shared/i18n`.
 *
 * Locators are built from these rather than from hardcoded strings for two reasons. The
 * app ships **Arabic RTL by default**, so an English string literal would be testing a
 * configuration most tills never run. And a renamed or deleted translation key then fails
 * loudly here instead of silently matching nothing — which makes the translation itself
 * part of what the suite tests.
 */
import en from '../../client/src/shared/i18n/en.json';
import ar from '../../client/src/shared/i18n/ar.json';

export type Locale = 'en' | 'ar';

const catalogs: Record<Locale, Record<string, string>> = { en, ar };

export const LOCALES: Locale[] = ['en', 'ar'];

/**
 * The bulk of the suite runs pinned to `en` for readable diagnostics; `locale-rtl.spec.ts`
 * covers the shipped Arabic default.
 */
export const DEFAULT_TEST_LOCALE: Locale = 'en';

/**
 * Resolves a key, mirroring the app's own `{param}` interpolation.
 *
 * Throws on a missing key rather than falling back. The app falls back to the key name at
 * runtime, which is right for users but wrong here: a locator built from a fallback would
 * match nothing and report as an application bug.
 */
export function tr(
  key: string,
  locale: Locale = DEFAULT_TEST_LOCALE,
  params?: Record<string, string | number>
): string {
  const value = catalogs[locale][key];
  if (value === undefined) {
    throw new Error(
      `i18n key "${key}" is missing from ${locale}.json. Locators are built from the ` +
        'catalog on purpose — fix the key or the catalog, do not hardcode the string.'
    );
  }
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''));
}

/** Every key present in a catalog, for the parity assertion. */
export function keysOf(locale: Locale): string[] {
  return Object.keys(catalogs[locale]);
}
