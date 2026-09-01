/**
 * The same money path, in the configuration the app actually ships.
 *
 * `settingsStore` defaults to `locale: 'ar'` and `client/index.html` is
 * `<html lang="ar" dir="rtl">`, so Arabic RTL is what a till runs unless someone changes
 * it. The rest of the suite pins `en` for readable diagnostics, which means without this
 * spec the default configuration would be the one configuration never tested.
 *
 * Every locator here comes from the `ar` catalog, so this also exercises the translations
 * themselves: a missing or renamed Arabic key fails at construction.
 */
import {
  assertPersistedSale,
  countSalesForCashier,
  latestSaleIdForCashier,
  readStock,
} from '../support/assertSale';
import { contractCase, toMajor } from '../support/contract';
import { formatMoneyMinor } from '../support/money';
import { cartPanel, checkoutDrawer, posPage, receiptDialog } from '../support/locators';
import { expect, test } from '../fixtures/test';

const SMOKE_CASE = contractCase('no-adjustments-tax-disabled');
const UNIT_PRICE_MINOR = SMOKE_CASE.input.items[0]!.unitPriceMinor;
const AR = { locale: 'ar' } as const;

// The whole file runs on the shipped default rather than the suite's pinned `en`.
test.use({ appLocale: 'ar' });

test.describe('Arabic RTL default @smoke', () => {
  test('a cash sale completes and persists identically under the shipped default', async ({
    cashierContext,
    seedProduct,
    workerCashier,
    request,
  }) => {
    const product = await seedProduct('rtl', {
      price: toMajor(UNIT_PRICE_MINOR),
      stock: 12,
    });
    const stockBefore = await readStock(product.id);
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');

    // The direction is the point: a locator that works in `en` can silently fail here.
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const pos = posPage(page, AR);
    const cart = cartPanel(page, AR);

    await pos.search.fill(product.sku);
    await pos.productCard(product.sku).click();
    await expect(cart.quantity(product.id)).toHaveText('1');

    // Arabic renders the currency suffix as جم, with Latin digits (`numberingSystem`).
    await expect(cart.total).toHaveText(formatMoneyMinor(SMOKE_CASE.expected.amountDueMinor, 'ar'));

    await cart.checkout.click();
    const drawer = checkoutDrawer(page, AR);
    await expect(drawer.dialog).toBeVisible();

    // The checkout sheet flips side under RTL (`side={isRtl ? 'left' : 'right'}`), which
    // is exactly the kind of thing that renders but is unclickable if it regresses.
    const confirmBox = await drawer.confirm.boundingBox();
    expect(confirmBox?.height, 'the confirm button must have real height in RTL').toBeGreaterThan(
      0
    );

    await drawer.paymentMethod('cash').check();
    await drawer.confirm.click();

    const receipt = receiptDialog(page, AR);
    await expect(receipt.dialog).toBeVisible();
    await expect(receipt.total).toHaveText(
      formatMoneyMinor(SMOKE_CASE.expected.amountDueMinor, 'ar')
    );

    // The persisted row must be byte-identical to the `en` path — locale is presentation,
    // and a total that differs by locale would be a money bug.
    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore + 1);
    const saleId = await latestSaleIdForCashier(workerCashier.id);
    expect(saleId).toBeDefined();

    await assertPersistedSale(request, workerCashier.accessToken, saleId!, {
      amountDueMinor: SMOKE_CASE.expected.amountDueMinor,
      paymentMethod: 'Cash',
      cashierId: workerCashier.id,
      items: [{ productId: product.id, quantity: 1, unitPriceMinor: UNIT_PRICE_MINOR }],
    });

    expect(await readStock(product.id)).toBe(stockBefore - 1);
  });
});
