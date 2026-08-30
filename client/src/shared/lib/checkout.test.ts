import { describe, it, expect } from 'vitest';
import {
  calculateTotals,
  allocateSplit,
  refundTotal,
  pointsEarned,
  maxRedeemablePoints,
  toMinorUnits,
  fromMinorUnits,
  type TotalsInput,
} from './checkout';

const NO_TAX = { enabled: false, rate: 0, mode: 'exclusive' as const };

function sale(over: Partial<TotalsInput> = {}): TotalsInput {
  return {
    items: [{ unit_price: 10, quantity: 1 }],
    discount: 0,
    discountType: 'fixed',
    couponDiscount: 0,
    tax: NO_TAX,
    pointsToRedeem: 0,
    redeemValue: 0.1,
    tip: 0,
    ...over,
  };
}

// ─── Contract parity: every case in contracts/checkout-totals.v1.json must
// reproduce the exact same components as the server calculator. This is the
// actual parity proof required by the plan — see
// docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md, Unit 3.

interface ContractCase {
  name: string;
  description?: string;
  input: {
    items: { unitPriceMinor: number; quantity: number }[];
    manualDiscount: { type: 'fixed' | 'percentage'; valueMinor?: number; valuePercent?: number };
    couponDiscountMinor: number;
    loyalty: {
      enabled: boolean;
      pointsPerEgp: number;
      egpPerPointMinor: number;
      pointsRedeemed: number;
    };
    tax: { enabled: boolean; ratePercent: number; mode: 'inclusive' | 'exclusive' };
    tipMinor: number;
  };
  expected: {
    subtotalMinor: number;
    manualDiscountMinor: number;
    couponDiscountMinor: number;
    pointsDiscountMinor: number;
    taxableBaseMinor: number;
    taxAmountMinor: number;
    tipMinor: number;
    amountDueMinor: number;
    earnedPoints: number;
  };
}

interface SplitCase {
  name: string;
  amountDueMinor: number;
  payments: { method: string; amountMinor: number }[];
  expected: { allocatedMinor: number; isBalanced: boolean; isOverpaid: boolean };
}

// Loaded via a dynamic Node import + fs read (like `client.test.ts`'s own
// structural check) rather than a static import of a repo-root JSON file,
// which the module-boundary lint rule treats as an unknown dependency.
async function loadFixture(): Promise<{ cases: ContractCase[]; splitPaymentCases: SplitCase[] }> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const raw = fs.readFileSync(
    path.resolve(__dirname, '../../../../contracts/checkout-totals.v1.json'),
    'utf-8'
  );
  return JSON.parse(raw);
}

const fixture = await loadFixture();

/** Convert one contract fixture case into the client calculator's major-unit input shape. */
function toTotalsInput(c: ContractCase): TotalsInput {
  return {
    items: c.input.items.map((i) => ({
      unit_price: fromMinorUnits(i.unitPriceMinor),
      quantity: i.quantity,
    })),
    discount:
      c.input.manualDiscount.type === 'percentage'
        ? c.input.manualDiscount.valuePercent || 0
        : fromMinorUnits(c.input.manualDiscount.valueMinor || 0),
    discountType: c.input.manualDiscount.type,
    couponDiscount: fromMinorUnits(c.input.couponDiscountMinor),
    tax: {
      enabled: c.input.tax.enabled,
      rate: c.input.tax.ratePercent,
      mode: c.input.tax.mode,
    },
    pointsToRedeem: c.input.loyalty.pointsRedeemed,
    redeemValue: fromMinorUnits(c.input.loyalty.egpPerPointMinor),
    tip: fromMinorUnits(c.input.tipMinor),
    loyaltyEnabled: c.input.loyalty.enabled,
    pointsPerEgp: c.input.loyalty.pointsPerEgp,
  };
}

describe('contract parity (contracts/checkout-totals.v1.json)', () => {
  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const totals = calculateTotals(toTotalsInput(c));

    expect(toMinorUnits(totals.subtotal)).toBe(c.expected.subtotalMinor);
    expect(toMinorUnits(totals.discountAmount)).toBe(c.expected.manualDiscountMinor);
    expect(toMinorUnits(totals.couponDiscount)).toBe(c.expected.couponDiscountMinor);
    expect(toMinorUnits(totals.pointsDiscount)).toBe(c.expected.pointsDiscountMinor);
    expect(toMinorUnits(totals.netOfDiscounts)).toBe(c.expected.taxableBaseMinor);
    expect(toMinorUnits(totals.taxAmount)).toBe(c.expected.taxAmountMinor);
    expect(toMinorUnits(totals.tip)).toBe(c.expected.tipMinor);
    expect(toMinorUnits(totals.amountDue)).toBe(c.expected.amountDueMinor);
    expect(totals.earnedPoints).toBe(c.expected.earnedPoints);
  });
});

describe('split-payment contract parity', () => {
  it.each(fixture.splitPaymentCases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const amountDue = fromMinorUnits(c.amountDueMinor);
    const payments = c.payments.map((p) => ({ amount: fromMinorUnits(p.amountMinor) }));

    const allocation = allocateSplit(payments, amountDue);

    expect(toMinorUnits(allocation.allocated)).toBe(c.expected.allocatedMinor);
    expect(allocation.isBalanced).toBe(c.expected.isBalanced);
    expect(allocation.isOverpaid).toBe(c.expected.isOverpaid);
  });
});

describe('totals', () => {
  it('sums the lines', () => {
    const t = calculateTotals(
      sale({
        items: [
          { unit_price: 1, quantity: 2 },
          { unit_price: 5.5, quantity: 1 },
        ],
      })
    );

    expect(t.subtotal).toBe(7.5);
    expect(t.amountDue).toBe(7.5);
  });

  it('takes a fixed discount off the subtotal', () => {
    const t = calculateTotals(sale({ discount: 1.5 }));

    expect(t.discountAmount).toBe(1.5);
    expect(t.amountDue).toBe(8.5);
  });

  it('takes a percentage discount off the subtotal', () => {
    const t = calculateTotals(sale({ discount: 15, discountType: 'percentage' }));

    expect(t.discountAmount).toBe(1.5);
    expect(t.amountDue).toBe(8.5);
  });

  it('never lets discounts drive the sale below zero', () => {
    const t = calculateTotals(sale({ discount: 50 }));

    expect(t.netOfDiscounts).toBe(0);
    expect(t.amountDue).toBe(0);
  });

  it('adds exclusive tax on top of the discounted total', () => {
    const t = calculateTotals(sale({ tax: { enabled: true, rate: 15, mode: 'exclusive' } }));

    expect(t.taxAmount).toBe(1.5);
    expect(t.totalWithTax).toBe(11.5);
    expect(t.amountDue).toBe(11.5);
  });

  it('names inclusive tax without adding it', () => {
    const t = calculateTotals(sale({ tax: { enabled: true, rate: 15, mode: 'inclusive' } }));

    // 10 already contains the tax: 10 - 10/1.15
    expect(t.taxAmount).toBe(1.3);
    expect(t.totalWithTax).toBe(10);
    expect(t.amountDue).toBe(10);
  });

  it('taxes the discounted amount, not the sticker price', () => {
    const t = calculateTotals(
      sale({ discount: 2, tax: { enabled: true, rate: 10, mode: 'exclusive' } })
    );

    expect(t.taxAmount).toBe(0.8);
    expect(t.amountDue).toBe(8.8);
  });

  it('ignores tax when the rate is zero even if tax is switched on', () => {
    const t = calculateTotals(sale({ tax: { enabled: true, rate: 0, mode: 'exclusive' } }));

    expect(t.taxAmount).toBe(0);
    expect(t.amountDue).toBe(10);
  });
});

describe('tip (regression: must be added after tax, never subtracted)', () => {
  it('a 25 EGP tip on an 850 EGP post-discount amount yields 875 EGP due, never 825', () => {
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 850, quantity: 1 }],
        tip: 25,
      })
    );

    expect(t.tip).toBe(25);
    expect(t.amountDue).toBe(875);
    expect(t.amountDue).not.toBe(825);
  });

  it('adds tip after exclusive tax, untaxed', () => {
    const t = calculateTotals(
      sale({ tax: { enabled: true, rate: 10, mode: 'exclusive' }, tip: 5 })
    );

    // 10 subtotal -> 11 with tax -> 16 with tip. Tip itself is never taxed.
    expect(t.taxAmount).toBe(1);
    expect(t.amountDue).toBe(16);
  });

  it('never lets a negative tip reduce the amount due', () => {
    const t = calculateTotals(sale({ tip: -5 }));

    expect(t.tip).toBe(0);
    expect(t.amountDue).toBe(10);
  });
});

describe('loyalty (regression: direct per-point units, applied before tax)', () => {
  it('200 points at 0.10 EGP/point yields a 20 EGP discount, not 2000 or 0.20', () => {
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 1000, quantity: 1 }],
        pointsToRedeem: 200,
        redeemValue: 0.1,
      })
    );

    expect(t.pointsDiscount).toBe(20);
    expect(t.pointsDiscount).not.toBe(2000);
    expect(t.pointsDiscount).not.toBe(0.2);
    expect(t.amountDue).toBe(980);
  });

  it('reduces the taxable base, so tax is charged on the post-redemption amount', () => {
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 1000, quantity: 1 }],
        pointsToRedeem: 200,
        redeemValue: 0.1,
        tax: { enabled: true, rate: 14, mode: 'exclusive' },
      })
    );

    expect(t.netOfDiscounts).toBe(980); // taxable base already net of the points discount
    expect(t.taxAmount).toBe(137.2); // 980 * 14%, not 1000 * 14%
  });

  it('caps redemption at the remaining monetary value, not just the requested points', () => {
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 10, quantity: 1 }],
        pointsToRedeem: 1000, // would be worth 100 EGP at 0.10/point — far more than the sale
        redeemValue: 0.1,
      })
    );

    expect(t.pointsDiscount).toBe(10);
    expect(t.amountDue).toBe(0);
  });

  it('caps redemption at the customer point balance', () => {
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 1000, quantity: 1 }],
        pointsToRedeem: 500,
        pointsBalance: 100,
        redeemValue: 0.1,
      })
    );

    expect(t.pointsDiscount).toBe(10); // only 100 of the requested 500 points are honored
  });

  it('never redeems anything when the program is disabled, even with a configured rate', () => {
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 1000, quantity: 1 }],
        pointsToRedeem: 200,
        redeemValue: 0.1,
        loyaltyEnabled: false,
        pointsPerEgp: 2,
      })
    );

    expect(t.pointsDiscount).toBe(0);
    expect(t.earnedPoints).toBe(0);
  });

  it('never lets a zero or negative redemption rate create a discount', () => {
    const t = calculateTotals(sale({ pointsToRedeem: 100, redeemValue: 0 }));
    expect(t.pointsDiscount).toBe(0);

    const negative = calculateTotals(sale({ pointsToRedeem: 100, redeemValue: -0.1 }));
    expect(negative.pointsDiscount).toBe(0);
  });

  it('earns whole points from the final amount due, computed after redemption', () => {
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 1000, quantity: 1 }],
        pointsToRedeem: 200,
        redeemValue: 0.1,
        loyaltyEnabled: true,
        pointsPerEgp: 2,
      })
    );

    // amountDue is 980 (post-redemption); 980 * 2 = 1960 points.
    expect(t.earnedPoints).toBe(1960);
  });
});

describe('coupon, discount, loyalty and tip stacked', () => {
  it('applies manual discount, coupon, and loyalty in order before tax, then adds tip', () => {
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 2000, quantity: 1 }],
        discount: 10,
        discountType: 'percentage',
        couponDiscount: 50,
        pointsToRedeem: 300,
        redeemValue: 0.1,
        tax: { enabled: true, rate: 14, mode: 'exclusive' },
        tip: 50,
      })
    );

    expect(t.discountAmount).toBe(200); // 10% of 2000
    expect(t.couponDiscount).toBe(50);
    expect(t.pointsDiscount).toBe(30); // 300 * 0.10
    expect(t.netOfDiscounts).toBe(1720); // 2000 - 200 - 50 - 30
    expect(t.taxAmount).toBe(240.8); // 1720 * 14%
    expect(t.tip).toBe(50);
    expect(t.amountDue).toBe(2010.8); // 1720 + 240.8 + 50
  });
});

describe('rounding', () => {
  it('rounds a half-minor-unit tax boundary away from zero', () => {
    // Raw tax on 3.33 at 50% is 1.665, which must round up to 1.67.
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 3.33, quantity: 1 }],
        tax: { enabled: true, rate: 50, mode: 'exclusive' },
      })
    );

    expect(t.taxAmount).toBe(1.67);
    expect(t.amountDue).toBe(5);
  });
});

describe('split payment allocation', () => {
  const AMOUNT_DUE = 11.5;

  it('balances when the parts sum to the amount due', () => {
    const a = allocateSplit([{ amount: 9 }, { amount: 2.5 }], AMOUNT_DUE);

    expect(a.allocated).toBe(11.5);
    expect(a.remaining).toBe(0);
    expect(a.isBalanced).toBe(true);
    expect(a.isOverpaid).toBe(false);
  });

  it('does not balance when the parts fall short', () => {
    const a = allocateSplit([{ amount: 9 }], AMOUNT_DUE);

    expect(a.remaining).toBe(2.5);
    expect(a.isBalanced).toBe(false);
  });

  it('does not balance when the parts overshoot, and says so', () => {
    const a = allocateSplit([{ amount: 9 }, { amount: 4 }], AMOUNT_DUE);

    expect(a.remaining).toBe(-1.5);
    expect(a.isBalanced).toBe(false);
    expect(a.isOverpaid).toBe(true);
  });

  it('balances a three-way split to the exact minor unit, no tolerance needed', () => {
    const a = allocateSplit([{ amount: 3.83 }, { amount: 3.83 }, { amount: 3.84 }], 11.5);

    expect(a.isBalanced).toBe(true);
  });

  it('is unbalanced when nothing has been allocated yet', () => {
    const a = allocateSplit([], AMOUNT_DUE);

    expect(a.remaining).toBe(11.5);
    expect(a.isBalanced).toBe(false);
  });

  it('balances against tax and points, not the bare cart total', () => {
    // The regression this module exists to prevent: the split target used to be
    // the cart total less tip, so with tax on the cashier balanced to 100
    // while the customer owed 88.
    const t = calculateTotals(
      sale({
        items: [{ unit_price: 100, quantity: 1 }],
        tax: { enabled: true, rate: 10, mode: 'exclusive' },
        pointsToRedeem: 200,
        redeemValue: 0.1,
      })
    );

    expect(t.pointsDiscount).toBe(20); // 200 points before tax
    expect(t.amountDue).toBe(88); // (100 - 20) * 1.10
    expect(allocateSplit([{ amount: 100 }], t.amountDue).isBalanced).toBe(false);
    expect(allocateSplit([{ amount: 88 }], t.amountDue).isBalanced).toBe(true);
  });
});

describe('refund totals', () => {
  it('is worth the lines chosen', () => {
    expect(
      refundTotal([
        { unit_price: 1, quantity: 1 },
        { unit_price: 5.5, quantity: 2 },
      ])
    ).toBe(12);
  });

  it('is nothing when no line is chosen', () => {
    expect(refundTotal([])).toBe(0);
  });

  it('refunds part of a line', () => {
    expect(refundTotal([{ unit_price: 3.3333, quantity: 2 }])).toBe(6.66);
  });
});

describe('loyalty accrual and redemption limits (standalone helpers)', () => {
  it('earns whole points per EGP spent (direct units)', () => {
    expect(pointsEarned(10, 1)).toBe(10);
    expect(pointsEarned(10.5, 2)).toBe(21);
  });

  it('earns nothing on a free sale', () => {
    expect(pointsEarned(0, 1)).toBe(0);
  });

  it('caps redemption at the points the customer holds', () => {
    expect(maxRedeemablePoints(50, 1000, 0.1)).toBe(50);
  });

  it('caps redemption at the value of the sale', () => {
    // 1000 due at 0.10 EGP/point -> 10,000 points would cover it exactly
    expect(maxRedeemablePoints(99999, 1000, 0.1)).toBe(10000);
  });

  it('redeems nothing when the customer holds nothing', () => {
    expect(maxRedeemablePoints(0, 1000, 0.1)).toBe(0);
  });
});
