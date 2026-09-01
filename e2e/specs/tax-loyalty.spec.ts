/**
 * The settings-driven half of R2 — tax modes and loyalty.
 *
 * **This is the only file in the suite that writes `PUT /api/v1/settings`,** and it runs
 * in the serial `pos-settings` project: one worker, `mode: 'serial'`, ordered after
 * `pos-parallel` has finished. Tax and loyalty are global key/value rows, so a write from
 * a parallel worker would silently change the totals every other worker asserts on.
 *
 * All four tax cases live here, not just the "variants": under the tax-disabled baseline
 * (D5a) even `exclusive-tax` needs a settings write.
 *
 * The restore path is written before the first assertion on purpose. A spec that fails
 * without restoring leaves the next run in inclusive-tax mode, and that is far more
 * expensive to diagnose than the bug it was chasing.
 */
import {
  adminUserId,
  assertPersistedSale,
  completeSaleAndReadId,
  money,
} from '../support/assertSale';
import { contractCase, toMajor } from '../support/contract';
import { formatMoneyMinor } from '../support/money';
import {
  cartPanel,
  checkoutDrawer,
  loyaltyControls,
  posPage,
  receiptDialog,
} from '../support/locators';
import { createCustomer, grantLoyaltyPoints, readLoyaltyPoints } from '../fixtures/customer';
import { readSettings, restoreBaseline, writeSettings } from '../fixtures/settings';
import { SETTINGS_BASELINE } from '../support/settingsBaseline';
import { API_BASE } from '../fixtures/seed';
import { expect, test } from '../fixtures/test';
import type { Page } from '@playwright/test';

const EXCLUSIVE = contractCase('exclusive-tax');
const INCLUSIVE = contractCase('inclusive-tax');
const ROUNDING = contractCase('half-minor-unit-rounding-boundary');
const LOYALTY = contractCase('loyalty-redemption-and-earning');

test.describe.configure({ mode: 'serial' });

/**
 * Applies settings and returns a page that has actually *seen* them.
 *
 * The reload is not defensive padding. React Query holds settings for five minutes with
 * `refetchOnWindowFocus: false`, so a page opened before the write keeps submitting under
 * the previous mode — and the assertion then passes while testing the wrong thing.
 */
async function applySettingsAndOpen(
  page: Page,
  request: Parameters<typeof writeSettings>[0],
  values: Record<string, string>
) {
  await writeSettings(request, values);
  await page.goto('/pos');
  await page.reload();
}

test.describe('tax modes', () => {
  test.afterAll(async ({ adminApi }) => {
    await restoreBaseline(adminApi);
  });

  test('exclusive tax adds tax on top of the discounted base', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    adminApi,
    request,
  }) => {
    const unit = EXCLUSIVE.input.items[0]!.unitPriceMinor;
    const product = await seedProduct('exclusive', { price: toMajor(unit), stock: 5 });

    const page = await cashierContext.newPage();
    await applySettingsAndOpen(page, adminApi, {
      tax_enabled: 'true',
      tax_rate: String(EXCLUSIVE.input.tax.ratePercent),
      tax_mode: 'exclusive',
    });

    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await cartPanel(page).checkout.click();

    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();

    // Anti-stale-pass guard: the VAT line only renders when tax is on, so seeing it
    // proves the page picked up the write rather than rendering the old mode.
    await expect(loyaltyControls(page).vatLabel).toBeVisible();
    await expect(drawer.total).toHaveText(formatMoneyMinor(EXCLUSIVE.expected.amountDueMinor));

    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    const sale = await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: EXCLUSIVE.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: unit }],
    });
    expect(money(sale.tax_amount)).toBeCloseTo(toMajor(EXCLUSIVE.expected.taxAmountMinor), 2);
  });

  test('inclusive tax leaves the total unchanged but persists a different tax amount', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    adminApi,
    request,
  }) => {
    // The case most likely to be silently wrong, and — because of the settings cache —
    // the one most likely to silently pass. The reload plus the VAT-line assertion above
    // are what make a stale-cache pass impossible here.
    const unit = INCLUSIVE.input.items[0]!.unitPriceMinor;
    const product = await seedProduct('inclusive', { price: toMajor(unit), stock: 5 });

    const page = await cashierContext.newPage();
    await applySettingsAndOpen(page, adminApi, {
      tax_enabled: 'true',
      tax_rate: String(INCLUSIVE.input.tax.ratePercent),
      tax_mode: 'inclusive',
    });

    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await cartPanel(page).checkout.click();

    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();
    await expect(loyaltyControls(page).vatLabel).toBeVisible();

    // Inclusive: the customer pays the shelf price; the tax is carved out of it.
    await expect(drawer.total).toHaveText(formatMoneyMinor(INCLUSIVE.expected.amountDueMinor));

    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    const sale = await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: INCLUSIVE.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: unit }],
    });
    // Same total as the exclusive case, different tax — which is the whole point.
    expect(money(sale.tax_amount)).toBeCloseTo(toMajor(INCLUSIVE.expected.taxAmountMinor), 2);
  });

  test('the half-minor-unit rounding boundary matches the contract', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    adminApi,
    request,
  }) => {
    // 3.33 at 50% is 1.665 — exactly the half-unit case where a naive round differs.
    const unit = ROUNDING.input.items[0]!.unitPriceMinor;
    const product = await seedProduct('rounding', { price: toMajor(unit), stock: 5 });

    const page = await cashierContext.newPage();
    await applySettingsAndOpen(page, adminApi, {
      tax_enabled: 'true',
      tax_rate: String(ROUNDING.input.tax.ratePercent),
      tax_mode: 'exclusive',
    });

    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await cartPanel(page).checkout.click();

    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();
    await expect(drawer.total).toHaveText(formatMoneyMinor(ROUNDING.expected.amountDueMinor));

    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    const sale = await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: ROUNDING.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: unit }],
    });
    expect(money(sale.tax_amount)).toBeCloseTo(toMajor(ROUNDING.expected.taxAmountMinor), 2);
  });

  test('tax disabled produces zero tax and a total equal to the subtotal', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    adminApi,
    request,
  }) => {
    const product = await seedProduct('notax', { price: 60, stock: 5 });

    const page = await cashierContext.newPage();
    await applySettingsAndOpen(page, adminApi, { ...SETTINGS_BASELINE });

    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await cartPanel(page).checkout.click();

    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();
    // The negative of the guard above: with tax off, the VAT line must be gone.
    await expect(loyaltyControls(page).vatLabel).toHaveCount(0);
    await expect(drawer.total).toHaveText(formatMoneyMinor(6000));

    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    const sale = await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: 6000,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: 6000 }],
    });
    expect(money(sale.tax_amount)).toBe(0);
  });
});

test.describe('loyalty', () => {
  test.afterAll(async ({ adminApi }) => {
    await restoreBaseline(adminApi);
  });

  test('redeeming points discounts the total and debits exactly those points', async ({
    adminContext,
    seedProduct,
    adminApi,
  }) => {
    const unit = LOYALTY.input.items[0]!.unitPriceMinor;
    const pointsToRedeem = LOYALTY.input.loyalty.pointsRedeemed;

    const product = await seedProduct('loyalty', { price: toMajor(unit), stock: 5 });
    const customer = await createCustomer(adminApi, 'e2e-loyalty', 'loyal');
    const startingPoints = await grantLoyaltyPoints(adminApi, customer.id, pointsToRedeem + 500);

    // Driven as Admin, not as this worker's cashier: `GET /api/v1/customers` is
    // Admin-only, so a cashier's customer search returns nothing and loyalty cannot be
    // reached from a till at all. See the guardrail test at the bottom of this file.
    const page = await adminContext.newPage();
    await applySettingsAndOpen(page, adminApi, {
      ...SETTINGS_BASELINE,
      loyalty_enabled: 'true',
      loyalty_points_per_egp: String(LOYALTY.input.loyalty.pointsPerEgp),
      loyalty_egp_per_point: String(toMajor(LOYALTY.input.loyalty.egpPerPointMinor)),
    });

    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await cartPanel(page).checkout.click();

    const drawer = checkoutDrawer(page);
    const loyalty = loyaltyControls(page);
    await expect(drawer.dialog).toBeVisible();

    await loyalty.customerSearch.fill(customer.name);
    await page.getByText(customer.name).last().click();

    // The controls only render when loyalty is enabled — their presence is itself the
    // proof the page is not rendering a stale settings snapshot.
    await expect(loyalty.redeemToggle).toBeVisible();
    await loyalty.redeemToggle.check();
    await loyalty.pointsToRedeem.fill(String(pointsToRedeem));

    await expect(drawer.total).toHaveText(formatMoneyMinor(LOYALTY.expected.amountDueMinor));

    const adminId = await adminUserId(adminApi);
    const saleId = await completeSaleAndReadId(
      page,
      adminId,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    const sale = await assertPersistedSale(adminApi, '', saleId, {
      amountDueMinor: LOYALTY.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: adminId,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: unit }],
    });
    expect(sale.customer_id).toBe(customer.id);
    expect(Number(sale.points_redeemed ?? 0)).toBe(pointsToRedeem);

    // Both directions at once: N points spent, and the contract's earned points credited.
    // `pointsPerEgp` is points earned per 1 EGP; `egpPerPointMinor` is minor units
    // redeemed per 1 point. Neither is "per 100 points" — the direction is easy to invert.
    const after = await readLoyaltyPoints(adminApi, customer.id);
    expect(after).toBe(startingPoints - pointsToRedeem + LOYALTY.expected.earnedPoints);
  });

  test('an anonymous sale earns nothing and does not error', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    adminApi,
    request,
  }) => {
    // Every other spec in the suite rings up anonymous sales, so this negative must hold.
    const product = await seedProduct('anon', { price: 50, stock: 5 });

    const page = await cashierContext.newPage();
    await applySettingsAndOpen(page, adminApi, { ...SETTINGS_BASELINE });

    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await cartPanel(page).checkout.click();

    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();

    const saleId = await completeSaleAndReadId(
      page,
      workerCashier.id,
      drawer.confirm,
      receiptDialog(page).dialog
    );
    const sale = await assertPersistedSale(request, workerCashier.accessToken, saleId, {
      amountDueMinor: 5000,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: 5000 }],
    });
    expect(sale.customer_id).toBeNull();
    expect(Number(sale.points_redeemed ?? 0)).toBe(0);
  });

  test('redemption is capped by the customer’s balance', async ({
    workerCashier,
    adminApi,
    request,
  }) => {
    // Driven at the API rather than the UI: the point is the *server's* cap, and the UI
    // clamps its own input, which would hide a server-side regression.
    const customer = await createCustomer(adminApi, workerCashier.namespace, 'poor');
    await grantLoyaltyPoints(adminApi, customer.id, 10);

    const response = await request.post(`${API_BASE}/sales`, {
      headers: { Authorization: `Bearer ${workerCashier.accessToken}` },
      data: {
        items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
        payment_method: 'Cash',
        customer_id: customer.id,
        points_redeemed: 100000,
      },
    });

    // Whatever the server does, it must not let a customer spend points they do not have.
    expect(response.ok(), 'redeeming more points than held must be refused').toBe(false);
    expect(await readLoyaltyPoints(adminApi, customer.id)).toBe(10);
  });
});

test.describe('settings guardrails', () => {
  test.afterAll(async ({ adminApi }) => {
    await restoreBaseline(adminApi);
  });

  test('a Cashier cannot search customers, so loyalty is unreachable from a till', async ({
    workerCashier,
    request,
  }) => {
    // Recorded rather than worked around. `POST /customers` and `GET /customers/:id/loyalty`
    // both allow Cashier, but the list/search endpoint the cart's customer picker uses is
    // Admin-only — so a cashier can create a customer and read their points, yet cannot
    // attach one to a sale. That asymmetry reads as an oversight, but widening an
    // authorization rule is a product decision, not a test-suite decision, so this pins
    // today's behaviour and the loyalty specs above run as Admin.
    const response = await request.get(`${API_BASE}/customers?search=e2e`, {
      headers: { Authorization: `Bearer ${workerCashier.accessToken}` },
    });
    expect(response.status(), 'GET /customers as Cashier').toBe(403);
  });

  test('a non-Admin cannot write settings', async ({ workerCashier, request }) => {
    // If this ever succeeded, a cashier-token fixture could silently reconfigure the
    // suite's baseline and every parallel worker's totals with it.
    const response = await request.put(`${API_BASE}/settings`, {
      headers: { Authorization: `Bearer ${workerCashier.accessToken}` },
      data: { tax_enabled: 'true' },
    });
    expect(response.status()).toBe(403);
  });

  test('the baseline is restored exactly, key for key', async ({ adminApi }) => {
    await restoreBaseline(adminApi);
    const settings = await readSettings(adminApi);
    for (const [key, expected] of Object.entries(SETTINGS_BASELINE)) {
      expect(settings[key], `settings.${key} after restore`).toBe(expected);
    }
  });
});
