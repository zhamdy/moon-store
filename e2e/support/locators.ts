/**
 * Locator helpers, built from the app's own i18n catalogs.
 *
 * The priority is Playwright's documented one — role, then label, then text — with test
 * ids reserved for surfaces that have no meaningful accessible name at all (a cart line
 * container, a virtualized row wrapper). Where a role query cannot find a control, the
 * first move is to **fix the accessible name** in the component: a missing name is a real
 * accessibility defect, and reaching for a test id buries it.
 *
 * Every helper here takes the locale, so the same spec body can run against the shipped
 * Arabic default and against the `en` the bulk of the suite is pinned to.
 */
import type { Page } from '@playwright/test';
import { DEFAULT_TEST_LOCALE, type Locale, tr } from './i18n';

export interface LocaleOptions {
  locale?: Locale;
}

export function loginPage(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  return {
    email: page.getByLabel(tr('login.email', locale), { exact: true }),
    password: page.getByLabel(tr('login.password', locale), { exact: true }),
    submit: page.getByRole('button', { name: tr('login.submit', locale) }),
    heading: page.getByRole('heading', { name: tr('login.title', locale) }),
  };
}

export function posPage(page: Page, { locale = DEFAULT_TEST_LOCALE }: LocaleOptions = {}) {
  return {
    search: page.getByPlaceholder(tr('pos.searchPlaceholder', locale)),
    heading: page.getByRole('heading', { name: tr('pos.title', locale) }),
  };
}

/**
 * Logs in through the real form rather than by minting a token, so every path that uses
 * this is also exercising the login flow the cashier actually uses.
 */
export async function loginThroughForm(
  page: Page,
  email: string,
  password: string,
  options: LocaleOptions = {}
): Promise<void> {
  const form = loginPage(page, options);
  await page.goto('/login');
  await form.email.fill(email);
  await form.password.fill(password);
  await form.submit.click();
}
