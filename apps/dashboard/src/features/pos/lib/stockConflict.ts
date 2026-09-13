/**
 * What a rejected checkout means for the cart.
 *
 * The server now names it outright: a checkout refused on stock comes back with
 * one `INSUFFICIENT_STOCK` detail per oversold line, carrying the product, the
 * variant, how many were asked for and how many are really left
 * (`server/src/modules/pos/stockConflict.ts`). `shortfallsFromDetails` reads
 * that directly — no round-trip, and correct for variant lines, whose stock the
 * client cannot look up at all.
 *
 * The stock re-read below is the fallback for a rejection that carries no such
 * detail: a coupon, loyalty or bundle failure, where the cart may still be the
 * real reason. It compares the cart against fresh stock and reports the
 * difference. That path is why `findStockShortfalls` still exists.
 *
 * ## Variant lines and the fallback
 *
 * `GET /api/v1/products/lookup` returns product-level stock only, and variant
 * stock is a separate column decremented by a separate statement. So the
 * fallback still leaves variant lines out rather than comparing them against a
 * number that is not their own. Only the typed detail can speak for them, and
 * now it does.
 */
import type { CartItem } from '../store/cartStore';
import type { ValidationDetail } from '../../../shared/lib/transport/types';
import { INSUFFICIENT_STOCK_CODE } from '../../../shared/lib/mutationError';

export interface StockShortfall {
  productId: number;
  /** Null for a product-level line; set when it is one specific variant that is short. */
  variantId: number | null;
  name: string;
  /** How many the cart asks for. */
  requested: number;
  /** What the server says is left. Zero for a line that can no longer be sold at all. */
  available: number;
}

/** Lines this module can speak for: product-level, with a usable id. */
function checkableLines(items: readonly CartItem[]): CartItem[] {
  return items.filter((item) => !item.variant_id && Number.isSafeInteger(item.product_id));
}

/** The product ids to re-read. Empty when the cart is all variant lines. */
export function checkableProductIds(items: readonly CartItem[]): number[] {
  return [...new Set(checkableLines(items).map((item) => item.product_id))];
}

/**
 * Compares the cart against freshly-read stock.
 *
 * A product absent from `freshStock` is treated as zero available: for a
 * cashier, `products/lookup` hides anything not `active`, so a product that
 * vanished between add and checkout is one they can no longer sell — which is
 * exactly what the notice should say.
 */
export function findStockShortfalls(
  items: readonly CartItem[],
  freshStock: ReadonlyMap<number, number>
): StockShortfall[] {
  const requested = new Map<number, { name: string; quantity: number }>();
  for (const item of checkableLines(items)) {
    const entry = requested.get(item.product_id);
    // Quantities are summed per product: the same product can sit on more than
    // one line (different memos), and each line alone may look affordable
    // while together they are not.
    if (entry) entry.quantity += item.quantity;
    else requested.set(item.product_id, { name: item.name, quantity: item.quantity });
  }

  const shortfalls: StockShortfall[] = [];
  for (const [productId, { name, quantity }] of requested) {
    const available = freshStock.get(productId) ?? 0;
    if (quantity > available) {
      shortfalls.push({
        productId,
        variantId: null,
        name,
        requested: quantity,
        available: Math.max(0, available),
      });
    }
  }
  return shortfalls;
}

/**
 * How to change the cart so it can be sold: the new quantity for each line of
 * an oversold product, zero meaning "remove this line".
 *
 * Available stock is spread across that product's lines in cart order, so a
 * cashier with two lines of the same shirt and one left in stock keeps the
 * first line rather than losing both.
 */
export interface LineAdjustment {
  productId: number;
  variantId: number | null;
  quantity: number;
}

/** A shortfall and a cart line address the same stock only if both halves match. */
function lineKey(productId: number, variantId: number | null): string {
  return variantId ? `v:${variantId}` : `p:${productId}`;
}

export function planCartAdjustment(
  items: readonly CartItem[],
  shortfalls: readonly StockShortfall[]
): LineAdjustment[] {
  const remaining = new Map(
    shortfalls.map((s) => [lineKey(s.productId, s.variantId), s.available])
  );
  const adjustments: LineAdjustment[] = [];

  for (const item of items) {
    const variantId = item.variant_id ?? null;
    const key = lineKey(item.product_id, variantId);
    const left = remaining.get(key);
    // A line the shortfalls do not name is one the server did not refuse: leave it alone.
    if (left === undefined) continue;
    const quantity = Math.min(item.quantity, left);
    remaining.set(key, left - quantity);
    if (quantity !== item.quantity) {
      adjustments.push({ productId: item.product_id, variantId, quantity });
    }
  }

  return adjustments;
}

/**
 * The shortfalls a rejection stated outright, or an empty list when it stated none.
 *
 * The cart supplies only the product name — the server sends ids, and a cashier needs
 * to be told which garment, not which row. A detail naming a line no longer in the cart
 * is dropped rather than shown nameless: the cart has moved on and adjusting it against
 * that line would mean nothing.
 */
export function shortfallsFromDetails(
  details: readonly ValidationDetail[],
  items: readonly CartItem[]
): StockShortfall[] {
  const names = new Map(
    items.map((item) => [lineKey(item.product_id, item.variant_id ?? null), item.name])
  );
  const shortfalls: StockShortfall[] = [];

  for (const detail of details) {
    if (detail.code !== INSUFFICIENT_STOCK_CODE) continue;
    const productId = asCount(detail.meta?.productId);
    const requested = asCount(detail.meta?.requested);
    const available = asCount(detail.meta?.available);
    if (productId === null || requested === null || available === null) continue;

    const rawVariant = detail.meta?.variantId;
    const variantId = typeof rawVariant === 'number' && rawVariant > 0 ? rawVariant : null;

    const name = names.get(lineKey(productId, variantId));
    if (name === undefined) continue;

    shortfalls.push({ productId, variantId, name, requested, available });
  }

  return shortfalls;
}

/** Guards against a malformed `meta`: a number the client can count with, or nothing. */
function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
