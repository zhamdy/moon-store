// Types owned by the pos slice. Cross-slice contracts (Product, Category,
// ProductVariant, ...) live in `shared/types` instead.

/** Register session from GET /api/v1/register/current and /history */
export interface RegisterSession {
  id: number;
  cashier_id: number;
  cashier_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  expected_cash: number;
  counted_cash: number | null;
  variance: number | null;
  status: 'open' | 'closed';
  notes: string | null;
  sale_count?: number;
  total_in?: number;
  total_out?: number;
  total_sales?: number;
}

/** One cash movement inside a register session */
export interface RegisterMovement {
  id: number;
  session_id: number;
  type: 'sale' | 'refund' | 'cash_in' | 'cash_out';
  amount: number;
  sale_id: number | null;
  note: string | null;
  created_at: string;
}

/** GET /api/v1/register/:id/report */
export interface RegisterReportData {
  session: RegisterSession;
  movements: RegisterMovement[];
  summary: {
    total_sales: number;
    total_refunds: number;
    total_cash_in: number;
    total_cash_out: number;
    sale_count: number;
    refund_count: number;
  };
}

/** Shift from GET /api/v1/shifts/current and paginated GET /api/v1/shifts */
export interface Shift {
  id: number;
  user_id: number;
  user_name: string;
  role?: string;
  clock_in: string;
  clock_out: string | null;
  status: 'active' | 'on_break' | 'completed';
  total_hours: number | null;
  break_minutes: number;
}

// --- Checkout wire types -------------------------------------------------
// The shapes POST /api/v1/sales takes and gives back. Lifted verbatim out of
// CartPanel.tsx when checkout composition was extracted (issue #51) so the
// payload/receipt builders and the component can share one definition.

export type PaymentMethod = 'Cash' | 'Card' | 'Other';

/** Write payload for POST /api/v1/sales — not the read shape returned by GET /api/sales/:id */
export interface SaleItemInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price: number;
  memo?: string | null;
}

export interface PaymentEntry {
  method: PaymentMethod | 'Gift Card';
  amount: number;
}

export interface SaleData {
  items: SaleItemInput[];
  discount: number;
  discount_type: string;
  payment_method: PaymentMethod;
  payments?: PaymentEntry[];
  customer_id?: number;
  tax_amount?: number;
  points_redeemed?: number;
  notes?: string;
  tip?: number;
  coupon_code?: string;
}

/** One checkout attempt: the composed body plus the key that dedupes its retries. */
export interface CheckoutAttempt {
  saleData: SaleData;
  idempotencyKey: string;
}

/**
 * A resolved sale line as the server actually persisted it (Unit 4's
 * `resolvedItems` -- authoritative product/variant identity, quantity and
 * price; no product name, which is why the receipt looks names up against
 * the cart the cashier just rang up, display-only, never for a monetary
 * figure).
 */
export interface ConfirmedSaleItem {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price: number;
  memo?: string | null;
}

/**
 * A validated payment entry exactly as persisted (`ConfirmedPayment` in
 * server/src/modules/pos/sales/types.ts).
 */
export interface ConfirmedSalePayment {
  method: string;
  amount: number;
}

/**
 * Mirrors the server's immutable `SaleCalculationSnapshot` (Units 2/4) --
 * see client/src/shared/components/Receipt.tsx's `ReceiptCalculation`, which
 * this is mapped into 1:1. Every figure is the CONFIRMED, persisted amount
 * for this sale; the receipt renders these directly rather than the client's
 * own (possibly stale-by-then) preview.
 */
export interface ConfirmedSaleCalculation {
  subtotal: number;
  manualDiscount: number;
  couponDiscount: number;
  pointsDiscount: number;
  taxAmount: number;
  taxMode: 'inclusive' | 'exclusive';
  taxRatePercent: number;
  tipAmount: number;
  amountDue: number;
}

/** What POST /api/v1/sales hands back, as far as the receipt needs it. */
export interface SaleResponse {
  id: number;
  discount?: number;
  discount_type?: string;
  total: number;
  payment_method: string;
  cashier_name?: string;
  created_at: string;
  /** Additive since Unit 4 -- present on every response from this branch's server. */
  calculation?: ConfirmedSaleCalculation;
  items?: ConfirmedSaleItem[];
  payments?: ConfirmedSalePayment[];
}

/** What POST /api/v1/coupons/validate hands back, as far as the cart needs it. */
export interface CouponValidation {
  code: string;
  discount: number;
}
