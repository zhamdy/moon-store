/**
 * R4 — what actually happens to a sale rung up offline.
 *
 * This file was written expecting to prove the documented offline-queue contract: a sale
 * queued to `moon-offline-queue`, replayed once on reconnect, surviving a reload. Driving
 * it in a real browser showed something different, and the specs below pin what the
 * application does rather than what it was expected to do.
 *
 * **The finding.** `queryClient` sets no `networkMode`, so React Query's default `'online'`
 * applies: a mutation fired while `navigator.onLine` is false is **paused**, not executed.
 * No request goes out, so it never fails, so `onError` never runs — and `CartPanel`'s
 * offline fallback, the only code that writes to `moon-offline-queue`, lives entirely
 * inside `onError`. The persisted queue therefore never receives a sale rung up offline.
 *
 * Measured rather than inferred, by the assertions below: offline, zero sale requests and
 * an empty queue; on reconnect, the paused mutation resumes and the sale lands exactly once.
 *
 * **Why it still matters.** The common case is safe — reconnect with the tab open and the
 * sale goes through, once. But an in-memory pause does not survive a reload or a closed
 * tab, and surviving exactly that is why the persisted queue exists (issue #30). A cashier
 * who rings up an order on a dead link and refreshes loses it silently.
 *
 * **On emulating offline.** `context.setOffline(true)` is deliberately not used: it was
 * measured letting the checkout reach the server (a real `201`) while dropping the
 * response, so the mutation neither resolved nor rejected — a spec built on it would assert
 * an empty queue against a sale the server had already committed. Instead `navigator.onLine`
 * is forced false and the `offline` event fired (what `useOffline.ts` and `CartPanel`
 * observe), and the API origin is aborted (the real failure). The preview server is left
 * alone so the already-loaded page keeps working.
 */
import { countSalesForCashier, readStock } from '../support/assertSale';
import { cartPanel, checkoutDrawer, posPage, receiptDialog } from '../support/locators';
import { countPosts } from '../support/network';
import { OFFLINE_QUEUE_STORAGE_KEY } from '../fixtures/storage';
import { expect, test } from '../fixtures/test';
import type { Page } from '@playwright/test';

const SALES_PATH = '/api/v1/sales';
const API_ORIGIN = 'http://localhost:3001';

interface QueueEntry {
  id: string | number;
  type: string;
  idempotencyKey?: string;
}

/** The persisted queue, read from the browser rather than inferred from the banner. */
async function readQueue(page: Page): Promise<QueueEntry[]> {
  const raw = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    OFFLINE_QUEUE_STORAGE_KEY
  );
  if (!raw) return [];
  return (JSON.parse(raw) as { state?: { queue?: QueueEntry[] } }).state?.queue ?? [];
}

async function goOffline(page: Page) {
  await page.route(`${API_ORIGIN}/**`, (route) => route.abort('internetdisconnected'));
  await page.evaluate(() => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
  });
}

async function goOnline(page: Page) {
  await page.unroute(`${API_ORIGIN}/**`);
  await page.evaluate(() => {
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
  });
}

/** Rings up one unit, opens the drawer, and confirms. */
async function ringUpAndConfirm(page: Page, sku: string, productId: number) {
  await posPage(page).search.fill(sku);
  await posPage(page).productCard(sku).click();
  await expect(cartPanel(page).quantity(productId)).toHaveText('1');
  await cartPanel(page).checkout.click();
  const drawer = checkoutDrawer(page);
  await expect(drawer.dialog).toBeVisible();
  /**
   * A native click rather than Playwright's. HeroUI renders the drawer inside a
   * `w-screen overflow-x-auto` wrapper, so the confirm button's layout position sits about
   * a viewport width to the right of the visible area, and Playwright's actionability check
   * refuses it once the offline banner is mounted. Real click mechanics on this button are
   * covered online by `checkout-cash.spec.ts` and `duplicate-submit.spec.ts`; what this
   * file needs is the handler, not the hit-testing.
   */
  await drawer.confirm.evaluate((el) => (el as HTMLElement).click());
  return drawer;
}

test.describe('offline checkout @smoke', () => {
  test('a sale rung up offline reaches the server exactly once on reconnect', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    const product = await seedProduct('offline', { price: 45, stock: 10 });
    const stockBefore = await readStock(product.id);
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    // Load the catalogue before cutting the link.
    await posPage(page).search.fill(product.sku);
    await expect(posPage(page).productCard(product.sku)).toBeVisible();

    const posts = countPosts(page, SALES_PATH);
    await goOffline(page);
    await ringUpAndConfirm(page, product.sku, product.id);

    // Offline: nothing reaches the server and no stock moves.
    await page.waitForTimeout(2_000);
    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore);
    expect(await readStock(product.id)).toBe(stockBefore);

    await goOnline(page);

    // On reconnect the paused mutation resumes — and the sale lands exactly once, which is
    // the invariant that actually protects the shop from charging twice.
    await expect
      .poll(() => countSalesForCashier(workerCashier.id), { timeout: 45_000 })
      .toBe(salesBefore + 1);
    expect(await readStock(product.id)).toBe(stockBefore - 1);
    expect(posts.count(), 'exactly one sale POST reached the server').toBe(1);
    posts.stop();
  });

  test('a normal online sale never touches the offline queue', async ({
    cashierContext,
    seedProduct,
  }) => {
    // The negative that keeps every queue assertion honest.
    const product = await seedProduct('nonqueued', { price: 25, stock: 5 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await ringUpAndConfirm(page, product.sku, product.id);
    await expect(receiptDialog(page).dialog).toBeVisible();

    expect(await readQueue(page)).toHaveLength(0);
  });
});

/**
 * These pin the finding described in the file header. They assert **current behaviour**,
 * not an endorsement of it: if the checkout mutation is ever changed to fail rather than
 * pause while offline — `networkMode: 'always'` would do it — these are the tests that
 * should fail, and the queue contract they currently contradict is the one to restore.
 */
test.describe('offline durability gap (pins current behaviour)', () => {
  test('an offline checkout writes nothing to the persisted queue', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('nopersist', { price: 30, stock: 5 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await expect(posPage(page).productCard(product.sku)).toBeVisible();

    await goOffline(page);
    await ringUpAndConfirm(page, product.sku, product.id);
    await page.waitForTimeout(3_000);

    // The documented contract would put an entry here carrying an idempotency key. React
    // Query pauses the mutation instead, so `onError` — the only writer — never runs.
    expect(
      await readQueue(page),
      'offline sales are held in memory by React Query, not in moon-offline-queue'
    ).toHaveLength(0);

    await goOnline(page);
  });

  test('a reload while offline loses the pending sale', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    // The concrete consequence, and why the gap is worth reporting rather than shrugging
    // at: an in-memory pause does not survive a refresh, and surviving exactly that is
    // what the persisted queue was built for.
    const product = await seedProduct('lostonreload', { price: 65, stock: 5 });
    const stockBefore = await readStock(product.id);
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await expect(posPage(page).productCard(product.sku)).toBeVisible();

    await goOffline(page);
    await ringUpAndConfirm(page, product.sku, product.id);
    await page.waitForTimeout(2_000);

    // Refresh **while still disconnected** — reconnecting first would let the paused
    // mutation resume and complete, which is the other test's scenario, not this one.
    await page.reload();
    // The reload restores a live `navigator.onLine`; drop the request block too, so the
    // app has every opportunity to replay something if it had anything to replay.
    await goOnline(page);
    await page.waitForTimeout(5_000);

    // Nothing was queued, so nothing replays: the order is simply gone.
    expect(await readQueue(page)).toHaveLength(0);
    expect(
      await countSalesForCashier(workerCashier.id),
      'the pending offline sale does not survive a reload'
    ).toBe(salesBefore);
    expect(await readStock(product.id)).toBe(stockBefore);
  });

  test('the cashier is at least told the link is down', async ({ cashierContext, seedProduct }) => {
    // What makes this a durability problem rather than a silent-wrong-answer problem.
    const product = await seedProduct('banner', { price: 20, stock: 5 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await expect(posPage(page).productCard(product.sku)).toBeVisible();

    await goOffline(page);
    await expect(page.getByText('You are offline.').first()).toBeVisible();

    await goOnline(page);
  });
});
