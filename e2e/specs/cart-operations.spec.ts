/**
 * Cart changes (R1) and held-cart persistence (R9).
 *
 * Held carts are the sharpest thing in this file. A suspended cart — items, discount,
 * notes, tip and coupon code — lives only in `moon-held-carts` in the browser, with no
 * server record at all. That is exactly the shape a jsdom test proves in isolation and a
 * real browser breaks across a reload, and losing one is a real money loss for a cashier
 * mid-order.
 */
import {
  completeSaleAndReadId,
  countSalesForCashier,
  money,
  readStock,
} from '../support/assertSale';
import { formatMoneyMinor } from '../support/money';
import {
  cartPanel,
  checkoutDrawer,
  footerDiscount,
  heldCarts,
  posPage,
  receiptDialog,
  reviewBanner,
} from '../support/locators';
import { HELD_CARTS_STORAGE_KEY } from '../fixtures/storage';
import { expect, test } from '../fixtures/test';
import type { Page } from '@playwright/test';

interface HeldCartEntry {
  id: string;
  name: string;
  items: Array<{ product_id: number; quantity: number }>;
  discount: number;
  discountType: string;
  notes: string;
  tip: number;
  couponCode: string;
}

/** The persisted store, read from the browser rather than inferred from the rendering. */
async function readHeldCarts(page: Page): Promise<HeldCartEntry[]> {
  const raw = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    HELD_CARTS_STORAGE_KEY
  );
  if (!raw) return [];
  return (JSON.parse(raw) as { state?: { carts?: HeldCartEntry[] } }).state?.carts ?? [];
}

async function addToCart(page: Page, sku: string, productId: number) {
  await posPage(page).search.fill(sku);
  await posPage(page).productCard(sku).click();
  await expect(cartPanel(page).quantity(productId)).toHaveText('1');
}

test.describe('cart quantity and removal', () => {
  test('quantity changes move the line total and the cart total together', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('qty', { price: 25, stock: 10 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    const cart = cartPanel(page);
    await addToCart(page, product.sku, product.id);

    await cart.increaseQuantity(product.id).click();
    await expect(cart.quantity(product.id)).toHaveText('2');
    await expect(cart.total).toHaveText(formatMoneyMinor(5000));

    await cart.decreaseQuantity(product.id).click();
    await expect(cart.quantity(product.id)).toHaveText('1');
    await expect(cart.total).toHaveText(formatMoneyMinor(2500));
  });

  test('quantity cannot be raised past available stock', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('stockcap', { price: 10, stock: 2 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    const cart = cartPanel(page);
    await addToCart(page, product.sku, product.id);

    await cart.increaseQuantity(product.id).click();
    await expect(cart.quantity(product.id)).toHaveText('2');

    // The control disables at the stock ceiling rather than letting the cart oversell.
    await expect(cart.increaseQuantity(product.id)).toBeDisabled();
  });
});

test.describe('held carts', () => {
  test('holding clears the active cart, lists the held one, and creates no sale', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    const product = await seedProduct('hold', { price: 70, stock: 6 });
    const stockBefore = await readStock(product.id);
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    const cart = cartPanel(page);
    const held = heldCarts(page);

    await addToCart(page, product.sku, product.id);
    await held.hold.click();

    // The heading is the precise signal: exactly zero lines, not "some empty text exists".
    await expect(cart.heading(0)).toBeVisible();

    const stored = await readHeldCarts(page);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.items[0]).toMatchObject({ product_id: product.id, quantity: 1 });

    // R9: holding is not selling. No sale row, no stock movement.
    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore);
    expect(await readStock(product.id)).toBe(stockBefore);
  });

  test('a held cart carries its discount, tip, notes and coupon code', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('holdextras', { price: 200, stock: 6 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await addToCart(page, product.sku, product.id);

    const footer = footerDiscount(page);
    await footer.fixedMode.click();
    await footer.amount.fill('20');

    await heldCarts(page).hold.click();

    const [stored] = await readHeldCarts(page);
    expect(stored?.discount).toBe(20);
    expect(stored?.discountType).toBe('fixed');
    // Present even when empty — the shape is what a resume depends on.
    expect(stored).toHaveProperty('notes');
    expect(stored).toHaveProperty('tip');
    expect(stored).toHaveProperty('couponCode');
  });

  test('held carts survive a full page reload', async ({ cashierContext, seedProduct }) => {
    const product = await seedProduct('holdreload', { price: 45, stock: 6 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await addToCart(page, product.sku, product.id);
    await heldCarts(page).hold.click();

    const before = await readHeldCarts(page);
    expect(before).toHaveLength(1);

    // The assertion that matters: a cashier who refreshes must not lose a suspended order.
    await page.reload();
    const after = await readHeldCarts(page);
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe(before[0]?.id);
    expect(after[0]?.items[0]).toMatchObject({ product_id: product.id, quantity: 1 });
  });

  test('two carts held in succession get distinct entries', async ({
    cashierContext,
    seedProduct,
  }) => {
    const first = await seedProduct('hold1', { price: 15, stock: 6 });
    const second = await seedProduct('hold2', { price: 35, stock: 6 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    const held = heldCarts(page);

    await addToCart(page, first.sku, first.id);
    await held.hold.click();
    await addToCart(page, second.sku, second.id);
    await held.hold.click();

    const stored = await readHeldCarts(page);
    expect(stored).toHaveLength(2);
    expect(stored[0]?.id).not.toBe(stored[1]?.id);
    expect(stored.map((c) => c.items[0]?.product_id).sort()).toEqual([first.id, second.id].sort());
  });

  test('holding an empty cart is refused', async ({ cashierContext }) => {
    const page = await cashierContext.newPage();
    await page.goto('/pos');

    await expect(cartPanel(page).empty).toBeVisible();
    // Disabled rather than creating a meaningless empty entry.
    await expect(heldCarts(page).hold).toBeDisabled();
    expect(await readHeldCarts(page)).toHaveLength(0);
  });

  test('a resumed cart must be acknowledged, then checks out to the same total', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    request,
  }) => {
    const product = await seedProduct('resume', { price: 90, stock: 6 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    const cart = cartPanel(page);
    const held = heldCarts(page);

    await addToCart(page, product.sku, product.id);
    await expect(cart.total).toHaveText(formatMoneyMinor(9000));
    await held.hold.click();
    await expect(cart.empty).toBeVisible();

    await held.open.click();
    await expect(held.dialog).toBeVisible();
    await held.retrieve.first().click();

    // The items come back...
    await expect(cart.line(product.id)).toBeVisible();
    await expect(cart.total).toHaveText(formatMoneyMinor(9000));
    // ...and the held entry is consumed, not duplicated.
    await expect.poll(() => readHeldCarts(page).then((c) => c.length)).toBe(0);

    // `restoreFromHeld` always sets needsReview, which blocks checkout *silently* in
    // `handleCheckout`. Asserting the gate is what stops a later spec from mistaking a
    // no-op confirm for a completed sale.
    const review = reviewBanner(page);
    await expect(review.warning).toBeVisible();
    await expect(cart.checkout).toBeDisabled();

    await review.acknowledge.click();
    await expect(cart.checkout).toBeEnabled();

    await cart.checkout.click();
    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();

    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );

    const sale = await (
      await import('../support/assertSale')
    ).fetchSale(request, workerCashier.accessToken, saleId);
    expect(money(sale.total)).toBe(90);
  });
});
