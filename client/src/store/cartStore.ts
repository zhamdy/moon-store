import { create } from 'zustand';

export interface CartItem {
  product_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  stock: number;
}

export interface Product {
  id: number;
  name: string;
  price: string | number;
  stock: number;
}

export type DiscountType = 'fixed' | 'percentage';

interface CartState {
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  setDiscount: (discount: number) => void;
  setDiscountType: (discountType: DiscountType) => void;
  getSubtotal: () => number;
  getTotal: () => number;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  discount: 0,
  discountType: 'fixed',

  addItem: (product) =>
    set((state) => {
      const existing = state.items.find((i) => i.product_id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            product_id: product.id,
            name: product.name,
            unit_price: parseFloat(String(product.price)),
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
    const discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
    return Math.max(0, subtotal - discountAmount);
  },

  clearCart: () => set({ items: [], discount: 0, discountType: 'fixed' }),
}));
