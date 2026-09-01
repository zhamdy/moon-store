import { expect, test } from '@playwright/test';
import { LOCALES, keysOf, tr } from '../support/i18n';
import { seedLocale } from '../fixtures/storage';
import { loginPage } from '../support/locators';

/**
 * Unit 5's audit, kept as a spec rather than as a one-off script: it is the regression
 * guard for the accessible names the rest of the suite's locators depend on. A name that
 * disappears in a refactor fails here, on its own, instead of failing every money spec at
 * once with a misleading message.
 */
test.describe('locator affordances', () => {
  test('every login control resolves by role or label', async ({ page, context }) => {
    // The app ships Arabic RTL by default, so the locale must be pinned before the first
    // render or every en-catalog locator matches nothing.
    await seedLocale(context, 'en');
    await page.goto('/login');
    const form = loginPage(page);

    await expect(form.heading).toBeVisible();
    await expect(form.email).toBeVisible();
    await expect(form.password).toBeVisible();
    await expect(form.submit).toBeEnabled();
  });

  test('the same controls resolve under the shipped Arabic default', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    const form = loginPage(page, { locale: 'ar' });
    await expect(form.email).toBeVisible();
    await expect(form.password).toBeVisible();
    await expect(form.submit).toBeEnabled();
  });
});

test.describe('i18n catalog', () => {
  test('en and ar carry exactly the same keys', () => {
    const [en, ar] = [keysOf('en'), keysOf('ar')];
    expect(en.filter((k) => !ar.includes(k))).toEqual([]);
    expect(ar.filter((k) => !en.includes(k))).toEqual([]);
  });

  test('a missing key throws at construction rather than matching everything', () => {
    // An empty-string fallback in a locator matches every element on the page, so a
    // renamed key would silently pass. This is the guard against that.
    expect(() => tr('pos.thisKeyDoesNotExist')).toThrow(/missing from en\.json/);
  });

  test('every key a locator helper references exists in both catalogs', () => {
    const referenced = [
      'login.email',
      'login.password',
      'login.submit',
      'login.title',
      'pos.searchPlaceholder',
      'pos.title',
    ];
    for (const locale of LOCALES) {
      for (const key of referenced) {
        expect(() => tr(key, locale), `${key} in ${locale}.json`).not.toThrow();
      }
    }
  });
});
