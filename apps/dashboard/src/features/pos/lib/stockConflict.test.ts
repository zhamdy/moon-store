import { describe, it, expect } from 'vitest';
import {
  checkableProductIds,
  findStockShortfalls,
  planCartAdjustment,
  shortfallsFromDetails,
  type StockShortfall,
} from './stockConflict';
import type { ValidationDetail } from '../../../shared/lib/transport/types';
import type { CartItem } from '../store/cartStore';

function line(overrides: Partial<CartItem> & { product_id: number }): CartItem {
  return {
    name: `Product ${overrides.product_id}`,
    unit_price: 100,
    quantity: 1,
    stock: 10,
    ...overrides,
  };
}

describe('checkableProductIds', () => {
  it('lists each product once', () => {
    expect(checkableProductIds([line({ product_id: 7 }), line({ product_id: 7 })])).toEqual([7]);
  });

  it('leaves out variant lines, whose stock this endpoint does not carry', () => {
    const items = [line({ product_id: 7 }), line({ product_id: 8, variant_id: 3 })];

    expect(checkableProductIds(items)).toEqual([7]);
  });

  it('is empty for a cart that is entirely variant lines', () => {
    expect(checkableProductIds([line({ product_id: 8, variant_id: 3 })])).toEqual([]);
  });
});

describe('findStockShortfalls', () => {
  it('reports nothing when every line still fits', () => {
    const items = [line({ product_id: 7, quantity: 2 })];

    expect(findStockShortfalls(items, new Map([[7, 5]]))).toEqual([]);
  });

  it('reports what was asked for against what is left', () => {
    const items = [line({ product_id: 7, name: 'Silk Dress', quantity: 4 })];

    expect(findStockShortfalls(items, new Map([[7, 1]]))).toEqual<StockShortfall[]>([
      { productId: 7, variantId: null, name: 'Silk Dress', requested: 4, available: 1 },
    ]);
  });

  it('sums the same product across lines, which alone would each look affordable', () => {
    const items = [
      line({ product_id: 7, name: 'Silk Dress', quantity: 1, memo: 'gift wrap' }),
      line({ product_id: 7, name: 'Silk Dress', quantity: 1 }),
    ];

    expect(findStockShortfalls(items, new Map([[7, 1]]))).toEqual<StockShortfall[]>([
      { productId: 7, variantId: null, name: 'Silk Dress', requested: 2, available: 1 },
    ]);
  });

  it('treats a product missing from the fresh read as no longer sellable', () => {
    // `products/lookup` hides anything not active from a cashier.
    const items = [line({ product_id: 7, name: 'Silk Dress', quantity: 2 })];

    expect(findStockShortfalls(items, new Map())).toEqual<StockShortfall[]>([
      { productId: 7, variantId: null, name: 'Silk Dress', requested: 2, available: 0 },
    ]);
  });

  it('never reports a negative availability', () => {
    const items = [line({ product_id: 7, quantity: 2 })];

    expect(findStockShortfalls(items, new Map([[7, -3]]))[0].available).toBe(0);
  });

  it('ignores variant lines rather than judging them by product stock', () => {
    const items = [line({ product_id: 7, variant_id: 3, quantity: 99 })];

    expect(findStockShortfalls(items, new Map([[7, 1]]))).toEqual([]);
  });
});

describe('planCartAdjustment', () => {
  it('trims an oversold line to what is left', () => {
    const items = [line({ product_id: 7, quantity: 4 })];
    const shortfalls = [
      { productId: 7, variantId: null, name: 'Silk Dress', requested: 4, available: 1 },
    ];

    expect(planCartAdjustment(items, shortfalls)).toEqual([
      { productId: 7, variantId: null, quantity: 1 },
    ]);
  });

  it('removes a line whose product has nothing left', () => {
    const items = [line({ product_id: 7, quantity: 2 })];
    const shortfalls = [
      { productId: 7, variantId: null, name: 'Silk Dress', requested: 2, available: 0 },
    ];

    expect(planCartAdjustment(items, shortfalls)).toEqual([
      { productId: 7, variantId: null, quantity: 0 },
    ]);
  });

  it('spreads what is left across lines in cart order rather than losing both', () => {
    const items = [
      line({ product_id: 7, quantity: 1, memo: 'first' }),
      line({ product_id: 7, quantity: 1, memo: 'second' }),
    ];
    const shortfalls = [
      { productId: 7, variantId: null, name: 'Silk Dress', requested: 2, available: 1 },
    ];

    // The first line keeps its single unit and is therefore not adjusted at
    // all; only the second is emptied.
    expect(planCartAdjustment(items, shortfalls)).toEqual([
      { productId: 7, variantId: null, quantity: 0 },
    ]);
  });

  it('leaves lines of products that are not short alone', () => {
    const items = [line({ product_id: 7, quantity: 1 }), line({ product_id: 9, quantity: 3 })];
    const shortfalls = [
      { productId: 9, variantId: null, name: 'Scarf', requested: 3, available: 2 },
    ];

    expect(planCartAdjustment(items, shortfalls)).toEqual([
      { productId: 9, variantId: null, quantity: 2 },
    ]);
  });
});

describe('shortfallsFromDetails', () => {
  function detail(meta: ValidationDetail['meta']): ValidationDetail {
    return { field: 'items', code: 'INSUFFICIENT_STOCK', message: 'Insufficient stock', meta };
  }

  it('reads the numbers the server stated, straight off the rejection', () => {
    const items = [line({ product_id: 7, name: 'Silk Dress', quantity: 4 })];
    const details = [detail({ productId: 7, variantId: null, requested: 4, available: 1 })];

    expect(shortfallsFromDetails(details, items)).toEqual<StockShortfall[]>([
      { productId: 7, variantId: null, name: 'Silk Dress', requested: 4, available: 1 },
    ]);
  });

  it('speaks for a variant line, which the stock re-read cannot judge at all', () => {
    const items = [line({ product_id: 7, variant_id: 3, name: 'Silk Dress / M', quantity: 2 })];
    const details = [detail({ productId: 7, variantId: 3, requested: 2, available: 0 })];

    expect(shortfallsFromDetails(details, items)).toEqual<StockShortfall[]>([
      { productId: 7, variantId: 3, name: 'Silk Dress / M', requested: 2, available: 0 },
    ]);
  });

  it('does not match a variant detail to the product-level line of the same product', () => {
    const items = [line({ product_id: 7, name: 'Silk Dress', quantity: 2 })];
    const details = [detail({ productId: 7, variantId: 3, requested: 2, available: 0 })];

    expect(shortfallsFromDetails(details, items)).toEqual([]);
  });

  it('reports every oversold line the rejection named', () => {
    const items = [
      line({ product_id: 7, name: 'Silk Dress', quantity: 4 }),
      line({ product_id: 9, name: 'Scarf', quantity: 3 }),
    ];
    const details = [
      detail({ productId: 7, variantId: null, requested: 4, available: 1 }),
      detail({ productId: 9, variantId: null, requested: 3, available: 2 }),
    ];

    expect(shortfallsFromDetails(details, items)).toHaveLength(2);
  });

  it('ignores details carrying any other code', () => {
    const items = [line({ product_id: 7, quantity: 4 })];
    const details: ValidationDetail[] = [
      { field: 'payments', code: 'SPLIT_PAYMENT_MISMATCH', message: 'Mismatch' },
    ];

    expect(shortfallsFromDetails(details, items)).toEqual([]);
  });

  it('drops a detail naming a line the cart no longer has, rather than showing it nameless', () => {
    const items = [line({ product_id: 7, quantity: 1 })];
    const details = [detail({ productId: 999, variantId: null, requested: 1, available: 0 })];

    expect(shortfallsFromDetails(details, items)).toEqual([]);
  });

  it('drops a detail whose meta is missing or malformed rather than rendering NaN', () => {
    const items = [line({ product_id: 7, quantity: 1 })];

    expect(shortfallsFromDetails([detail(undefined)], items)).toEqual([]);
    expect(
      shortfallsFromDetails([detail({ productId: 7, requested: 'four', available: 1 })], items)
    ).toEqual([]);
  });
});

describe('planCartAdjustment for variant lines', () => {
  it('trims the variant line the server named and leaves the product line alone', () => {
    const items = [
      line({ product_id: 7, quantity: 2 }),
      line({ product_id: 7, variant_id: 3, quantity: 4 }),
    ];
    const shortfalls = [
      { productId: 7, variantId: 3, name: 'Silk Dress / M', requested: 4, available: 1 },
    ];

    expect(planCartAdjustment(items, shortfalls)).toEqual([
      { productId: 7, variantId: 3, quantity: 1 },
    ]);
  });
});
