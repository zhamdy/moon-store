import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore, sanitizeCartItem, type Product, type CartPersistedV0 } from './cartStore';

const mockProduct: Product = {
  id: 1,
  name: 'Silk Evening Dress',
  price: 500,
  stock: 10,
};

const mockProduct2: Product = {
  id: 2,
  name: 'Cotton Shirt',
  price: 200,
  stock: 5,
};

const mockVariantProduct: Product = {
  id: 1,
  name: 'Silk Evening Dress',
  price: 500,
  stock: 10,
  variant_id: 101,
  variant_attributes: { color: 'Red', size: 'M' },
};

beforeEach(() => {
  useCartStore.getState().clearCart();
});

describe('Cart - Add Items', () => {
  it('should add a new item to cart', () => {
    useCartStore.getState().addItem(mockProduct);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].product_id).toBe(1);
    expect(items[0].name).toBe('Silk Evening Dress');
    expect(items[0].unit_price).toBe(500);
    expect(items[0].quantity).toBe(1);
  });

  it('should increment quantity for duplicate item', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockProduct);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('should add multiple different items', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockProduct2);
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it('should treat same product with different variants as separate items', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockVariantProduct);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[1].name).toContain('Red / M');
  });

  it('should parse string prices correctly', () => {
    // The API types price as a number; the cast guards the parseFloat fallback
    // against legacy string payloads still sitting in the persisted cart.
    useCartStore.getState().addItem({ ...mockProduct, price: '499.99' as unknown as number });
    expect(useCartStore.getState().items[0].unit_price).toBe(499.99);
  });
});

describe('Cart - Remove Items', () => {
  it('should remove an item', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockProduct2);
    useCartStore.getState().removeItem(1);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].product_id).toBe(2);
  });

  it('should remove correct variant', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockVariantProduct);
    useCartStore.getState().removeItem(1, 101);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].variant_id).toBeNull();
  });
});

describe('Cart - Update Quantity', () => {
  it('should update item quantity', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().updateQuantity(1, 5);
    expect(useCartStore.getState().items[0].quantity).toBe(5);
  });

  it('should enforce minimum quantity of 1', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().updateQuantity(1, 0);
    expect(useCartStore.getState().items[0].quantity).toBe(1);

    useCartStore.getState().updateQuantity(1, -3);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });
});

describe('Cart - Subtotal & Total', () => {
  it('should calculate subtotal correctly', () => {
    useCartStore.getState().addItem(mockProduct); // 500
    useCartStore.getState().addItem(mockProduct2); // 200
    expect(useCartStore.getState().getSubtotal()).toBe(700);
  });

  it('should calculate subtotal with quantity', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().updateQuantity(1, 3);
    expect(useCartStore.getState().getSubtotal()).toBe(1500); // 500 * 3
  });

  it('should return 0 for empty cart', () => {
    expect(useCartStore.getState().getSubtotal()).toBe(0);
    expect(useCartStore.getState().getTotal()).toBe(0);
  });
});

describe('Cart - Fixed Discount', () => {
  it('should apply fixed discount', () => {
    useCartStore.getState().addItem(mockProduct); // 500
    useCartStore.getState().setDiscount(100);
    useCartStore.getState().setDiscountType('fixed');
    expect(useCartStore.getState().getTotal()).toBe(400);
  });

  it('should not go below zero with large discount', () => {
    useCartStore.getState().addItem(mockProduct2); // 200
    useCartStore.getState().setDiscount(500);
    useCartStore.getState().setDiscountType('fixed');
    expect(useCartStore.getState().getTotal()).toBe(0);
  });
});

describe('Cart - Percentage Discount', () => {
  it('should apply percentage discount', () => {
    useCartStore.getState().addItem(mockProduct); // 500
    useCartStore.getState().setDiscount(10);
    useCartStore.getState().setDiscountType('percentage');
    expect(useCartStore.getState().getTotal()).toBe(450); // 500 - 10%
  });

  it('should apply 100% discount', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().setDiscount(100);
    useCartStore.getState().setDiscountType('percentage');
    expect(useCartStore.getState().getTotal()).toBe(0);
  });
});

describe('Cart - Coupon Discount', () => {
  it('should apply coupon discount on top of regular discount', () => {
    useCartStore.getState().addItem(mockProduct); // 500
    useCartStore.getState().setDiscount(50);
    useCartStore.getState().setDiscountType('fixed');
    useCartStore.getState().setCoupon('SAVE20', 20);

    // 500 - 50 (fixed) - 20 (coupon) = 430
    expect(useCartStore.getState().getTotal()).toBe(430);
  });

  it('should clear coupon', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().setCoupon('SAVE20', 20);
    useCartStore.getState().clearCoupon();
    expect(useCartStore.getState().couponCode).toBe('');
    expect(useCartStore.getState().couponDiscount).toBe(0);
    expect(useCartStore.getState().getTotal()).toBe(500);
  });
});

describe('Cart - Clear', () => {
  it('should clear all cart state', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockProduct2);
    useCartStore.getState().setDiscount(10);
    useCartStore.getState().setDiscountType('percentage');
    useCartStore.getState().setNotes('Test');
    useCartStore.getState().setTip(50);
    useCartStore.getState().setCoupon('CODE', 20);

    useCartStore.getState().clearCart();

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.discount).toBe(0);
    expect(state.discountType).toBe('fixed');
    expect(state.notes).toBe('');
    expect(state.tip).toBe(0);
    expect(state.couponCode).toBe('');
    expect(state.couponDiscount).toBe(0);
  });
});

describe('Cart - Item Memo', () => {
  it('should set memo on item', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().setItemMemo(1, 'Gift wrap please');
    expect(useCartStore.getState().items[0].memo).toBe('Gift wrap please');
  });
});

describe('Cart - restoreFromHeld', () => {
  it('preserves variant identity, quantities and discount, and flags for review', () => {
    useCartStore.getState().restoreFromHeld({
      items: [
        {
          product_id: 1,
          variant_id: 101,
          name: 'Silk Dress (Red / M)',
          unit_price: 500,
          quantity: 3,
          stock: 10,
        },
        {
          product_id: 2,
          variant_id: null,
          name: 'Cotton Shirt',
          unit_price: 200,
          quantity: 1,
          stock: 5,
        },
      ],
      discount: 15,
      discountType: 'percentage',
      notes: 'Gift wrap',
      tip: 10,
      couponCode: 'STALE10',
    });

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(2);
    expect(state.items[0].variant_id).toBe(101);
    expect(state.items[0].quantity).toBe(3);
    expect(state.items[1].variant_id).toBeNull();
    expect(state.discount).toBe(15);
    expect(state.discountType).toBe('percentage');
    expect(state.notes).toBe('Gift wrap');
    expect(state.tip).toBe(10);
    expect(state.couponCode).toBe('STALE10');
    // A restored cart never trusts a cached coupon amount, and its financial
    // preview is flagged as needing recalculation/review before checkout.
    expect(state.couponDiscount).toBe(0);
    expect(state.needsReview).toBe(true);
  });
});

describe('Cart - acknowledgeReview', () => {
  it('clears the needsReview flag', () => {
    useCartStore.setState({ needsReview: true });
    useCartStore.getState().acknowledgeReview();
    expect(useCartStore.getState().needsReview).toBe(false);
  });

  it('clearCart also clears needsReview', () => {
    useCartStore.setState({ needsReview: true });
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().needsReview).toBe(false);
  });
});

describe('Cart - sanitizeCartItem', () => {
  it('drops a line with a non-finite or negative price', () => {
    expect(
      sanitizeCartItem({ product_id: 1, unit_price: Number.NaN, quantity: 1, stock: 5 })
    ).toBeNull();
    expect(sanitizeCartItem({ product_id: 1, unit_price: -10, quantity: 1, stock: 5 })).toBeNull();
  });

  it('drops a line with no identifiable product_id', () => {
    expect(
      sanitizeCartItem({ product_id: 'not-a-number', unit_price: 10, quantity: 1 })
    ).toBeNull();
  });

  it('preserves a legitimate $0 price', () => {
    const item = sanitizeCartItem({
      product_id: 5,
      unit_price: 0,
      quantity: 1,
      stock: 2,
      name: 'Free Sample',
    });
    expect(item?.unit_price).toBe(0);
  });

  it('clamps a non-finite or non-positive quantity to 1 without dropping the line', () => {
    expect(
      sanitizeCartItem({ product_id: 1, unit_price: 100, quantity: Number.NaN, stock: 5 })?.quantity
    ).toBe(1);
    expect(
      sanitizeCartItem({ product_id: 1, unit_price: 100, quantity: -3, stock: 5 })?.quantity
    ).toBe(1);
    expect(
      sanitizeCartItem({ product_id: 1, unit_price: 100, quantity: 0, stock: 5 })?.quantity
    ).toBe(1);
  });

  it('preserves an explicit null variant_id as null, not 0 or undefined', () => {
    const item = sanitizeCartItem({
      product_id: 1,
      variant_id: null,
      unit_price: 100,
      quantity: 1,
      stock: 5,
    });
    expect(item?.variant_id).toBeNull();
  });
});

describe('Cart persisted-state migration (v0 -> v1)', () => {
  const migrate = useCartStore.persist.getOptions().migrate as (
    persisted: unknown,
    version: number
  ) => ReturnType<typeof useCartStore.getState>;

  /**
   * CHARACTERIZATION: literal example of the exact JSON persisted at
   * `moon-cart-recovery` before this migration existed -- no `version` key,
   * no `needsReview` field. Taken from the pre-Unit-6 `partialize` shape in
   * this file's git history (a plain object with these exact keys), not
   * guessed.
   */
  const V0_FIXTURE: CartPersistedV0 = {
    items: [
      {
        product_id: 1,
        variant_id: 101,
        name: 'Silk Dress (Red / M)',
        unit_price: 500,
        quantity: 2,
        stock: 10,
      },
    ],
    discount: 10,
    discountType: 'fixed',
    notes: 'Ring gift-wrapped',
    tip: 25,
    couponCode: 'SAVE20',
    couponDiscount: 20,
    lastUpdated: Date.now(),
  };

  it('hydrates a literal pre-deployment active cart with items/discount/tip intact, flagged for review', () => {
    const migrated = migrate(V0_FIXTURE, 0);

    expect(migrated.items).toEqual([
      {
        product_id: 1,
        variant_id: 101,
        name: 'Silk Dress (Red / M)',
        unit_price: 500,
        quantity: 2,
        stock: 10,
      },
    ]);
    expect(migrated.discount).toBe(10);
    // Legacy `tip` stays `tip` -- never silently reinterpreted as a discount,
    // even though it may have been entered through the historical
    // mislabeled Quick Discount UI bug (see plan "Key Technical Decisions").
    expect(migrated.tip).toBe(25);
    expect(migrated.couponCode).toBe('SAVE20');
    // A cached coupon amount can never be trusted across a formula change.
    expect(migrated.couponDiscount).toBe(0);
    expect((migrated as unknown as { needsReview: boolean }).needsReview).toBe(true);
  });

  it('sanitizes corrupt/missing numeric fields without discarding otherwise-valid items', () => {
    const corrupt = {
      items: [
        { product_id: 1, unit_price: 500, quantity: 2, stock: 10, name: 'Valid' },
        { product_id: 2, unit_price: Number.NaN, quantity: 1, stock: 5, name: 'Bad price' },
        { product_id: 3, unit_price: -50, quantity: 1, stock: 5, name: 'Negative price' },
        { product_id: 4, unit_price: 100, quantity: -1, stock: 5, name: 'Bad quantity' },
      ],
      discount: Number.NaN,
      tip: undefined,
      lastUpdated: 'not-a-number',
    };

    const migrated = migrate(corrupt, 0);

    expect(migrated.items).toHaveLength(2); // "Bad price" and "Negative price" dropped
    expect(migrated.items.map((i) => i.name)).toEqual(['Valid', 'Bad quantity']);
    expect(migrated.items[1].quantity).toBe(1); // clamped, not dropped
    expect(migrated.discount).toBe(0);
    expect(migrated.tip).toBe(0);
  });

  it('does not flag an empty, never-used cart for review', () => {
    const migrated = migrate(
      { items: [], discount: 0, tip: 0, couponCode: '', couponDiscount: 0 },
      0
    );
    expect((migrated as unknown as { needsReview: boolean }).needsReview).toBe(false);
  });
});
