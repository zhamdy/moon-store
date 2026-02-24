import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  product_id: number;
  variant_id?: number | null;
  name: string;
  unit_price: number;
  quantity: number;
  stock: number;
  memo?: string;
}

export interface Product {
  id: number;
  name: string;
  price: string | number;
  stock: number;
  variant_id?: number | null;
  variant_attributes?: Record<string, string>;
}

export type DiscountType = 'fixed' | 'percentage';

interface CartState {
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  notes: string;
  tip: number;
  couponCode: string;
  couponDiscount: number;
  lastUpdated: number;
  addItem: (product: Product) => void;
  removeItem: (productId: number, variantId?: number | null) => void;
  updateQuantity: (productId: number, quantity: number, variantId?: number | null) => void;
  setItemMemo: (productId: number, memo: string, variantId?: number | null) => void;
  setDiscount: (discount: number) => void;
  setDiscountType: (discountType: DiscountType) => void;
  setNotes: (notes: string) => void;
  setTip: (tip: number) => void;
  setCoupon: (code: string, discount: number) => void;
  clearCoupon: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
  clearCart: () => void;
  isRecoveredCart: () => boolean;
}

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      discount: 0,
      discountType: 'fixed',
      notes: '',
      tip: 0,
      couponCode: '',
      couponDiscount: 0,
      lastUpdated: Date.now(),

      addItem: (product) =>
        set((state) => {
          const variantId = product.variant_id || null;
          const existing = state.items.find(
            (i) => i.product_id === product.id && (i.variant_id || null) === variantId
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product_id === product.id && (i.variant_id || null) === variantId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
              lastUpdated: Date.now(),
            };
          }
          const variantLabel = product.variant_attributes
            ? ` (${Object.values(product.variant_attributes).join(' / ')})`
            : '';
          return {
            items: [
              ...state.items,
              {
                product_id: product.id,
                variant_id: variantId,
                name: product.name + variantLabel,
                unit_price: parseFloat(String(product.price)),
                quantity: 1,
                stock: product.stock,
              },
            ],
            lastUpdated: Date.now(),
          };
        }),

      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.product_id === productId && (i.variant_id || null) === (variantId || null))
          ),
          lastUpdated: Date.now(),
        })),

      updateQuantity: (productId, quantity, variantId) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product_id === productId && (i.variant_id || null) === (variantId || null)
              ? { ...i, quantity: Math.max(1, quantity) }
              : i
          ),
          lastUpdated: Date.now(),
        })),

      setItemMemo: (productId, memo, variantId) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product_id === productId && (i.variant_id || null) === (variantId || null)
              ? { ...i, memo }
              : i
          ),
        })),

      setDiscount: (discount) => set({ discount }),
      setDiscountType: (discountType) => set({ discountType }),
      setNotes: (notes) => set({ notes }),
      setTip: (tip) => set({ tip }),
      setCoupon: (code, discount) => set({ couponCode: code, couponDiscount: discount }),
      clearCoupon: () => set({ couponCode: '', couponDiscount: 0 }),

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
      },

      getTotal: () => {
        const { items, discount, discountType, couponDiscount } = get();
        const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
        const discountAmount =
          discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
        return Math.max(0, subtotal - discountAmount - couponDiscount);
      },

      clearCart: () =>
        set({
          items: [],
          discount: 0,
          discountType: 'fixed',
          notes: '',
          tip: 0,
          couponCode: '',
          couponDiscount: 0,
          lastUpdated: Date.now(),
        }),

      isRecoveredCart: () => {
        const { items, lastUpdated } = get();
        return items.length > 0 && Date.now() - lastUpdated > 60000; // > 1 minute old
      },
    }),
    {
      name: 'moon-cart-recovery',
      partialize: (state) => ({
        items: state.items,
        discount: state.discount,
        discountType: state.discountType,
        notes: state.notes,
        tip: state.tip,
        couponCode: state.couponCode,
        couponDiscount: state.couponDiscount,
        lastUpdated: state.lastUpdated,
      }),
      onRehydrateStorage: () => (state) => {
        // Discard if older than 8 hours
        if (state && Date.now() - state.lastUpdated > EIGHT_HOURS) {
          state.items = [];
          state.discount = 0;
          state.discountType = 'fixed';
          state.notes = '';
          state.tip = 0;
          state.couponCode = '';
          state.couponDiscount = 0;
        }
      },
    }
  )
);
