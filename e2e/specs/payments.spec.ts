/**
 * R2's breadth minus the two settings-driven modes: card, split, discount, tip, coupon.
 *
 * Every case ends in the D8 two-sided assertion, and every expected total that the
 * contract names is read from `contracts/checkout-totals.v1.json` (D7). Cap and clamp
 * cases assert documented *behaviour* instead, because the contract's own notes say caps
 * are deliberately not exercised by its fixtures.
 *
 * Nothing in this file writes `PUT /api/v1/settings` — that is `tax-loyalty.spec.ts`'s
 * exclusive job, and doing it here would change the totals every parallel worker asserts.
 */
import { assertPersistedSale, completeSaleAndReadId, money } from '../support/assertSale';
import { contractCase, toMajor } from '../support/contract';
import { dbOne, dbQuery } from '../support/db';
import { formatMoneyMinor } from '../support/money';
import {
  adjustments,
  cartPanel,
  checkoutDrawer,
  posPage,
  receiptDialog,
} from '../support/locators';
import { createCoupon } from '../fixtures/coupon';
import { getJson } from '../fixtures/seed';
import { expect, test } from '../fixtures/test';
import type { Page } from '@playwright/test';

const FIXED_DISCOUNT = contractCase('fixed-manual-discount');
const PERCENT_DISCOUNT = contractCase('percentage-manual-discount');
const COUPON = contractCase('coupon-discount');
const TIP = contractCase('tip-after-tax-regression');

/** Adds one unit of a product to the cart and opens the checkout drawer. */
async function ringUp(page: Page, sku: string, productId: number) {
  const pos = posPage(page);
  const cart = cartPanel(page);
  await page.goto('/pos');
  await pos.search.fill(sku);
  await pos.productCard(sku).click();
  await expect(cart.quantity(productId)).toHaveText('1');
  await cart.checkout.click();
  const drawer = checkoutDrawer(page);
  await expect(drawer.dialog).toBeVisible();
  return drawer;
}

test.describe('payment methods', () => {
  test('a Card sale persists Card, and moves no cash @smoke', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    workerRegister,
    request,
  }) => {
    const product = await seedProduct('card', { price: 120, stock: 5 });
    const expectedBefore = await readExpectedCash(workerRegister.id);

    const page = await cashierContext.newPage();
    const drawer = await ringUp(page, product.sku, product.id);

    await drawer.paymentMethod('card').check();
    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: 12000,
      paymentMethod: 'Card',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: 12000 }],
    });

    // A card sale must not touch the drawer. The register only moves on cash.
    expect(await readExpectedCash(workerRegister.id)).toBe(expectedBefore);
    expect(await countMovements(workerRegister.id, saleId)).toBe(0);
  });

  test('a split Cash + Card sale persists both entries and moves only the cash part @smoke', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    workerRegister,
    request,
  }) => {
    const product = await seedProduct('split', { price: 100, stock: 5 });
    const expectedBefore = await readExpectedCash(workerRegister.id);

    const page = await cashierContext.newPage();
    const drawer = await ringUp(page, product.sku, product.id);
    const adj = adjustments(page);

    await adj.splitToggle.check();
    // Seeded as [Cash, Card]; allocate 40 / 60 against a 100.00 total.
    await adj.splitAmount('Cash', 1).fill('40');
    await adj.splitAmount('Card', 2).fill('60');

    await expect(drawer.confirm).toBeEnabled();
    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    const sale = await getJson<{ payments: Array<{ method: string; amount: string | number }> }>(
      request,
      workerCashier.accessToken,
      `sales/${saleId}`
    );

    // The summary label is a lie here by design: `payment_method` is hardcoded to 'Cash'
    // whenever split is on, and `payments[]` carries the real breakdown. Asserting the
    // label alone would pass on a bug that lost the split entirely.
    const byMethod = Object.fromEntries(sale.payments.map((p) => [p.method, money(p.amount)]));
    expect(byMethod).toEqual({ Cash: 40, Card: 60 });
    expect(sale.payments.reduce((sum, p) => sum + money(p.amount), 0)).toBe(100);

    // The register moves by the cash component only — not by the sale total.
    expect(await readExpectedCash(workerRegister.id)).toBeCloseTo(expectedBefore + 40, 2);
  });

  test('a split that does not sum to the total cannot be submitted', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('unbalanced', { price: 100, stock: 5 });

    const page = await cashierContext.newPage();
    const drawer = await ringUp(page, product.sku, product.id);
    const adj = adjustments(page);

    await adj.splitToggle.check();
    await adj.splitAmount('Cash', 1).fill('30');
    await adj.splitAmount('Card', 2).fill('20');

    // Balance is exact integer-minor-unit equality; 50 of 100 is refused client-side.
    await expect(drawer.confirm).toBeDisabled();
  });
});

test.describe('adjustments', () => {
  test('a percentage discount produces the contract’s total', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    request,
  }) => {
    const unit = PERCENT_DISCOUNT.input.items[0]!.unitPriceMinor;
    const product = await seedProduct('pct', { price: toMajor(unit), stock: 5 });

    const page = await cashierContext.newPage();
    const drawer = await ringUp(page, product.sku, product.id);

    // The drawer's quick-discount buttons force percentage mode.
    await adjustments(page).discountPercent(15).click();
    await expect(drawer.total).toHaveText(
      formatMoneyMinor(PERCENT_DISCOUNT.expected.amountDueMinor)
    );

    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    await expect(receiptDialog(page).total).toHaveText(
      formatMoneyMinor(PERCENT_DISCOUNT.expected.amountDueMinor)
    );
    const sale = await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: PERCENT_DISCOUNT.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: unit }],
    });
    expect(sale.discount_type).toBe('percentage');
  });

  test('a fixed discount produces the contract’s total', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    request,
  }) => {
    const unit = FIXED_DISCOUNT.input.items[0]!.unitPriceMinor;
    const product = await seedProduct('fixed', { price: toMajor(unit), stock: 5 });

    const page = await cashierContext.newPage();
    const cart = cartPanel(page);
    const footer = (await import('../support/locators')).footerDiscount(page);

    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await expect(cart.quantity(product.id)).toHaveText('1');

    // Only the cart footer offers fixed mode; the drawer's controls are percentage-only.
    await footer.fixedMode.click();
    await footer.amount.fill(String(toMajor(FIXED_DISCOUNT.input.manualDiscount.valueMinor!)));
    await expect(cart.total).toHaveText(formatMoneyMinor(FIXED_DISCOUNT.expected.amountDueMinor));

    await cart.checkout.click();
    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();

    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    const sale = await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: FIXED_DISCOUNT.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: unit }],
    });
    expect(sale.discount_type).toBe('fixed');
    expect(money(sale.discount)).toBe(toMajor(FIXED_DISCOUNT.expected.manualDiscountMinor));
  });

  test('a discount larger than the cart is capped, never negative', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    request,
  }) => {
    // The contract deliberately does not name a cap case, so this asserts the documented
    // behaviour — the total floors at zero — rather than a fixture number.
    const product = await seedProduct('overdiscount', { price: 30, stock: 5 });

    const page = await cashierContext.newPage();
    const cart = cartPanel(page);
    const footer = (await import('../support/locators')).footerDiscount(page);

    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();

    await footer.fixedMode.click();
    await footer.amount.fill('500');

    await expect(cart.total).toHaveText(formatMoneyMinor(0));

    await cart.checkout.click();
    await expect(checkoutDrawer(page).dialog).toBeVisible();
    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      checkoutDrawer(page).confirm,
      receiptDialog(page).dialog
    );
    const sale = await getJson<{ total: string | number }>(
      request,
      workerCashier.accessToken,
      `sales/${saleId}`
    );
    expect(money(sale.total)).toBe(0);
    expect(money(sale.total)).toBeGreaterThanOrEqual(0);
  });

  test('a tip is added after tax and is never discounted', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    request,
  }) => {
    const unit = TIP.input.items[0]!.unitPriceMinor;
    const product = await seedProduct('tip', { price: toMajor(unit), stock: 5 });

    const page = await cashierContext.newPage();
    const drawer = await ringUp(page, product.sku, product.id);

    await adjustments(page).tip.fill(String(toMajor(TIP.input.tipMinor)));
    await expect(drawer.total).toHaveText(formatMoneyMinor(TIP.expected.amountDueMinor));

    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    await expect(receiptDialog(page).total).toHaveText(
      formatMoneyMinor(TIP.expected.amountDueMinor)
    );
    const sale = await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: TIP.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: unit }],
    });
    // The tip is recorded separately, not folded into the discounted base.
    expect(money(sale.tip_amount)).toBe(toMajor(TIP.expected.tipMinor));
  });

  test('a negative tip is clamped to zero', async ({ cashierContext, seedProduct }) => {
    const product = await seedProduct('negtip', { price: 50, stock: 5 });

    const page = await cashierContext.newPage();
    const drawer = await ringUp(page, product.sku, product.id);

    await adjustments(page).tip.fill('-10');

    // `setTip(Math.max(0, ...))` — the total must not fall below the subtotal.
    await expect(drawer.total).toHaveText(formatMoneyMinor(5000));
  });
});

test.describe('coupons', () => {
  test('a valid coupon applies its discount and records a usage row', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    adminApi,
    request,
  }) => {
    const unit = COUPON.input.items[0]!.unitPriceMinor;
    const product = await seedProduct('coupon', { price: toMajor(unit), stock: 5 });
    const coupon = await createCoupon(adminApi, workerCashier.namespace, 'ok', {
      type: 'fixed',
      value: toMajor(COUPON.input.couponDiscountMinor),
    });

    const page = await cashierContext.newPage();
    const drawer = await ringUp(page, product.sku, product.id);
    const adj = adjustments(page);

    await adj.couponInput.fill(coupon.code);
    await adj.applyCoupon.click();

    await expect(drawer.total).toHaveText(formatMoneyMinor(COUPON.expected.amountDueMinor));
    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: COUPON.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: unit }],
    });

    const usage = await dbOne<{ discount_applied: string }>(
      'SELECT discount_applied FROM coupon_usage WHERE sale_id = $1 AND coupon_id = $2',
      [saleId, coupon.id]
    );
    expect(usage, 'a coupon_usage row for this sale').toBeDefined();
    expect(money(usage?.discount_applied)).toBe(toMajor(COUPON.expected.couponDiscountMinor));
  });

  test('an invalid code errors, applies nothing, and leaves the cart intact', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('badcoupon', { price: 80, stock: 5 });

    const page = await cashierContext.newPage();
    const drawer = await ringUp(page, product.sku, product.id);
    const adj = adjustments(page);

    await adj.couponInput.fill('E2E-NO-SUCH-COUPON');
    await adj.applyCoupon.click();

    // R9 in miniature: a rejected adjustment must not cost the cashier the order.
    await expect(drawer.total).toHaveText(formatMoneyMinor(8000));
    await expect(adj.couponInput).toBeVisible();
    await expect(cartPanel(page).line(product.id)).toBeAttached();
  });

  test('an exhausted coupon is refused with a distinguishable message', async ({
    workerCashier,
    adminApi,
    request,
  }) => {
    const coupon = await createCoupon(adminApi, workerCashier.namespace, 'used', {
      type: 'fixed',
      value: 5,
      maxUses: 1,
    });

    // Consume the single use directly, then prove the *server* refuses the next attempt.
    // Driving two full sales through the UI would prove the same thing far more slowly.
    await dbQuery(
      `INSERT INTO coupon_usage (coupon_id, sale_id, discount_applied)
       SELECT $1, id, 5 FROM sales ORDER BY id DESC LIMIT 1`,
      [coupon.id]
    );

    const response = await request.post(
      `${(await import('../fixtures/seed')).API_BASE}/coupons/validate`,
      {
        headers: { Authorization: `Bearer ${workerCashier.accessToken}` },
        data: { code: coupon.code, subtotal: 100, item_product_ids: [] },
      }
    );
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('usage limit');
  });
});

async function readExpectedCash(sessionId: number): Promise<number> {
  const row = await dbOne<{ expected_cash: string }>(
    'SELECT expected_cash FROM register_sessions WHERE id = $1',
    [sessionId]
  );
  return money(row?.expected_cash);
}

async function countMovements(sessionId: number, saleId: number): Promise<number> {
  const row = await dbOne<{ n: string }>(
    'SELECT count(*)::text AS n FROM register_movements WHERE session_id = $1 AND sale_id = $2',
    [sessionId, saleId]
  );
  return Number(row?.n ?? '0');
}
