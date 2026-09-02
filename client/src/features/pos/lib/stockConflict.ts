/**
 * What a rejected checkout means for the cart, worked out from stock rather
 * than from the rejection's wording.
 *
 * The server refuses an oversold line with `Insufficient stock for product ID
 * 7` under a bare VALIDATION_ERROR — the typed `INSUFFICIENT_STOCK` code
 * exists in `server/src/modules/pos/sales/types.ts` but the controller drops
 * it before the response is built. So the client has no reliable code to
 * branch on, and the message is an English sentence naming a database id: not
 * translatable, and not something a cashier can act on.
 *
 * Rather than parse that sentence, this module re-reads the stock for what is
 * in the cart and reports the difference. That says *which product*, *how many
 * were asked for* and *how many are left*, in the cashier's own language, and
 * it keeps working if the server's wording ever changes.
 *
 * ## Variant lines are not checked
 *
 * `GET /api/v1/products/lookup` returns product-level stock only, and variant
 * stock is a separate column decremented by a separate statement
 * (`decrementVariantStock`). There is no bulk endpoint for it, so a variant
 * line is left out entirely rather than compared against a number that is not
 * its own. A checkout that failed purely on a variant line therefore falls
 * back to the plain classified message — which is the behaviour that existed
 * before this module, not a regression.
 */
import type { CartItem } from '../store/cartStore';

export interface StockShortfall {
  productId: number;
  name: string;
  /** Total quantity the cart asks for across every non-variant line. */
  requested: number;
  /** What the server says is left. Zero for a product that has disappeared. */
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
      shortfalls.push({ productId, name, requested: quantity, available: Math.max(0, available) });
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

export function planCartAdjustment(
  items: readonly CartItem[],
  shortfalls: readonly StockShortfall[]
): LineAdjustment[] {
  const remaining = new Map(shortfalls.map((s) => [s.productId, s.available]));
  const adjustments: LineAdjustment[] = [];

  for (const item of items) {
    if (item.variant_id) continue;
    const left = remaining.get(item.product_id);
    if (left === undefined) continue;
    const quantity = Math.min(item.quantity, left);
    remaining.set(item.product_id, left - quantity);
    if (quantity !== item.quantity) {
      adjustments.push({
        productId: item.product_id,
        variantId: item.variant_id ?? null,
        quantity,
      });
    }
  }

  return adjustments;
}
