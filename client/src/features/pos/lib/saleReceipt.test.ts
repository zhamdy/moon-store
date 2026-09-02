import { describe, it, expect } from 'vitest';
import { buildReceipt, type ReceiptContext } from './saleReceipt';
import type { SaleResponse } from '../types';

const CART = [
  { product_id: 7, variant_id: 3, name: 'Silk Dress', unit_price: 250, quantity: 2, stock: 5 },
];

function context(overrides: Partial<ReceiptContext> = {}): ReceiptContext {
  return {
    cartItems: CART,
    discount: 10,
    discountType: 'percentage',
    couponCode: 'SUMMER20',
    tax: { enabled: true, rate: 14, mode: 'exclusive' },
    customerName: 'Amina',
    ...overrides,
  };
}

const CONFIRMED: SaleResponse = {
  id: 91,
  discount: 50,
  discount_type: 'fixed',
  total: 480,
  payment_method: 'Cash',
  cashier_name: 'Sarah',
  created_at: '2026-02-01T10:00:00.000Z',
  calculation: {
    subtotal: 500,
    manualDiscount: 50,
    couponDiscount: 20,
    pointsDiscount: 0,
    taxAmount: 0,
    taxMode: 'exclusive',
    taxRatePercent: 0,
    tipAmount: 5,
    amountDue: 435,
  },
  items: [{ product_id: 7, variant_id: 3, quantity: 2, unit_price: 250 }],
  payments: [{ method: 'Cash', amount: 435 }],
};

describe('buildReceipt', () => {
  it('renders the confirmed calculation, never a client recomputation', () => {
    const receipt = buildReceipt(CONFIRMED, context());

    // 435, not the 425 a naive client recompute of 10% off 500 plus a 5 tip
    // and a 20 coupon would have produced.
    expect(receipt.calculation).toEqual(CONFIRMED.calculation);
    expect(receipt.payments).toEqual([{ method: 'Cash', amount: 435 }]);
    expect(receipt.saleId).toBe(91);
    expect(receipt.cashierName).toBe('Sarah');
    expect(receipt.date).toBe('2026-02-01T10:00:00.000Z');
    expect(receipt.customerName).toBe('Amina');
  });

  it('prefers the server-confirmed discount over the cart it was rung up from', () => {
    const receipt = buildReceipt(CONFIRMED, context());
    expect(receipt.discountValue).toBe(50);
    expect(receipt.discountType).toBe('fixed');
  });

  it('falls back to the cart discount only when the response omits one', () => {
    const receipt = buildReceipt(
      { ...CONFIRMED, discount: undefined, discount_type: undefined },
      context()
    );
    expect(receipt.discountValue).toBe(10);
    expect(receipt.discountType).toBe('percentage');
  });

  it('takes line quantities and prices from the server, and only the NAME from the cart', () => {
    const receipt = buildReceipt(
      {
        ...CONFIRMED,
        // The server re-priced this line; the receipt must show the server's figure.
        items: [{ product_id: 7, variant_id: 3, quantity: 2, unit_price: 199 }],
      },
      context()
    );
    expect(receipt.items).toEqual([{ name: 'Silk Dress', quantity: 2, unit_price: 199 }]);
  });

  it('matches names by product AND variant, falling back to the line memo then empty', () => {
    const receipt = buildReceipt(
      {
        ...CONFIRMED,
        items: [
          { product_id: 7, variant_id: 3, quantity: 1, unit_price: 250 },
          // Same product, different variant: no name in the cart for it.
          { product_id: 7, variant_id: 9, quantity: 1, unit_price: 250, memo: 'special order' },
          { product_id: 99, variant_id: null, quantity: 1, unit_price: 10 },
        ],
      },
      context()
    );
    expect(receipt.items.map((i) => i.name)).toEqual(['Silk Dress', 'special order', '']);
  });

  it('synthesizes a single payment from the confirmed amount due when none came back', () => {
    const receipt = buildReceipt({ ...CONFIRMED, payments: [] }, context());
    expect(receipt.payments).toEqual([{ method: 'Cash', amount: 435 }]);
  });

  it('reconstructs a minimal calculation for a pre-Unit-4 response, without crashing', () => {
    const receipt = buildReceipt({ ...CONFIRMED, calculation: undefined }, context());

    expect(receipt.calculation).toEqual({
      subtotal: 500,
      manualDiscount: 0,
      couponDiscount: 0,
      pointsDiscount: 0,
      taxAmount: 0,
      // Only the tax MODE/RATE come from local settings — never an amount.
      taxMode: 'exclusive',
      taxRatePercent: 14,
      tipAmount: 0,
      amountDue: 480,
    });
    // With no calculation and no payments, the sale total is the fallback.
    expect(
      buildReceipt({ ...CONFIRMED, calculation: undefined, payments: [] }, context()).payments
    ).toEqual([{ method: 'Cash', amount: 480 }]);
  });

  it('leaves an unset coupon and cashier name undefined/empty rather than null', () => {
    const receipt = buildReceipt(
      { ...CONFIRMED, cashier_name: undefined },
      context({ couponCode: '', customerName: undefined })
    );
    expect(receipt.couponCode).toBeUndefined();
    expect(receipt.cashierName).toBe('');
    expect(receipt.customerName).toBeUndefined();
  });
});
