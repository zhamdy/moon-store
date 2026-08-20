import { describe, it, expect } from 'vitest';
import {
  calculateTotals,
  allocateSplit,
  refundTotal,
  pointsEarned,
  maxRedeemablePoints,
  type TotalsInput,
} from './checkout';

const NO_TAX = { enabled: false, rate: 0, mode: 'exclusive' as const };

function sale(over: Partial<TotalsInput> = {}): TotalsInput {
  return {
    items: [{ unit_price: 1000, quantity: 1 }],
    discount: 0,
    discountType: 'fixed',
    couponDiscount: 0,
    tax: NO_TAX,
    pointsToRedeem: 0,
    redeemValue: 5,
    tip: 0,
    ...over,
  };
}

describe('totals', () => {
  it('sums the lines', () => {
    const t = calculateTotals(
      sale({
        items: [
          { unit_price: 100, quantity: 2 },
          { unit_price: 550, quantity: 1 },
        ],
      })
    );

    expect(t.subtotal).toBe(750);
    expect(t.amountDue).toBe(750);
  });

  it('takes a fixed discount off the subtotal', () => {
    const t = calculateTotals(sale({ discount: 150 }));

    expect(t.discountAmount).toBe(150);
    expect(t.amountDue).toBe(850);
  });

  it('takes a percentage discount off the subtotal', () => {
    const t = calculateTotals(sale({ discount: 15, discountType: 'percentage' }));

    expect(t.discountAmount).toBe(150);
    expect(t.amountDue).toBe(850);
  });

  it('never lets discounts drive the sale below zero', () => {
    const t = calculateTotals(sale({ discount: 5000 }));

    expect(t.netOfDiscounts).toBe(0);
    expect(t.amountDue).toBe(0);
  });

  it('adds exclusive tax on top of the discounted total', () => {
    const t = calculateTotals(sale({ tax: { enabled: true, rate: 15, mode: 'exclusive' } }));

    expect(t.taxAmount).toBe(150);
    expect(t.totalWithTax).toBe(1150);
    expect(t.amountDue).toBe(1150);
  });

  it('names inclusive tax without adding it', () => {
    const t = calculateTotals(sale({ tax: { enabled: true, rate: 15, mode: 'inclusive' } }));

    // 1000 already contains the tax: 1000 - 1000/1.15
    expect(t.taxAmount).toBe(130.43);
    expect(t.totalWithTax).toBe(1000);
    expect(t.amountDue).toBe(1000);
  });

  it('taxes the discounted amount, not the sticker price', () => {
    const t = calculateTotals(
      sale({ discount: 200, tax: { enabled: true, rate: 10, mode: 'exclusive' } })
    );

    expect(t.taxAmount).toBe(80);
    expect(t.amountDue).toBe(880);
  });

  it('ignores tax when the rate is zero even if tax is switched on', () => {
    const t = calculateTotals(sale({ tax: { enabled: true, rate: 0, mode: 'exclusive' } }));

    expect(t.taxAmount).toBe(0);
    expect(t.amountDue).toBe(1000);
  });
});

describe('coupon and loyalty applied together', () => {
  it('subtracts the coupon before tax and the points after it', () => {
    const t = calculateTotals(
      sale({
        couponDiscount: 100,
        tax: { enabled: true, rate: 10, mode: 'exclusive' },
        pointsToRedeem: 200,
        redeemValue: 5,
      })
    );

    expect(t.netOfDiscounts).toBe(900); // 1000 - 100 coupon
    expect(t.taxAmount).toBe(90); // taxed on 900, not 1000
    expect(t.totalWithTax).toBe(990);
    expect(t.pointsDiscount).toBe(10); // 200 points at 5 per 100
    expect(t.amountDue).toBe(980);
  });

  it('stacks a manual discount, a coupon, points and a tip', () => {
    const t = calculateTotals(
      sale({
        discount: 10,
        discountType: 'percentage',
        couponDiscount: 50,
        pointsToRedeem: 1000,
        redeemValue: 5,
        tip: 25,
      })
    );

    expect(t.discountAmount).toBe(100);
    expect(t.netOfDiscounts).toBe(850);
    expect(t.pointsDiscount).toBe(50);
    expect(t.amountDue).toBe(775); // 850 - 50 points - 25 tip
  });

  it('never lets points drive the amount due below zero', () => {
    const t = calculateTotals(sale({ pointsToRedeem: 100000, redeemValue: 5 }));

    expect(t.amountDue).toBe(0);
  });

  it('redeems nothing when no points are being spent', () => {
    const t = calculateTotals(sale({ pointsToRedeem: 0 }));

    expect(t.pointsDiscount).toBe(0);
  });
});

describe('split payment allocation', () => {
  const AMOUNT_DUE = 1150;

  it('balances when the parts sum to the amount due', () => {
    const a = allocateSplit([{ amount: 900 }, { amount: 250 }], AMOUNT_DUE);

    expect(a.allocated).toBe(1150);
    expect(a.remaining).toBe(0);
    expect(a.isBalanced).toBe(true);
    expect(a.isOverpaid).toBe(false);
  });

  it('does not balance when the parts fall short', () => {
    const a = allocateSplit([{ amount: 900 }], AMOUNT_DUE);

    expect(a.remaining).toBe(250);
    expect(a.isBalanced).toBe(false);
  });

  it('does not balance when the parts overshoot, and says so', () => {
    const a = allocateSplit([{ amount: 900 }, { amount: 400 }], AMOUNT_DUE);

    expect(a.remaining).toBe(-150);
    expect(a.isBalanced).toBe(false);
    expect(a.isOverpaid).toBe(true);
  });

  it('treats sub-cent drift as balanced', () => {
    const a = allocateSplit([{ amount: 383.33 }, { amount: 383.33 }, { amount: 383.34 }], 1150);

    expect(a.isBalanced).toBe(true);
  });

  it('is unbalanced when nothing has been allocated yet', () => {
    const a = allocateSplit([], AMOUNT_DUE);

    expect(a.remaining).toBe(1150);
    expect(a.isBalanced).toBe(false);
  });

  it('balances against tax and points, not the bare cart total', () => {
    // The regression this module exists to prevent: the split target used to be
    // the cart total less tip, so with tax on the cashier balanced to 1000
    // while the customer owed 1090.
    const t = calculateTotals(
      sale({
        tax: { enabled: true, rate: 10, mode: 'exclusive' },
        pointsToRedeem: 200,
        redeemValue: 5,
      })
    );

    expect(t.amountDue).toBe(1090);
    expect(allocateSplit([{ amount: 1000 }], t.amountDue).isBalanced).toBe(false);
    expect(allocateSplit([{ amount: 1090 }], t.amountDue).isBalanced).toBe(true);
  });
});

describe('refund totals', () => {
  it('is worth the lines chosen', () => {
    expect(
      refundTotal([
        { unit_price: 100, quantity: 1 },
        { unit_price: 550, quantity: 2 },
      ])
    ).toBe(1200);
  });

  it('is nothing when no line is chosen', () => {
    expect(refundTotal([])).toBe(0);
  });

  it('refunds part of a line', () => {
    expect(refundTotal([{ unit_price: 333.33, quantity: 2 }])).toBe(666.66);
  });
});

describe('loyalty accrual and redemption limits', () => {
  it('earns whole points per hundred spent', () => {
    expect(pointsEarned(1000, 1)).toBe(10);
    expect(pointsEarned(1050, 2)).toBe(21);
  });

  it('earns nothing on a free sale', () => {
    expect(pointsEarned(0, 1)).toBe(0);
  });

  it('caps redemption at the points the customer holds', () => {
    expect(maxRedeemablePoints(300, 1000, 5)).toBe(300);
  });

  it('caps redemption at the value of the sale', () => {
    // 1000 due, 5 per 100 points → 20,000 points would cover it exactly
    expect(maxRedeemablePoints(99999, 1000, 5)).toBe(20000);
  });

  it('redeems nothing when the customer holds nothing', () => {
    expect(maxRedeemablePoints(0, 1000, 5)).toBe(0);
  });
});
