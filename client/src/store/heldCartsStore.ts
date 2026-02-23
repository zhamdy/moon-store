import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, DiscountType } from './cartStore';

export interface HeldCart {
  id: string;
  name: string;
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  createdAt: string;
}

interface HeldCartsState {
  carts: HeldCart[];
  holdCart: (name: string, items: CartItem[], discount: number, discountType: DiscountType) => void;
  retrieveCart: (id: string) => HeldCart | undefined;
  deleteCart: (id: string) => void;
}

export const useHeldCartsStore = create<HeldCartsState>()(
  persist(
    (set, get) => ({
      carts: [],

      holdCart: (name, items, discount, discountType) =>
        set((state) => ({
          carts: [
            ...state.carts,
            {
              id: String(Date.now()),
              name,
              items,
              discount,
              discountType,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      retrieveCart: (id) => {
        const cart = get().carts.find((c) => c.id === id);
        if (cart) {
          set((state) => ({
            carts: state.carts.filter((c) => c.id !== id),
          }));
        }
        return cart;
      },

      deleteCart: (id) =>
        set((state) => ({
          carts: state.carts.filter((c) => c.id !== id),
        })),
    }),
    {
      name: 'moon-held-carts',
    }
  )
);
