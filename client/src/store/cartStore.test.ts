import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore, type Product } from './cartStore';

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
    useCartStore.getState().addItem({ ...mockProduct, price: '499.99' });
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
