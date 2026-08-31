/**
 * R3's session-expiry path and R9 across a forced logout.
 *
 * Two scenarios that must never be conflated:
 *
 * - **Recoverable** — the access token expired but the refresh cookie is valid. The
 *   interceptor refreshes silently and the cashier's action completes. They should never
 *   see this happen.
 * - **Terminal** — both are gone. The app redirects to `/login` and deliberately clears
 *   the cart (see the note in the terminal test). The invariant that must hold either
 *   way is that no sale is created anywhere in the sequence.
 *
 * Rather than waiting fifteen minutes, the stored access token is corrupted directly so
 * the next request 401s. That is the same code path expiry takes.
 */
import { cartPanel, loginPage, posPage } from '../support/locators';
import { AUTH_STORAGE_KEY } from '../fixtures/storage';
import { countPosts } from '../support/network';
import { countSalesForCashier } from '../support/assertSale';
import { WORKER_PASSWORD } from '../fixtures/seed';
import { expect, test } from '../fixtures/test';
import type { Page } from '@playwright/test';

const REFRESH_PATH = '/api/v1/auth/refresh';

/** Replaces the stored access token with one the server will reject. */
async function corruptAccessToken(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error(`No ${key} entry to corrupt.`);
    const parsed = JSON.parse(raw) as { state: { accessToken: string } };
    parsed.state.accessToken = 'e2e.invalid.token';
    window.localStorage.setItem(key, JSON.stringify(parsed));
  }, AUTH_STORAGE_KEY);
}

async function readAccessToken(page: Page): Promise<string | undefined> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    return (JSON.parse(raw) as { state?: { accessToken?: string } }).state?.accessToken;
  }, AUTH_STORAGE_KEY);
}

test.describe('recoverable expiry', () => {
  test('a stale access token refreshes silently and the cashier is not interrupted', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('refresh', { price: 30, stock: 5 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await expect(page).toHaveURL(/\/pos/);

    const refreshes = countPosts(page, REFRESH_PATH);
    await corruptAccessToken(page);

    // Any action that hits the API will now 401 and drive the interceptor.
    await page.reload();
    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await expect(cartPanel(page).quantity(product.id)).toHaveText('1');

    // The cashier stayed on the till — no redirect, no re-login.
    await expect(page).toHaveURL(/\/pos/);

    // Exactly one refresh, not a storm. `toBe(1)` on purpose: `toBeGreaterThan(0)` would
    // pass on precisely the bug worth catching, and the queue in `client.ts` exists to
    // collapse concurrent 401s into a single refresh.
    await expect.poll(() => refreshes.count()).toBe(1);
    refreshes.stop();

    // And the rotated token was stored, not merely used for one request.
    expect(await readAccessToken(page)).not.toBe('e2e.invalid.token');
  });

  test('concurrent requests against a stale token trigger exactly one refresh', async ({
    cashierContext,
  }) => {
    const page = await cashierContext.newPage();
    await page.goto('/pos');

    const refreshes = countPosts(page, REFRESH_PATH);
    await corruptAccessToken(page);

    // Three API calls fired together. The interceptor must queue the followers behind one
    // refresh and replay them, rather than refreshing three times or dropping two.
    const statuses = await page.evaluate(async () => {
      const paths = ['products?limit=1', 'shifts/current', 'register/current'];
      return Promise.all(
        paths.map((p) =>
          fetch(`http://localhost:3001/api/v1/${p}`, {
            headers: {
              Authorization: `Bearer ${JSON.parse(localStorage.getItem('moon-auth')!).state.accessToken}`,
            },
          }).then((r) => r.status)
        )
      );
    });

    // Those raw fetches bypass the interceptor, so they legitimately 401 — their purpose
    // is only to prove the token really is stale before the UI-driven refresh below.
    expect(statuses.every((s) => s === 401)).toBe(true);

    await page.reload();
    await expect(page).toHaveURL(/\/pos/);
    await expect.poll(() => refreshes.count()).toBe(1);
    refreshes.stop();
  });
});

test.describe('terminal expiry', () => {
  test('losing both tokens redirects to login and clears the cart, deliberately', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    const product = await seedProduct('terminal', { price: 80, stock: 5 });
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await expect(cartPanel(page).quantity(product.id)).toHaveText('1');

    // Both halves gone: no valid access token, no refresh cookie.
    await corruptAccessToken(page);
    await cashierContext.clearCookies();

    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await loginPage(page).email.fill(workerCashier.email);
    await loginPage(page).password.fill(WORKER_PASSWORD);
    await loginPage(page).submit.click();

    await expect(page).not.toHaveURL(/\/login/);
    await page.goto('/pos');

    /**
     * R9 reads "preserve **or recover** predictably", and this app's answer is an explicit
     * clear rather than a restore: `app/session.ts` subscribes to the logout event and
     * calls `clearCart()` — eagerly, so that a logout from a page which never loaded the
     * POS chunk still clears it. That is a deliberate decision carrying its own comment,
     * not an accident, so this pins the behaviour that exists.
     *
     * The cashier consequence is real and worth stating rather than burying: an order rung
     * up when a session lapses has to be re-rung. Whether that is the right trade-off is a
     * product question. Asserting the opposite here would only make the suite wrong.
     */
    await expect(cartPanel(page).heading(0)).toBeVisible();

    // What must hold either way: no sale was created anywhere in that sequence.
    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore);
  });

  test('a failing refresh does not loop', async ({ cashierContext }) => {
    const page = await cashierContext.newPage();
    await page.goto('/pos');

    const refreshes = countPosts(page, REFRESH_PATH);

    // Refresh always fails: the interceptor must give up rather than retry forever.
    await page.route(
      (url) => url.pathname.endsWith(REFRESH_PATH),
      async (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'nope' } }),
        })
    );

    await corruptAccessToken(page);
    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    // A bounded number of attempts. A refresh storm against a dead session would hammer
    // the auth rate limiter and lock the account out for everyone else on that IP.
    const attempts = refreshes.count();
    expect(attempts, 'refresh attempts should be bounded').toBeLessThanOrEqual(3);
    refreshes.stop();
  });
});
