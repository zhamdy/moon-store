import { describe, it, expect } from 'vitest';
import { buildSalePayload, buildOfflineSalePayload, type SaleComposition } from './salePayload';

const SILK_DRESS = {
  product_id: 7,
  name: 'Silk Dress',
  unit_price: 250,
  quantity: 2,
  stock: 5,
};

function composition(overrides: Partial<SaleComposition> = {}): SaleComposition {
  return {
    items: [SILK_DRESS],
    discount: 0,
    discountType: 'fixed',
    notes: '',
    tip: 0,
    couponCode: '',
    paymentMethod: 'Cash',
    splitPayment: false,
    payments: [],
    customerId: null,
    pointsToRedeem: 0,
    ...overrides,
  };
}

describe('buildSalePayload', () => {
  it('sends only the required fields for a bare walk-in sale', () => {
    expect(buildSalePayload(composition())).toEqual({
      items: [{ product_id: 7, quantity: 2, unit_price: 250 }],
      discount: 0,
      discount_type: 'fixed',
      payment_method: 'Cash',
    });
  });

  it('omits every unset optional field rather than sending it as null', () => {
    const payload = buildSalePayload(composition());
    for (const field of [
      'payments',
      'customer_id',
      'points_redeemed',
      'notes',
      'tip',
      'coupon_code',
      'variant_id',
    ]) {
      expect(payload).not.toHaveProperty(field);
    }
    expect(payload.items[0]).not.toHaveProperty('variant_id');
    expect(payload.items[0]).not.toHaveProperty('memo');
  });

  it('carries every configured extra through', () => {
    const payload = buildSalePayload(
      composition({
        items: [{ ...SILK_DRESS, variant_id: 3, memo: 'gift wrap' }],
        discount: 10,
        discountType: 'percentage',
        notes: 'call before delivery',
        tip: 5,
        couponCode: 'SUMMER20',
        customerId: 42,
        pointsToRedeem: 100,
      })
    );

    expect(payload).toEqual({
      items: [{ product_id: 7, quantity: 2, unit_price: 250, variant_id: 3, memo: 'gift wrap' }],
      discount: 10,
      discount_type: 'percentage',
      payment_method: 'Cash',
      customer_id: 42,
      points_redeemed: 100,
      notes: 'call before delivery',
      tip: 5,
      coupon_code: 'SUMMER20',
    });
  });

  it('forces payment_method to Cash and attaches the tenders for a split', () => {
    const payments = [
      { method: 'Card' as const, amount: 300 },
      { method: 'Gift Card' as const, amount: 200 },
    ];
    const payload = buildSalePayload(
      composition({ paymentMethod: 'Card', splitPayment: true, payments })
    );

    expect(payload.payment_method).toBe('Cash');
    expect(payload.payments).toEqual(payments);
  });

  it('does not attach an empty tender list even when split is toggled on', () => {
    const payload = buildSalePayload(composition({ splitPayment: true, payments: [] }));
    expect(payload).not.toHaveProperty('payments');
    expect(payload.payment_method).toBe('Cash');
  });

  it('keeps a non-split sale on the chosen method', () => {
    expect(buildSalePayload(composition({ paymentMethod: 'Other' })).payment_method).toBe('Other');
  });

  it('drops a zero or negative tip, points redemption and discount-free coupon', () => {
    const payload = buildSalePayload(
      composition({ tip: 0, pointsToRedeem: 0, couponCode: '', customerId: 0 })
    );
    expect(payload).not.toHaveProperty('tip');
    expect(payload).not.toHaveProperty('points_redeemed');
    expect(payload).not.toHaveProperty('coupon_code');
    expect(payload).not.toHaveProperty('customer_id');
  });

  /**
   * The idempotency key is derived from `JSON.stringify` of this object and a
   * persisted mid-checkout attempt is matched by that exact string, so key
   * ORDER is part of the contract, not a formatting detail.
   */
  it('emits its keys in a stable order, because the idempotency fingerprint is the stringified body', () => {
    const payload = buildSalePayload(
      composition({
        discount: 10,
        discountType: 'percentage',
        notes: 'n',
        tip: 5,
        couponCode: 'C',
        customerId: 42,
        pointsToRedeem: 3,
        splitPayment: true,
        payments: [{ method: 'Cash', amount: 500 }],
      })
    );

    expect(Object.keys(payload)).toEqual([
      'items',
      'discount',
      'discount_type',
      'payment_method',
      'payments',
      'customer_id',
      'points_redeemed',
      'notes',
      'tip',
      'coupon_code',
    ]);
  });
});

describe('buildOfflineSalePayload', () => {
  it('stores a deliberately reduced body: no notes, tip, coupon, tenders or points', () => {
    const payload = buildOfflineSalePayload(
      composition({
        discount: 10,
        discountType: 'percentage',
        notes: 'call before delivery',
        tip: 5,
        couponCode: 'SUMMER20',
        pointsToRedeem: 100,
        splitPayment: true,
        payments: [{ method: 'Cash', amount: 500 }],
        customerId: 42,
      })
    );

    expect(payload).toEqual({
      items: [{ product_id: 7, quantity: 2, unit_price: 250 }],
      discount: 10,
      discount_type: 'percentage',
      payment_method: 'Cash',
      customer_id: 42,
    });
  });

  it('keeps the chosen payment method even when a split was configured', () => {
    const payload = buildOfflineSalePayload(
      composition({ paymentMethod: 'Card', splitPayment: true })
    );
    expect(payload.payment_method).toBe('Card');
  });

  it('carries variant identity but drops the line memo', () => {
    const payload = buildOfflineSalePayload(
      composition({ items: [{ ...SILK_DRESS, variant_id: 3, memo: 'gift wrap' }] })
    );
    expect(payload.items).toEqual([{ product_id: 7, variant_id: 3, quantity: 2, unit_price: 250 }]);
  });
});
