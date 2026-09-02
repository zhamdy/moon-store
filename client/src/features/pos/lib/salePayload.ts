/**
 * Composing the body POST /api/v1/sales receives, and the reduced body the
 * offline queue stores when that POST cannot go out.
 *
 * Both were inline object literals in CartPanel; extracted (issue #51) so the
 * composition rules — which fields are omitted rather than sent as null, how a
 * split tender overrides the single payment method, which fields the offline
 * body deliberately drops — are testable without rendering the POS screen.
 *
 * Two rules that look incidental but are not, and must survive any edit here:
 *
 * 1. **Absent, never null.** Every optional field is spread in conditionally.
 *    The server distinguishes "no customer" from `customer_id: null`.
 * 2. **Key order is stable.** The idempotency key is derived from
 *    `JSON.stringify(saleData)` (see CartPanel's `idempotencyKeyFor`), and a
 *    persisted mid-checkout attempt is matched by that exact string. Reordering
 *    the keys would make a till that reloads mid-checkout mint a fresh key and
 *    ring the same sale up twice.
 */
import type { CartItem, DiscountType } from '../store/cartStore';
import type { PaymentEntry, PaymentMethod, SaleData } from '../types';

export interface SaleComposition {
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  notes: string;
  tip: number;
  couponCode: string;
  paymentMethod: PaymentMethod;
  splitPayment: boolean;
  payments: PaymentEntry[];
  /** The selected customer's id, or null/undefined for a walk-in. */
  customerId?: number | null;
  /** Points the cashier is actually spending — already gated by the redeem toggle. */
  pointsToRedeem: number;
}

/** The full checkout body: everything the cashier configured in the drawer. */
export function buildSalePayload(composition: SaleComposition): SaleData {
  const {
    items,
    discount,
    discountType,
    notes,
    tip,
    couponCode,
    paymentMethod,
    splitPayment,
    payments,
    customerId,
    pointsToRedeem,
  } = composition;

  return {
    items: items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      ...(i.variant_id ? { variant_id: i.variant_id } : {}),
      ...(i.memo ? { memo: i.memo } : {}),
    })),
    discount,
    discount_type: discountType,
    // A split tender still needs a single `payment_method` column on the sale
    // row; the per-tender breakdown travels in `payments`.
    payment_method: splitPayment ? 'Cash' : paymentMethod,
    ...(splitPayment && payments.length > 0 ? { payments } : {}),
    ...(customerId ? { customer_id: customerId } : {}),
    ...(pointsToRedeem > 0 ? { points_redeemed: pointsToRedeem } : {}),
    ...(notes ? { notes } : {}),
    ...(tip > 0 ? { tip } : {}),
    ...(couponCode ? { coupon_code: couponCode } : {}),
  };
}

/**
 * The reduced body the offline queue stores. Deliberately narrower than the
 * full checkout body — no notes, tip, coupon, split tenders or loyalty
 * redemption — and unchanged by this extraction. Its narrowness is
 * characterized by CartPanel.test.tsx; widening it is a server-contract
 * decision, not a refactor.
 */
export function buildOfflineSalePayload(composition: SaleComposition): SaleData {
  const { items, discount, discountType, paymentMethod, customerId } = composition;

  return {
    items: items.map((i) => ({
      product_id: i.product_id,
      ...(i.variant_id ? { variant_id: i.variant_id } : {}),
      quantity: i.quantity,
      unit_price: i.unit_price,
    })),
    discount,
    discount_type: discountType,
    payment_method: paymentMethod,
    ...(customerId ? { customer_id: customerId } : {}),
  };
}
