/**
 * The D8 two-sided assertion: every money path is checked on the **screen** and in the
 * **persisted server state**.
 *
 * These are different bugs. One POST on the wire that writes two rows, and two POSTs that
 * write one, both look fine from one side and wrong from the other. Asserting only the
 * cashier's view or only the database catches neither reliably.
 */
import { expect, type APIRequestContext } from '@playwright/test';
import { dbOne } from './db';
import { getJson } from '../fixtures/seed';

export interface PersistedSaleItem {
  product_id: number;
  quantity: number;
  unit_price: string | number;
}

export interface PersistedSale {
  id: number;
  total: string | number;
  subtotal: string | number;
  tax_amount: string | number;
  discount: string | number;
  discount_type: string;
  tip_amount: string | number;
  payment_method: string;
  cashier_id: number | null;
  customer_id: number | null;
  points_redeemed: number | string | null;
  status: string;
  items: PersistedSaleItem[];
  payments: Array<{ method: string; amount: string | number }>;
}

/**
 * pg returns NUMERIC as a string to preserve exactness. Comparing one to a JS number
 * silently fails, so every money read goes through this.
 */
export function money(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export async function fetchSale(
  request: APIRequestContext,
  token: string,
  saleId: number
): Promise<PersistedSale> {
  return getJson<PersistedSale>(request, token, `sales/${saleId}`);
}

/** Raw stock, read past any client or React Query cache. */
export async function readStock(productId: number): Promise<number> {
  const row = await dbOne<{ stock: string }>('SELECT stock FROM products WHERE id = $1', [
    productId,
  ]);
  if (!row) throw new Error(`No product row for id ${productId}.`);
  return Number(row.stock);
}

/** How many `sales` rows this cashier has — scoped, never a global aggregate (D4). */
export async function countSalesForCashier(cashierId: number): Promise<number> {
  const row = await dbOne<{ n: string }>(
    'SELECT count(*)::text AS n FROM sales WHERE cashier_id = $1',
    [cashierId]
  );
  return Number(row?.n ?? '0');
}

/** The most recent sale this cashier rang up, or undefined. Scoped per worker cashier. */
export async function latestSaleIdForCashier(cashierId: number): Promise<number | undefined> {
  const row = await dbOne<{ id: number }>(
    'SELECT id FROM sales WHERE cashier_id = $1 ORDER BY id DESC LIMIT 1',
    [cashierId]
  );
  return row?.id;
}

export interface ExpectedSale {
  /** From a named case in `contracts/checkout-totals.v1.json` — never hardcoded (D7). */
  amountDueMinor: number;
  paymentMethod: string;
  cashierId: number;
  items: Array<{ productId: number; quantity: number; unitPriceMinor: number }>;
}

/**
 * Asserts the persisted half of a sale: the row, its line items, and the stock it moved.
 *
 * The screen half is asserted by the caller, which owns the locators — keeping this
 * helper free of any dependency on how a particular spec renders its total.
 */
export async function assertPersistedSale(
  request: APIRequestContext,
  token: string,
  saleId: number,
  expected: ExpectedSale
): Promise<PersistedSale> {
  const sale = await fetchSale(request, token, saleId);

  expect(money(sale.total), 'persisted sale total').toBeCloseTo(expected.amountDueMinor / 100, 2);
  expect(sale.payment_method, 'persisted payment method').toBe(expected.paymentMethod);
  expect(sale.cashier_id, 'sale belongs to this worker’s cashier').toBe(expected.cashierId);
  expect(sale.items, 'persisted line items').toHaveLength(expected.items.length);

  for (const item of expected.items) {
    const line = sale.items.find((i) => i.product_id === item.productId);
    expect(line, `line item for product ${item.productId}`).toBeDefined();
    expect(line?.quantity, `quantity for product ${item.productId}`).toBe(item.quantity);
    expect(money(line?.unit_price), `unit price for product ${item.productId}`).toBeCloseTo(
      item.unitPriceMinor / 100,
      2
    );
  }

  return sale;
}

/** Stock moved by exactly the quantity sold — once, not twice, and not at all on failure. */
export async function assertStockDecremented(
  productId: number,
  stockBefore: number,
  soldQuantity: number
): Promise<void> {
  expect(await readStock(productId), 'stock after the sale').toBe(stockBefore - soldQuantity);
}

/**
 * Completes the sale in the open checkout drawer and returns *this sale's* id.
 *
 * Reading "the latest sale for this cashier" on its own is not safe: if the confirm click
 * lands before the drawer has opened, or `handleCheckout` silently returns (it does that
 * for an empty cart and for an unacknowledged recovered cart), no sale is created and the
 * caller happily asserts against the previous test's row. That failure reads as a money
 * bug in whichever spec is unlucky, which is far worse than a timeout.
 *
 * So this pins the count before and after, and refuses to return an id unless exactly one
 * new sale exists.
 */
export async function completeSaleAndReadId(
  page: import('@playwright/test').Page,
  cashierId: number,
  confirm: import('@playwright/test').Locator,
  receipt: import('@playwright/test').Locator
): Promise<number> {
  const before = await countSalesForCashier(cashierId);

  await expect(confirm, 'the confirm control must be actionable before clicking').toBeEnabled();
  // The confirm button is the last child of a scrollable drawer body, so anything that
  // adds height above it — the offline banner, a coupon chip, a loyalty row — can push it
  // out of view. Scroll it in explicitly rather than relying on the click's own attempt.
  await confirm.scrollIntoViewIfNeeded();
  await confirm.click();
  await expect(receipt, 'the receipt confirms the server accepted the sale').toBeVisible();

  await expect
    .poll(() => countSalesForCashier(cashierId), {
      message: 'exactly one new sale should exist for this cashier',
    })
    .toBe(before + 1);

  const saleId = await latestSaleIdForCashier(cashierId);
  if (saleId === undefined) throw new Error('No sale row found after a confirmed checkout.');
  return saleId;
}

/** The seeded Admin's user id and a live token, for the few Admin-gated paths. */
export async function adminUserId(adminApi: APIRequestContext): Promise<number> {
  const response = await adminApi.get('/api/v1/auth/me');
  const body = (await response.json()) as { data: { id: number } };
  return body.data.id;
}
