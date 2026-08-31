/**
 * The setup project: authenticates the fixed roles through the **real login form** and
 * writes their `storageState`.
 *
 * Driving the form rather than minting a JWT means this project is itself the login smoke
 * test — if login breaks, the whole suite fails here with an obvious message instead of
 * failing everywhere at once.
 *
 * It also bounds the suite's appetite for the auth rate limiter: one login per role for
 * the entire run rather than one per test. Raising the ceiling (Unit 2) is the mitigation
 * of last resort; logging in less is the first move.
 */
import { expect, test as setup, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import { AUTH_DIR, adminStatePath, cashierStatePath } from './authPaths';
import { SEEDED } from './seed';
import { seedLocale } from './storage';
import { DEFAULT_TEST_LOCALE } from '../support/i18n';
import { loginPage } from '../support/locators';

setup.beforeAll(() => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
});

async function authenticate(
  page: Page,
  context: BrowserContext,
  email: string,
  password: string,
  statePath: string
): Promise<void> {
  // The app ships Arabic RTL, so the locale must be pinned before the first render or the
  // en-catalog locators match nothing.
  await seedLocale(context, DEFAULT_TEST_LOCALE);
  await page.goto('/login');

  const form = loginPage(page);
  await form.email.fill(email);
  await form.password.fill(password);
  await form.submit.click();

  // Landing anywhere but /login is the proof the session took: the app routes by role
  // (Admin to /, Cashier to /pos, Delivery to /deliveries).
  await expect(page).not.toHaveURL(/\/login/);

  // The httpOnly refresh cookie is half of the session and is easy to lose silently —
  // without it the token-refresh path cannot work at all.
  const cookies = await context.cookies();
  expect(cookies.map((c) => c.name)).toContain('refreshToken');

  await context.storageState({ path: statePath });
}

setup('authenticate as admin', async ({ page, context }) => {
  await authenticate(page, context, SEEDED.admin.email, SEEDED.admin.password, adminStatePath);
});

setup('authenticate as cashier', async ({ page, context }) => {
  await authenticate(
    page,
    context,
    SEEDED.cashier.email,
    SEEDED.cashier.password,
    cashierStatePath
  );
});
