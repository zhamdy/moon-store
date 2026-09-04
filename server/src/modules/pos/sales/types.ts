export interface SaleItemInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price?: number;
  memo?: string | null;
  /**
   * Identity of a server-known bundle definition this line belongs to.
   * When set, the server validates the bundle definition/allocation and
   * NEVER trusts `unit_price` for this line — see Unit 2's "Bundle
   * allocation" handling in `service.ts`. Absent for ordinary catalog lines,
   * which are always priced from the catalog/variant, never from the client.
   */
  bundle_id?: number | null;
}

export interface PaymentInput {
  method: string;
  amount: number;
}

export interface CreateSaleDTO {
  items: SaleItemInput[];
  discount?: number;
  discount_type?: 'fixed' | 'percentage';
  payment_method: string;
  payments?: PaymentInput[];
  customer_id?: number | null;
  points_redeemed?: number;
  notes?: string | null;
  tip?: number;
  coupon_code?: string | null;
}

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  taxAmount: number;
  pointsDiscount: number;
  couponId: number | null;
  couponDiscount: number;
  tipAmount: number;
  total: number;
}

export interface TaxSettings {
  enabled: boolean;
  rate: number;
  mode: string;
}

// ─── Checkout financial contract (Unit 1) ──────────────────────────────────
//
// See docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md,
// "Canonical Calculation Contract" and `contracts/checkout-totals.v1.json`.
//
// `SaleCalculationBreakdown` is the explicit, typed shape of every checkout
// calculation input/output. Field order follows the canonical calculation
// order (subtotal -> manual discount -> coupon -> loyalty -> tax -> tip ->
// amount due -> earned points) so downstream units (the authoritative server
// calculator in Unit 2, the client projection in Unit 3) share one
// vocabulary. All monetary fields are integer MINOR units (piasters; 1 EGP =
// 100). Convert database NUMERIC and HTTP decimal values to/from minor units
// only at the boundary — never carry floats through a calculation.
//
// This type is not yet produced or consumed anywhere: Unit 1 only fixes its
// shape. `SalesService` continues to use the existing major-unit `SaleTotals`
// until Unit 2 replaces it.

export type TaxMode = 'inclusive' | 'exclusive';

export interface SaleCalculationBreakdown {
  /** Schema version for this breakdown shape. Bump on any incompatible field change. */
  contractVersion: 1;

  /** Sum of resolved catalog/variant/bundle line prices x quantity. */
  subtotalMinor: number;

  /** Manual (cashier-entered) discount. Capped at `subtotalMinor`. */
  manualDiscountMinor: number;

  /** Identity of the coupon applied, if any. */
  couponId: number | null;
  /** Coupon discount. Validated and capped against the post-manual-discount amount. */
  couponDiscountMinor: number;

  /** Loyalty points the customer redeemed on this sale. */
  pointsRedeemed: number;
  /** Currency value of `pointsRedeemed`: pointsRedeemed * egpPerPoint, in minor units. */
  pointsDiscountMinor: number;

  /** Clamped at zero: subtotal - manualDiscount - couponDiscount - pointsDiscount. */
  taxableBaseMinor: number;
  taxMode: TaxMode;
  /** Percentage rate, e.g. 14 for 14%. */
  taxRatePercent: number;
  /** Exclusive: added on top of the taxable base. Inclusive: extracted from it. */
  taxAmountMinor: number;

  /** Non-negative. Added after tax; never discounted or taxed. */
  tipMinor: number;

  /**
   * Final confirmed amount due. Inclusive: `taxableBaseMinor + tipMinor`.
   * Exclusive: `taxableBaseMinor + taxAmountMinor + tipMinor`. Clamped at
   * zero and rounded to the nearest minor unit.
   */
  amountDueMinor: number;

  /**
   * Whole points earned from `amountDueMinor`, using the configured
   * points-per-EGP rate: `floor(amountDueMinor / 100 * pointsPerEgp)`.
   * Compatibility rule — computed after redemption and from the final
   * amount due (including tax and tip), matching current server semantics.
   */
  earnedPoints: number;
}

// ─── Pure calculation input (Unit 2) ───────────────────────────────────────
//
// Shape consumed by the pure, DB-free `calculateSaleBreakdown` function in
// `service.ts`. Mirrors `contracts/checkout-totals.v1.json` cases exactly so
// both the fixture and production callers (server catalog/coupon/loyalty/tax
// resolution) drive the identical calculation. All monetary fields are
// integer MINOR units; convert at the DB/HTTP boundary with `toMinorUnits`/
// `fromMinorUnits` below.

export const MINOR_UNITS_PER_MAJOR_UNIT = 100;

/** Convert a decimal EGP amount (e.g. a NUMERIC column or HTTP number) to integer minor units. */
export function toMinorUnits(amountMajor: number): number {
  return Math.round((amountMajor || 0) * MINOR_UNITS_PER_MAJOR_UNIT);
}

/** Convert integer minor units back to a decimal EGP amount for persistence/response. */
export function fromMinorUnits(amountMinor: number): number {
  return amountMinor / MINOR_UNITS_PER_MAJOR_UNIT;
}

export interface SaleCalculationLineInput {
  unitPriceMinor: number;
  quantity: number;
}

export type ManualDiscountType = 'fixed' | 'percentage';

export interface ManualDiscountInput {
  type: ManualDiscountType;
  /** Required when `type === 'fixed'`. */
  valueMinor?: number;
  /** Required when `type === 'percentage'`, e.g. 15 for 15%. */
  valuePercent?: number;
}

export interface LoyaltyCalculationInput {
  enabled: boolean;
  /** Points earned per 1 EGP of confirmed amount due. */
  pointsPerEgp: number;
  /** Minor units (piasters) redeemed per 1 point spent. */
  egpPerPointMinor: number;
  /** Points the customer is requesting to redeem on this sale. */
  pointsRedeemed: number;
  /** The customer's current point balance, if known. Uncapped when omitted. */
  pointsBalance?: number;
}

export interface TaxCalculationInput {
  enabled: boolean;
  /** Percentage rate, e.g. 14 for 14%. */
  ratePercent: number;
  mode: TaxMode;
}

export interface SaleCalculationInput {
  items: SaleCalculationLineInput[];
  manualDiscount: ManualDiscountInput;
  /** Identity of an already-validated coupon, or null when none is applied. */
  couponId: number | null;
  /** Coupon discount already resolved (e.g. via canonical coupon validation), pre-cap. */
  couponDiscountMinor: number;
  loyalty: LoyaltyCalculationInput;
  tax: TaxCalculationInput;
  tipMinor: number;
}

/** Immutable calculation snapshot as persisted by migration 003, in EGP major units. */
export interface SaleCalculationSnapshot {
  contractVersion: string;
  subtotal: number;
  manualDiscount: number;
  couponId: number | null;
  couponDiscount: number;
  pointsRedeemed: number;
  pointsDiscount: number;
  taxableBase: number;
  taxMode: TaxMode;
  taxRatePercent: number;
  taxAmount: number;
  tipAmount: number;
  amountDue: number;
  earnedPoints: number;
}

/** Row shape for `ISalesRepository.createSaleCalculation` -- the persisted (snake_case, DB-column) mirror of `SaleCalculationSnapshot` plus the owning `sale_id`. */
export interface CreateSaleCalculationInput {
  sale_id: number;
  contract_version: string;
  subtotal: number;
  manual_discount: number;
  coupon_id: number | null;
  coupon_discount: number;
  points_redeemed: number;
  points_discount: number;
  taxable_base: number;
  tax_mode: string;
  tax_rate_percent: number;
  tax_amount: number;
  tip_amount: number;
  amount_due: number;
  earned_points: number;
}

// ─── Split-payment integrity (Unit 4) ──────────────────────────────────────
//
// See docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md,
// Unit 4. `SalesService.executeSale` sums the request's `payments` entries
// (converted via `toMinorUnits`) and compares them, with EXACT integer
// minor-unit equality (no float tolerance), against `SaleCalculationBreakdown
// .amountDueMinor` -- the same equality rule the client's `allocateSplit`
// (client/src/shared/lib/checkout.ts, Unit 3) already enforces.
//
// Documented policy (R5/R9):
// - Supported payment methods: 'Cash' | 'Card' | 'Other' | 'Gift Card'
//   (server/validators/saleSchema.ts `paymentEntrySchema`).
// - Duplicate methods ARE allowed (e.g. two 'Cash' entries): nothing about
//   persisted integrity depends on method uniqueness, only on the exact
//   minor-unit sum; register cash movement sums every 'Cash' entry.
// - Entry count is capped (`saleSchema.ts` `MAX_PAYMENT_ENTRIES`) and each
//   entry's amount must be finite, non-negative, at most two decimal places,
//   and under `MAX_PAYMENT_AMOUNT_MAJOR` -- deterministic Zod boundary
//   rejections, not service-level validation failures.
// - A `payments` array, when present (even with exactly one entry), is the
//   sole source of truth for split tender; `payment_method` is never
//   cross-checked against it. This is the resolution to "ambiguous mixed
//   single/split representation": there is no ambiguity because `payments`
//   always wins when present. An empty `payments` array is rejected as
//   ambiguous (is this a 0-entry split, or was `payments` meant to be
//   omitted?) by both the Zod `.min(1)` boundary and this module's runtime
//   check (for callers that bypass the HTTP schema, e.g. tests calling
//   `SalesService.executeSale` directly).
// - Zero-due sales (e.g. fully comped by discount/coupon/loyalty): omitting
//   `payments` entirely continues to work (no `sale_payments` rows, matching
//   existing non-split compatibility behavior). If `payments` IS provided,
//   its entries must sum to exactly 0 -- e.g. a single `{ method: 'Cash',
//   amount: 0 }` entry -- which the schema allows via `nonnegative()`.
// - Ordinary single-tender checkout (no `payments` array) is UNCHANGED by
//   this unit: it persists no `sale_payments` rows and is never subject to
//   the equality check. It continues to represent the sale amount, not a
//   cash-tendered/change pair.

/** Stable, documented validation error code the client can match on (Unit 5). */
export const SPLIT_PAYMENT_MISMATCH_CODE = 'SPLIT_PAYMENT_MISMATCH';

/**
 * Compatibility gate for strict split-payment enforcement (see block comment
 * above). Defaults to `true` because Units 5 (checkout UI) and 6 (cart/
 * receipt/queue compatibility) land in this same branch/PR -- there is no
 * window where an old, unmigrated client can reach this server with this
 * flag on. If a rollback is ever needed (e.g. Units 5/6 have to be reverted
 * independently, or a since-deployed client still submits mismatched
 * splits), set this constant back to `false` and redeploy the server; no
 * database migration is required either way. Never gate this per-request or
 * via a runtime env var -- a single reviewable code constant is the
 * intentional kill switch.
 */
export const STRICT_SPLIT_PAYMENT_VALIDATION = true;

/** Thrown by `SalesService` for a stable, client-matchable financial validation failure (e.g. split-payment mismatch). */
export class SalesValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'SalesValidationError';
  }
}

/** One line that could not be taken out of stock, and the numbers behind the refusal. */
export interface StockConflict {
  productId: number;
  variantId: number | null;
  requested: number;
  /**
   * What the caller could actually have had. On the write path this is the row's stock
   * with this (doomed) transaction's own writes added back — it is about to roll back, so
   * the mid-transaction figure would be a number that stops being true immediately.
   * Zero when the row is gone: for a cashier, "not enough" and "gone" mean the same thing.
   */
  available: number;
}

/** Stable, documented code for a checkout rejected because stock ran out. */
export const INSUFFICIENT_STOCK_CODE = 'INSUFFICIENT_STOCK';

/**
 * Thrown when a line cannot be taken out of stock — either the fail-fast check saw too
 * little, or the guarded decrement matched no row because it was gone by the time the
 * write ran. Typed rather than string-matched so the controller's message list stops
 * growing, while the client-facing wording stays exactly as it was.
 *
 * Carries every line it can speak for, not just the first. The pre-check knows all of
 * them, and a cashier told about one oversold line at a time would fix, resubmit, and be
 * refused again. The guarded decrement can only ever report the one line it was refusing,
 * so a conflict list of one is normal.
 *
 * `requested` and `available` are what the client needs to say which line is wrong and by
 * how much. They are carried here rather than left for the client to rediscover with a
 * second round-trip: this is the one moment where the true numbers are known.
 */
export class InsufficientStockError extends Error {
  constructor(
    message: string,
    public readonly conflicts: readonly StockConflict[],
    public readonly code: string = INSUFFICIENT_STOCK_CODE,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

/** A payment entry as persisted to `sale_payments` / returned in the confirmed sale response. Major EGP units, exactly as validated -- never coerced/rounded into balance. */
export interface ConfirmedPayment {
  method: string;
  amount: number;
}

export interface RefundItemInput {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface CreateRefundDTO {
  items: RefundItemInput[];
  reason: string;
  restock: boolean;
}

export interface SaleFilters {
  page: number;
  pageSize: number;
  search?: string;
  paymentMethod?: string;
  cashierId?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'total';
  sortOrder: 'asc' | 'desc';
}

const positiveInteger = (name: string) =>
  z
    .string()
    .regex(/^\d+$/, `${name} must be an integer`)
    .transform(Number)
    .pipe(z.number().int().positive());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

const saleListQuerySchema = z
  .object({
    page: positiveInteger('page').default('1'),
    pageSize: z.enum(['10', '25', '50', '100']).default('25').transform(Number),
    search: z.string().trim().min(1).max(100).optional(),
    paymentMethod: z.string().trim().min(1).max(40).optional(),
    cashierId: positiveInteger('cashierId').optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    sortBy: z.enum(['createdAt', 'total']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: 'dateFrom must not be after dateTo',
  });

export function parseSaleListQuery(query: unknown): SaleFilters {
  return saleListQuerySchema.parse(query);
}
import { z } from 'zod';
