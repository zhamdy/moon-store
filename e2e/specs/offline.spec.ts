/**
 * R4 — what actually happens to a sale rung up offline.
 *
 * This file was written expecting to prove the documented offline-queue contract — a sale
 * queued to `moon-offline-queue`, replayed once on reconnect, surviving a reload — and
 * driving it in a real browser showed something else, so for a while it pinned what the
 * application actually did instead.
 *
 * **What it found.** `queryClient` set no `networkMode`, so React Query's default
 * `'online'` applied: a mutation fired while `navigator.onLine` was false was **paused**,
 * not executed. No request went out, so it never failed, so `onError` never ran — and the
 * checkout's offline fallback, the only code that writes to `moon-offline-queue`, lives
 * entirely inside `onError`. The persisted queue never received a sale rung up offline.
 * The common case still worked (reconnect with the tab open and the sale went through,
 * once) but an in-memory pause does not survive a reload, and surviving exactly that is
 * why the persisted queue exists (#30). A cashier who rang up an order on a dead link and
 * refreshed lost it silently.
 *
 * **Fixed in #53** by `networkMode: 'always'` — the change the earlier version of this
 * file named as the one that should make its pinning tests fail. The specs below now
 * assert the contract rather than the gap: queued to localStorage, surviving a reload,
 * replayed exactly once.
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

    // On reconnect the queued sale replays — and lands exactly once, which is the
    // invariant that actually protects the shop from charging twice.
    await expect
      .poll(() => countSalesForCashier(workerCashier.id), { timeout: 45_000 })
      .toBe(salesBefore + 1);
    expect(await readStock(product.id)).toBe(stockBefore - 1);

    // Counting POSTs is no longer the way to say that. Since #53 the offline attempt is
    // genuinely made (and aborted), so more than one request leaves the browser by
    // design — that failure is what writes the queue entry in the first place. What must
    // hold is that every attempt carries the SAME idempotency key, so the server collapses
    // them onto one sale however many arrive. The sale count above is the proof it did.
    const keys = posts
      .headers()
      .map((h) => h['idempotency-key'])
      .filter(Boolean);
    expect(keys.length, 'the sale was attempted at least once').toBeGreaterThan(0);
    expect(new Set(keys).size, 'every attempt reused one idempotency key').toBe(1);
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
 * The durability contract, restored in #53.
 *
 * These tests previously pinned the opposite — an offline checkout wrote nothing, and a
 * reload lost the sale — because React Query's default `networkMode: 'online'` paused the
 * mutation instead of failing it, so `onError`, the only writer to the queue, never ran.
 * `queryClient` now sets `networkMode: 'always'`, which is the change that earlier version
 * of this file named as the one that should make it fail. It did.
 */
test.describe('offline durability', () => {
  test('an offline checkout is written to the persisted queue, carrying its key', async ({
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

    const queue = await test.step('the sale lands in localStorage', async () => {
      await expect.poll(() => readQueue(page).then((q) => q.length), { timeout: 15_000 }).toBe(1);
      return readQueue(page);
    });

    const [entry] = queue;
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('sale');
    // The key the failed POST carried. Without it a replay of a request that did reach the
    // server would ring the sale up a second time, which is worse than losing it.
    expect(entry!.idempotencyKey, 'queued sale carries an idempotency key').toBeTruthy();

    await goOnline(page);
  });

  test('a sale rung up offline survives a reload and replays once', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    // The case the persisted queue exists for (#30), and the one an in-memory pause could
    // never cover: the cashier rings up an order on a dead link and the tab is reloaded
    // before it reconnects.
    const product = await seedProduct('lostonreload', { price: 65, stock: 5 });
    const stockBefore = await readStock(product.id);
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await expect(posPage(page).productCard(product.sku)).toBeVisible();

    await goOffline(page);
    await ringUpAndConfirm(page, product.sku, product.id);
    await expect.poll(() => readQueue(page).then((q) => q.length), { timeout: 15_000 }).toBe(1);

    // Refresh **while still disconnected** — reconnecting first would be the other test's
    // scenario. localStorage is what has to carry the sale across this.
    await page.reload();
    expect(await readQueue(page), 'the queue survives the reload').toHaveLength(1);

    await goOnline(page);

    await expect
      .poll(() => countSalesForCashier(workerCashier.id), { timeout: 45_000 })
      .toBe(salesBefore + 1);
    expect(await readStock(product.id)).toBe(stockBefore - 1);
    await expect.poll(() => readQueue(page).then((q) => q.length), { timeout: 15_000 }).toBe(0);
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
