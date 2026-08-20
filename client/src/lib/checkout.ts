/**
 * What a sale is worth, decided in one place.
 *
 * The cart panel used to compute the total three incompatible ways: the footer
 * headline added tax but ignored points and tip, the checkout sheet subtracted
 * both, and the split-payment allocation used neither — so with tax enabled a
 * cashier was asked to balance payments against a figure that was not what the
 * customer owed. Everything below is pure, so it can be exercised without
 * rendering anything.
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
  /** Currency each 100 points is worth. */
  redeemValue: number;
  tip: number;
}

export interface Totals {
  subtotal: number;
  discountAmount: number;
  couponDiscount: number;
  /** Subtotal net of both discounts, before tax. What the cart store calls the total. */
  netOfDiscounts: number;
  taxAmount: number;
  /** Net of discounts plus tax. Exclusive tax adds; inclusive tax is already inside. */
  totalWithTax: number;
  pointsDiscount: number;
  tip: number;
  /** The one figure the customer actually owes. */
  amountDue: number;
}

/** Currency is only ever meaningful to the cent. */
const money = (n: number) => Math.round(n * 100) / 100;

export function calculateTotals({
  items,
  discount,
  discountType,
  couponDiscount,
  tax,
  pointsToRedeem,
  redeemValue,
  tip,
}: TotalsInput): Totals {
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
  const netOfDiscounts = Math.max(0, subtotal - discountAmount - couponDiscount);

  let taxAmount = 0;
  let totalWithTax = netOfDiscounts;
  if (tax.enabled && tax.rate > 0) {
    if (tax.mode === 'exclusive') {
      taxAmount = money(netOfDiscounts * (tax.rate / 100));
      totalWithTax = netOfDiscounts + taxAmount;
    } else {
      // Inclusive: the tax is already inside the price, so only name it.
      taxAmount = money(netOfDiscounts - netOfDiscounts / (1 + tax.rate / 100));
    }
  }

  const pointsDiscount = pointsToRedeem > 0 ? money((pointsToRedeem / 100) * redeemValue) : 0;

  return {
    subtotal: money(subtotal),
    discountAmount: money(discountAmount),
    couponDiscount: money(couponDiscount),
    netOfDiscounts: money(netOfDiscounts),
    taxAmount,
    totalWithTax: money(totalWithTax),
    pointsDiscount,
    tip: money(tip),
    amountDue: Math.max(0, money(totalWithTax - pointsDiscount - tip)),
  };
}

/** How many points a sale earns, given the rate per 100 spent. */
export function pointsEarned(amountDue: number, earnRate: number): number {
  if (earnRate <= 0 || amountDue <= 0) return 0;
  return Math.floor((amountDue / 100) * earnRate);
}

/**
 * The most a customer may spend on this sale: never more points than they hold,
 * and never more value than the sale is worth.
 */
export function maxRedeemablePoints(
  heldPoints: number,
  totalWithTax: number,
  redeemValue: number
): number {
  if (heldPoints <= 0 || redeemValue <= 0 || totalWithTax <= 0) return 0;
  const pointsCoveringSale = Math.floor((totalWithTax / redeemValue) * 100);
  return Math.min(heldPoints, pointsCoveringSale);
}

export interface Allocation {
  allocated: number;
  remaining: number;
  /** Payments cover the amount due, to the cent. */
  isBalanced: boolean;
  /** More was allocated than the sale is worth. */
  isOverpaid: boolean;
}

export function allocateSplit(payments: { amount: number }[], amountDue: number): Allocation {
  const allocated = money(payments.reduce((sum, p) => sum + p.amount, 0));
  const remaining = money(amountDue - allocated);
  return {
    allocated,
    remaining,
    isBalanced: Math.abs(remaining) < 0.01,
    isOverpaid: remaining < -0.005,
  };
}

/** What refunding a chosen set of lines is worth. */
export function refundTotal(lines: Priced[]): number {
  return money(lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0));
}
