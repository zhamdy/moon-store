/**
 * The spine of R1: login through receipt, proven against the real stack.
 *
 * Every money assertion here is two-sided (D8) — the total the cashier reads *and* the
 * row the server persisted. One POST that writes two rows and two POSTs that write one
 * are different bugs, and each looks fine from one side.
 *
 * Expected totals come from `contracts/checkout-totals.v1.json` (D7). Under the pinned
 * tax-disabled baseline (D5a) the smoke sale is `no-adjustments-tax-disabled`.
 */
import {
  assertPersistedSale,
  countSalesForCashier,
  latestSaleIdForCashier,
  money,
  readStock,
} from '../support/assertSale';
import { contractCase, toMajor } from '../support/contract';
import { formatMoneyMinor } from '../support/money';
import {
  cartPanel,
  checkoutDrawer,
  posPage,
  receiptDialog,
  startupPrompt,
} from '../support/locators';
import { tr } from '../support/i18n';
import { API_BASE, getJson } from '../fixtures/seed';
import { expect, test } from '../fixtures/test';
import type { Product } from '../fixtures/types';

const SMOKE_CASE = contractCase('no-adjustments-tax-disabled');
const UNIT_PRICE_MINOR = SMOKE_CASE.input.items[0]!.unitPriceMinor;

test.describe('cash sale @smoke', () => {
  test('a cashier with no shift opens the till through the startup prompt', async ({
    freshCashierContext,
    request,
  }) => {
    // This spec deliberately does NOT use the worker cashier: that one already has a
    // shift and a register open, so the prompt would have nothing to do. Suppressing
    // `moon-startup-dismissed` is not the same as genuinely having no shift.
    const page = await freshCashierContext.context.newPage();
    await page.goto('/pos');

    const prompt = startupPrompt(page);
    await expect(prompt.dialog).toBeVisible();

    // Two sequential steps in one dialog, never both at once.
    await prompt.clockIn.click();
    await expect(prompt.openingFloat).toBeVisible();
    await prompt.openingFloat.fill('250');
    await prompt.openRegister.click();

    await expect(prompt.dialog).toBeHidden();

    // The float is not just a UI value — it seeds the drawer's expected cash.
    const register = await getJson<{ opening_float: string | number; status: string }>(
      request,
      freshCashierContext.accessToken,
      'register/current'
    );
    expect(register.status).toBe('open');
    expect(money(register.opening_float)).toBe(250);
  });

  test('search, add, adjust quantity, and complete a cash sale', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    request,
  }) => {
    const product = await seedProduct('cash', {
      price: toMajor(UNIT_PRICE_MINOR),
      stock: 25,
    });
    const stockBefore = await readStock(product.id);
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');

    const pos = posPage(page);
    const cart = cartPanel(page);

    // The cart starts empty and checkout is unavailable until something is in it.
    await expect(cart.empty).toBeVisible();
    await expect(cart.checkout).toBeDisabled();

    // Searching a worker-namespaced SKU returns that product and no other worker's.
    await pos.search.fill(product.sku);
    await expect(pos.productCard(product.sku)).toBeVisible();

    await pos.productCard(product.sku).click();
    await expect(cart.quantity(product.id)).toHaveText('1');

    // Raise to 3 and the line, then the cart total, follow.
    await cart.increaseQuantity(product.id).click();
    await cart.increaseQuantity(product.id).click();
    await expect(cart.quantity(product.id)).toHaveText('3');
    await expect(cart.total).toHaveText(formatMoneyMinor(UNIT_PRICE_MINOR * 3));

    // Back down to the contract case's quantity of 1, so the expected total is the
    // contract's `amountDueMinor` rather than a number derived here.
    await cart.decreaseQuantity(product.id).click();
    await cart.decreaseQuantity(product.id).click();
    await expect(cart.quantity(product.id)).toHaveText('1');
    await expect(cart.total).toHaveText(formatMoneyMinor(SMOKE_CASE.expected.amountDueMinor));

    await cart.checkout.click();
    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();
    await expect(drawer.total).toHaveText(formatMoneyMinor(SMOKE_CASE.expected.amountDueMinor));

    // Regression guard, and the reason this suite exists. The confirm button is the last
    // child of a flex-column drawer body; without `shrink-0` it was compressed to zero
    // height whenever the drawer's content exceeded the viewport, so a sale could not be
    // completed on any screen under roughly 1000px tall. jsdom has no layout engine, so
    // all 380 client unit tests passed against it.
    const confirmBox = await drawer.confirm.boundingBox();
    expect(confirmBox?.height, 'the confirm button must have real height').toBeGreaterThan(0);

    // Cash is already the default; selecting it explicitly is what a cashier does.
    await drawer.paymentMethod('cash').check();
    await drawer.confirm.click();

    // --- Screen half of D8 -------------------------------------------------------
    const receipt = receiptDialog(page);
    await expect(receipt.dialog).toBeVisible();
    await expect(receipt.total).toHaveText(formatMoneyMinor(SMOKE_CASE.expected.amountDueMinor));
    await expect(receipt.dialog).toContainText(`${tr('receipt.paidWith')}: ${tr('cart.cash')}`);

    // --- Persisted half of D8 ----------------------------------------------------
    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore + 1);

    const saleId = await latestSaleIdForCashier(workerCashier.id);
    expect(saleId).toBeDefined();

    const sale = await assertPersistedSale(request, workerCashier.accessToken, saleId!, {
      amountDueMinor: SMOKE_CASE.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: UNIT_PRICE_MINOR }],
    });
    expect(sale.status).toBe('completed');

    // Stock moved by exactly the quantity sold — once, not twice.
    expect(await readStock(product.id)).toBe(stockBefore - 1);
  });

  test('removing the last line returns the cart to empty and disables checkout', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('remove', { price: 40, stock: 5 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    const pos = posPage(page);
    const cart = cartPanel(page);

    await pos.search.fill(product.sku);
    await pos.productCard(product.sku).click();
    await expect(cart.line(product.id)).toBeVisible();

    await cart.removeItem(product.id).click();

    await expect(cart.line(product.id)).toBeHidden();
    await expect(cart.empty).toBeVisible();
    await expect(cart.checkout).toBeDisabled();
  });

  test('an unknown SKU shows the empty result state rather than spinning forever', async ({
    cashierContext,
  }) => {
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    const pos = posPage(page);

    await pos.search.fill('E2E-NO-SUCH-SKU-ZZZZ');

    // The assertion that matters is that the grid settles with nothing in it — a spinner
    // that never resolves would leave a card locator pending until timeout instead.
    await expect(pos.productCard('E2E-NO-SUCH-SKU-ZZZZ')).toHaveCount(0);
    await expect(page.getByTestId(/^product-card-/)).toHaveCount(0);
  });
});

/**
 * The barcode seam, stated explicitly so a later reader knows the gap is deliberate.
 *
 * `useScanner` drives Quagga2 against a real camera in `LiveStream` mode and there is no
 * keyboard-wedge path, so decoding a barcode from a synthetic video stream in headless
 * Chromium is disproportionate machinery for the one step it would prove. The optical
 * decode is out of scope. What follows it is not: these cover the lookup that
 * `handleBarcodeDetected` depends on, including the miss case that would otherwise add an
 * empty cart line.
 */
test.describe('barcode lookup (the scan consequence, not the scan)', () => {
  test('a known barcode resolves to this worker’s product', async ({
    seedProduct,
    workerCashier,
    request,
  }) => {
    const barcode = `E2E${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const product = await seedProduct('barcode', { price: 60, stock: 3, barcode });

    const found = await getJson<Product>(
      request,
      workerCashier.accessToken,
      `products/barcode/${barcode}`
    );
    expect(found.id).toBe(product.id);
    expect(found.sku).toBe(product.sku);
  });

  test('an unknown barcode returns a distinguishable not-found', async ({
    workerCashier,
    request,
  }) => {
    // A null product rather than a 404 would let the till add an empty cart line.
    const response = await request.get(`${API_BASE}/products/barcode/E2E-DOES-NOT-EXIST`, {
      headers: { Authorization: `Bearer ${workerCashier.accessToken}` },
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
