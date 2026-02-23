import { create } from 'zustand';

export const useCartStore = create((set, get) => ({
  items: [],
  discount: 0,
  discountType: 'fixed', // 'fixed' or 'percentage'

  addItem: (product) =>
    set((state) => {
      const existing = state.items.find((i) => i.product_id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product_id === product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            product_id: product.id,
            name: product.name,
            unit_price: parseFloat(product.price),
            quantity: 1,
            stock: product.stock,
          },
        ],
      };
    }),

  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.product_id !== productId),
    })),

  updateQuantity: (productId, quantity) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.product_id === productId ? { ...i, quantity: Math.max(1, quantity) } : i
      ),
    })),

  setDiscount: (discount) => set({ discount }),
  setDiscountType: (discountType) => set({ discountType }),

  getSubtotal: () => {
    const { items } = get();
    return items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  },

  getTotal: () => {
    const { items, discount, discountType } = get();
    const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const discountAmount =
      discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
    return Math.max(0, subtotal - discountAmount);
  },

  clearCart: () => set({ items: [], discount: 0, discountType: 'fixed' }),
}));
