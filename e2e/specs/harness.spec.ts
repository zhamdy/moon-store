import { expect, test } from '@playwright/test';
import { API_URL } from '../support/config';

/**
 * Unit 1's own verification: the production client build is served, the API answers, and
 * the app renders. Deliberately asserts nothing about POS behavior — that arrives with
 * Unit 6.
 */
test('the preview build serves the login page', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('form')).toBeVisible();
});

test('the API answers its health check against the E2E database', async ({ request }) => {
  const response = await request.get(`${API_URL}/api/health`);
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ data: { status: 'ok' } });
});
