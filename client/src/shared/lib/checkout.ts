/**
 * What a sale is worth, decided in one place.
 *
 * The cart panel used to compute the total three incompatible ways: the footer
 * headline added tax but ignored points and tip, the checkout sheet subtracted
 * both, and the split-payment allocation used neither — so with tax enabled a
 * cashier was asked to balance payments against a figure that was not what the
 * customer owed. Everything below is pure, so it can be exercised without
 * rendering anything.
 *
 * This module mirrors the authoritative server calculation
 * (`server/src/modules/pos/sales/service.ts`'s `calculateSaleBreakdown`) so a
 * cashier's live preview matches the confirmed checkout result. Both share the
 * same canonical calculation order and units — see
 * `contracts/checkout-totals.v1.json` and
 * `docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md` ("Canonical
 * Calculation Contract"). Arithmetic runs internally on integer minor units
 * (piasters; 1 EGP = 100) — JavaScript float rounding is not a stable
 * financial contract — and only converts to/from major-unit EGP numbers at the
 * public input/output boundary of this module.
 *
 * Canonical order: subtotal -> manual discount -> coupon discount -> loyalty
 * redemption -> taxable base -> tax -> tip -> amount due -> earned points.
 * Tip is always ADDED after tax and is never discounted or taxed. Loyalty
 * redemption reduces the taxable base (applied BEFORE tax, not after).
 * Loyalty units are direct: `redeemValue` is the EGP value redeemed per ONE
 * point (matching the server's canonical `loyalty_egp_per_point`), never a
 * "per 100 points" reciprocal figure.
 */

export type DiscountType = 'fixed' | 'percentage';
export type TaxMode = 'inclusive' | 'exclusive';

export interface Priced {
  unit_price: number;
  quantity: number;
}

export interface TaxSettings {
  enabled: boolean;
  rate: number;
  mode: TaxMode;
}

export interface TotalsInput {
  items: Priced[];
  discount: number;
  discountType: DiscountType;
  /** Already resolved to a currency amount by the coupon endpoint. */
  couponDiscount: number;
  tax: TaxSettings;
  /** Loyalty points the customer is spending on this sale. */
  pointsToRedeem: number;
  /** EGP value redeemed per ONE point (direct units — see module doc). */
  redeemValue: number;
  /**
   * The customer's current point balance. When provided, redemption is
   * capped at this balance in addition to the remaining monetary value of
   * the sale. Omit when the balance is unknown/uncapped by this caller.
   */
  pointsBalance?: number;
  tip: number;
  /**
   * Whether the loyalty program is active for this sale. Gates BOTH
   * redemption and earning, matching the server's single `loyalty.enabled`
   * flag. Defaults to `true` so existing callers that already zero
   * `pointsToRedeem` themselves when loyalty is off keep working unchanged.
   */
  loyaltyEnabled?: boolean;
  /** Points earned per 1 EGP of the final amount due. Defaults to 0 (no earning modeled). */
  pointsPerEgp?: number;
}

export interface Totals {
  subtotal: number;
  discountAmount: number;
  couponDiscount: number;
  /**
   * Subtotal net of manual discount, coupon discount, AND loyalty
   * redemption — i.e. the taxable base. Loyalty is applied before tax in the
   * canonical order, so this is no longer "before loyalty" as it once was.
   */
  netOfDiscounts: number;
  taxAmount: number;
  /** Taxable base plus tax (exclusive) or the taxable base itself (inclusive). Excludes tip. */
  totalWithTax: number;
  pointsDiscount: number;
  tip: number;
  /** The one figure the customer actually owes: taxed amount plus tip. */
  amountDue: number;
  /** Whole points earned from `amountDue`, gated by `loyaltyEnabled` and `pointsPerEgp`. */
  earnedPoints: number;
}

const MINOR_UNITS_PER_MAJOR_UNIT = 100;

/**
 * Convert a decimal EGP amount to integer minor units (piasters), rounding to
 * the nearest whole minor unit with ties away from zero — the same rule and
 * `Math.round` semantics the server's `toMinorUnits` uses.
 */
export function toMinorUnits(amountMajor: number): number {
  return Math.round((amountMajor || 0) * MINOR_UNITS_PER_MAJOR_UNIT);
}

/** Convert integer minor units back to a decimal EGP amount. */
export function fromMinorUnits(amountMinor: number): number {
  return amountMinor / MINOR_UNITS_PER_MAJOR_UNIT;
}

/**
 * Manual discount, applied to a subtotal already in integer minor units.
 * Mirrors `computeManualDiscountMinor` in `server/src/modules/pos/sales/service.ts`
 * exactly: a percentage is clamped to [0, 100] and rounded; a fixed amount is
 * clamped to non-negative; either way the result never exceeds the subtotal.
 */
function computeManualDiscountMinor(
  subtotalMinor: number,
  discount: number,
  discountType: DiscountType
): number {
  let amount: number;
  if (discountType === 'percentage') {
    const percent = Math.min(Math.max(discount || 0, 0), 100);
    amount = Math.round((subtotalMinor * percent) / 100);
  } else {
    amount = Math.max(0, toMinorUnits(discount || 0));
  }
  return Math.min(amount, subtotalMinor);
}

export function calculateTotals(input: TotalsInput): Totals {
  const {
    items,
    discount,
    discountType,
    couponDiscount,
    tax,
    pointsToRedeem,
    redeemValue,
    pointsBalance,
    tip,
    loyaltyEnabled = true,
    pointsPerEgp = 0,
  } = input;

  const subtotalMinor = items.reduce((sum, i) => sum + toMinorUnits(i.unit_price) * i.quantity, 0);

  const manualDiscountMinor = computeManualDiscountMinor(subtotalMinor, discount, discountType);
  const remainingAfterManual = subtotalMinor - manualDiscountMinor;

  const couponDiscountMinor = Math.min(
    Math.max(toMinorUnits(couponDiscount || 0), 0),
    remainingAfterManual
  );
  const remainingAfterCoupon = remainingAfterManual - couponDiscountMinor;

  // Loyalty redemption — applied BEFORE tax, in direct EGP-per-point units,
  // capped by both the customer's point balance and the remaining monetary
  // value of the sale. Never produces a negative discount or over-redemption.
  let pointsDiscountMinor = 0;
  if (loyaltyEnabled) {
    const egpPerPointMinor = Math.max(0, toMinorUnits(redeemValue || 0));
    if (egpPerPointMinor > 0) {
      const balanceCap = pointsBalance ?? Number.POSITIVE_INFINITY;
      const requested = Math.max(0, Math.floor(pointsToRedeem || 0));

      let candidatePoints = Math.min(requested, balanceCap);
      let candidateDiscount = candidatePoints * egpPerPointMinor;

      if (candidateDiscount > remainingAfterCoupon) {
        candidatePoints = Math.floor(remainingAfterCoupon / egpPerPointMinor);
        candidateDiscount = candidatePoints * egpPerPointMinor;
      }

      pointsDiscountMinor = candidateDiscount;
    }
  }

  const taxableBaseMinor = Math.max(
    0,
    subtotalMinor - manualDiscountMinor - couponDiscountMinor - pointsDiscountMinor
  );

  let taxAmountMinor = 0;
  if (tax.enabled && tax.rate > 0) {
    if (tax.mode === 'exclusive') {
      taxAmountMinor = Math.round((taxableBaseMinor * tax.rate) / 100);
    } else {
      // Inclusive: the tax is already inside the price, so only name it.
      taxAmountMinor = Math.round(taxableBaseMinor - taxableBaseMinor / (1 + tax.rate / 100));
    }
  }

  const totalWithTaxMinor =
    tax.mode === 'exclusive' ? taxableBaseMinor + taxAmountMinor : taxableBaseMinor;

  // Tip is clamped non-negative and ADDED after tax — it is never subtracted,
  // discounted, or taxed. This is the fix for the historical tip-sign bug.
  const tipMinor = Math.max(0, Math.round(toMinorUnits(tip || 0)));

  const amountDueMinor = Math.max(0, Math.round(totalWithTaxMinor + tipMinor));

  // Gated by `loyaltyEnabled` (not just a zero rate): a disabled loyalty
  // program must never award points even if a stale/default rate lingers.
  // Computed AFTER redemption, from the final amount due (including tax and
  // tip) — the same compatibility formula the server uses.
  const earnedPoints = loyaltyEnabled
    ? Math.floor((amountDueMinor / MINOR_UNITS_PER_MAJOR_UNIT) * (pointsPerEgp || 0))
    : 0;

  return {
    subtotal: fromMinorUnits(subtotalMinor),
    discountAmount: fromMinorUnits(manualDiscountMinor),
    couponDiscount: fromMinorUnits(couponDiscountMinor),
    netOfDiscounts: fromMinorUnits(taxableBaseMinor),
    taxAmount: fromMinorUnits(taxAmountMinor),
    totalWithTax: fromMinorUnits(totalWithTaxMinor),
    pointsDiscount: fromMinorUnits(pointsDiscountMinor),
    tip: fromMinorUnits(tipMinor),
    amountDue: fromMinorUnits(amountDueMinor),
    earnedPoints,
  };
}

/**
 * How many points a sale earns, given the rate per 1 EGP spent (direct
 * units, matching the server's canonical `loyalty_points_per_egp` — never a
 * "per 100 spent" reciprocal figure).
 */
export function pointsEarned(amountDue: number, pointsPerEgp: number): number {
  if (pointsPerEgp <= 0 || amountDue <= 0) return 0;
  const amountDueMajor = toMinorUnits(amountDue) / MINOR_UNITS_PER_MAJOR_UNIT;
  return Math.floor(amountDueMajor * pointsPerEgp);
}

/**
 * The most a customer may spend on this sale: never more points than they
 * hold, and never more value than the sale is worth. `redeemValue` is the
 * direct EGP value redeemed per ONE point.
 */
export function maxRedeemablePoints(
  heldPoints: number,
  amountDue: number,
  redeemValue: number
): number {
  if (heldPoints <= 0 || redeemValue <= 0 || amountDue <= 0) return 0;
  const amountDueMinor = toMinorUnits(amountDue);
  const egpPerPointMinor = toMinorUnits(redeemValue);
  if (egpPerPointMinor <= 0) return 0;
  const pointsCoveringSale = Math.floor(amountDueMinor / egpPerPointMinor);
  return Math.min(heldPoints, pointsCoveringSale);
}

export interface Allocation {
  allocated: number;
  remaining: number;
  /** Payments cover the amount due EXACTLY, in integer minor units — no tolerance. */
  isBalanced: boolean;
  /** More was allocated than the sale is worth. */
  isOverpaid: boolean;
}

/**
 * Split-tender allocation, checked in integer minor units with the same
 * exact-equality rule the server enforces for payment validation — no
 * sub-cent tolerance window, since summing already-rounded minor units never
 * accumulates float drift the way summing major-unit decimals can.
 */
export function allocateSplit(payments: { amount: number }[], amountDue: number): Allocation {
  const allocatedMinor = payments.reduce((sum, p) => sum + toMinorUnits(p.amount), 0);
  const amountDueMinor = toMinorUnits(amountDue);
  const remainingMinor = amountDueMinor - allocatedMinor;

  return {
    allocated: fromMinorUnits(allocatedMinor),
    remaining: fromMinorUnits(remainingMinor),
    isBalanced: allocatedMinor === amountDueMinor,
    isOverpaid: allocatedMinor > amountDueMinor,
  };
}

/** What refunding a chosen set of lines is worth. */
export function refundTotal(lines: Priced[]): number {
  const totalMinor = lines.reduce((sum, l) => sum + toMinorUnits(l.unit_price) * l.quantity, 0);
  return fromMinorUnits(totalMinor);
}
