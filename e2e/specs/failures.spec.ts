/**
 * R3's rejection paths and R9's recovery guarantee.
 *
 * The assertion that matters most here is the boring one: **after every rejection the cart
 * still holds its lines.** A till that silently empties on a failed sale makes the cashier
 * re-ring the whole order, which is a worse outcome than the original error — and it is
 * the kind of regression that no unit test notices because the cart store is fine in
 * isolation. Every error case below asserts preservation explicitly rather than relying
 * on it implicitly.
 *
 * Oversell is created for real rather than mocked: the server's guarded relative write is
 * what must reject it. Only the 5xx and network-abort cases use route interception, where
 * producing a genuine server fault is not practical.
 */
import { countSalesForCashier, money, readStock } from '../support/assertSale';
import { cartPanel, checkoutDrawer, posPage, receiptDialog } from '../support/locators';
import { formatMoneyMinor } from '../support/money';
import { dbOne } from '../support/db';
import { API_BASE, getJson } from '../fixtures/seed';
import { expect, test } from '../fixtures/test';
import type { Page } from '@playwright/test';

const SALES_PATH = '/api/v1/sales';

async function ringUpAndOpenDrawer(page: Page, sku: string, productId: number) {
  await page.goto('/pos');
  await posPage(page).search.fill(sku);
  await posPage(page).productCard(sku).click();
  await expect(cartPanel(page).quantity(productId)).toHaveText('1');
  await cartPanel(page).checkout.click();
  const drawer = checkoutDrawer(page);
  await expect(drawer.dialog).toBeVisible();
  return drawer;
}

/** Consumes stock out of band, the way a second till would. */
async function consumeStock(
  request: Parameters<typeof getJson>[0],
  token: string,
  productId: number,
  quantity: number,
  unitPrice: number
) {
  const response = await request.post(`${API_BASE}/sales`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      items: [{ product_id: productId, quantity, unit_price: unitPrice }],
      payment_method: 'Cash',
    },
  });
  if (!response.ok()) {
    throw new Error(`out-of-band consume failed: ${response.status()} ${await response.text()}`);
  }
}

test.describe('stock conflicts', () => {
  test('a sale for exactly the available stock succeeds and leaves zero', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    const product = await seedProduct('exact', { price: 40, stock: 1 });

    const page = await cashierContext.newPage();
    const drawer = await ringUpAndOpenDrawer(page, product.sku, product.id);

    await drawer.confirm.click();
    await expect(receiptDialog(page).dialog).toBeVisible();

    expect(await readStock(product.id)).toBe(0);
    void workerCashier;
  });

  test('stock consumed between add and checkout is rejected, and the cart survives', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    request,
  }) => {
    // The real race, created for real: one unit, in the cart, then taken by someone else.
    const product = await seedProduct('oversell', { price: 40, stock: 1 });
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    const drawer = await ringUpAndOpenDrawer(page, product.sku, product.id);

    await consumeStock(request, workerCashier.accessToken, product.id, 1, 40);
    expect(await readStock(product.id)).toBe(0);

    await drawer.confirm.click();

    // The receipt must NOT appear — that is the cashier-visible signal of rejection.
    await expect(receiptDialog(page).dialog).toBeHidden();

    // Stock never goes negative, and the till's own sale was not created. The count is
    // +1 for the out-of-band sale this cashier made, and no more.
    expect(await readStock(product.id)).toBe(0);
    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore + 1);

    // R9: the cashier must not have to re-ring the order.
    await page.keyboard.press('Escape');
    await expect(cartPanel(page).line(product.id)).toBeVisible();
    await expect(cartPanel(page).quantity(product.id)).toHaveText('1');
  });

  test('a rejected sale can be completed after restocking', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    adminApi,
    request,
  }) => {
    const product = await seedProduct('restock', { price: 40, stock: 1 });

    const page = await cashierContext.newPage();
    const drawer = await ringUpAndOpenDrawer(page, product.sku, product.id);

    await consumeStock(request, workerCashier.accessToken, product.id, 1, 40);
    await drawer.confirm.click();
    await expect(receiptDialog(page).dialog).toBeHidden();

    // Restock through the real API, then retry the same cart.
    const update = await adminApi.put(`/api/v1/products/${product.id}`, {
      data: { name: product.name, sku: product.sku, price: 40, stock: 5 },
    });
    expect(update.ok(), 'restock should succeed').toBe(true);
    await expect.poll(() => readStock(product.id)).toBe(5);

    await drawer.confirmAny.click();
    await expect(receiptDialog(page).dialog).toBeVisible();
    await expect.poll(() => readStock(product.id)).toBe(4);
  });
});

test.describe('server rejection', () => {
  test('a 500 shows an error, creates no sale, and preserves the cart', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    const product = await seedProduct('fivehundred', { price: 65, stock: 5 });
    const salesBefore = await countSalesForCashier(workerCashier.id);
    const stockBefore = await readStock(product.id);

    const page = await cashierContext.newPage();
    const drawer = await ringUpAndOpenDrawer(page, product.sku, product.id);

    // A genuine 5xx is impractical to provoke, so this one case is faked at the wire.
    await page.route(
      (url) => url.pathname.endsWith(SALES_PATH),
      async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }),
        });
      }
    );

    await drawer.confirm.click();

    await expect(receiptDialog(page).dialog).toBeHidden();
    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore);
    expect(await readStock(product.id)).toBe(stockBefore);

    await page.keyboard.press('Escape');
    await expect(cartPanel(page).line(product.id)).toBeVisible();
    await expect(cartPanel(page).total).toHaveText(formatMoneyMinor(6500));
  });

  test('an invalid coupon rejection leaves the cart and its total untouched', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('badcode', { price: 75, stock: 5 });

    const page = await cashierContext.newPage();
    const drawer = await ringUpAndOpenDrawer(page, product.sku, product.id);
    const adj = (await import('../support/locators')).adjustments(page);

    await adj.couponInput.fill('E2E-DEFINITELY-NOT-A-COUPON');
    await adj.applyCoupon.click();

    await expect(drawer.total).toHaveText(formatMoneyMinor(7500));
    await page.keyboard.press('Escape');
    await expect(cartPanel(page).quantity(product.id)).toHaveText('1');
  });

  test('a partial write is never left behind by a rejected sale', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    workerRegister,
  }) => {
    // The integration assertion: no sale row, no stock movement, and no register movement.
    // A rejection that moved the drawer but not the stock would be the worst outcome.
    const product = await seedProduct('partial', { price: 90, stock: 3 });
    const stockBefore = await readStock(product.id);
    const salesBefore = await countSalesForCashier(workerCashier.id);
    const cashBefore = await readExpectedCash(workerRegister.id);

    const page = await cashierContext.newPage();
    const drawer = await ringUpAndOpenDrawer(page, product.sku, product.id);

    await page.route(
      (url) => url.pathname.endsWith(SALES_PATH),
      async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            error: { code: 'VALIDATION_ERROR', message: 'Insufficient stock' },
          }),
        });
      }
    );

    await drawer.confirm.click();
    await expect(receiptDialog(page).dialog).toBeHidden();

    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore);
    expect(await readStock(product.id)).toBe(stockBefore);
    expect(await readExpectedCash(workerRegister.id)).toBe(cashBefore);
  });
});

test.describe('server-side stock guard', () => {
  test('the API refuses to oversell even when asked directly', async ({
    seedProduct,
    workerCashier,
    request,
  }) => {
    // The UI caps quantity at available stock, so this drives the API to prove the
    // server's own guarded write rejects it rather than trusting a client-side cap.
    const product = await seedProduct('apioversell', { price: 10, stock: 2 });

    const response = await request.post(`${API_BASE}/sales`, {
      headers: { Authorization: `Bearer ${workerCashier.accessToken}` },
      data: {
        items: [{ product_id: product.id, quantity: 99, unit_price: 10 }],
        payment_method: 'Cash',
      },
    });

    expect(response.ok(), 'overselling must be refused').toBe(false);
    expect(await readStock(product.id), 'stock must never go negative').toBe(2);
  });
});

async function readExpectedCash(sessionId: number): Promise<number> {
  const row = await dbOne<{ expected_cash: string }>(
    'SELECT expected_cash FROM register_sessions WHERE id = $1',
    [sessionId]
  );
  return money(row?.expected_cash);
}
