import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HELD_CARTS_STORAGE_KEY } from '../../../shared/lib/storageKeys';
import {
  sanitizeCartItem,
  sanitizeFiniteNumber,
  type CartItem,
  type DiscountType,
} from './cartStore';

export interface HeldCart {
  id: string;
  name: string;
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  notes: string;
  tip: number;
  couponCode: string;
  createdAt: string;
}

interface HeldCartsState {
  carts: HeldCart[];
  holdCart: (
    name: string,
    items: CartItem[],
    discount: number,
    discountType: DiscountType,
    extras?: { notes?: string; tip?: number; couponCode?: string }
  ) => void;
  /**
   * Non-destructive lookup -- does NOT remove the held cart. The caller
   * (HeldCartsDialog) must call `deleteCart` itself once the transfer back
   * into the active cart has actually succeeded, so a cart is never dropped
   * from storage before its contents are safely somewhere else.
   */
  retrieveCart: (id: string) => HeldCart | undefined;
  deleteCart: (id: string) => void;
}

/**
 * Held-cart persisted-state schema version. See cartStore.ts's
 * `CART_SCHEMA_VERSION` for the same rationale -- held carts historically did
 * NOT store `notes`/`tip`/`couponCode` at all (see Unit 6 plan notes).
 */
const HELD_CARTS_SCHEMA_VERSION = 1;

/**
 * CHARACTERIZATION: the exact shape persisted at `HELD_CARTS_STORAGE_KEY`
 * before this migration existed -- no `notes`/`tip`/`couponCode` fields, and
 * no `version` (so an unversioned stored blob is treated as version 0).
 * Captured from the pre-Unit-6 `HeldCart` interface in this file's git
 * history. Reused by heldCartsStore.test.ts.
 */
export interface HeldCartV0 {
  id: string;
  name: string;
  items: unknown;
  discount: unknown;
  discountType: unknown;
  createdAt: string;
}

interface HeldCartsPersistedV1 {
  carts: HeldCart[];
}

/**
 * v0 -> v1 per-cart migration: sanitizes items the same way an active-cart
 * recovery does (drop an unusable/negative-priced line, clamp a bad quantity
 * to 1, preserve a $0 price and explicit-null variant identity), and
 * initializes the newly-required `notes`/`tip`/`couponCode` fields to their
 * empty defaults -- there is no legacy value to carry forward for a held
 * cart that never stored them, so this is initialization, not a semantic
 * reinterpretation of anything.
 */
function migrateHeldCartV0toV1(raw: unknown): HeldCart | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return null;

  const rawItems = Array.isArray(r.items) ? r.items : [];
  const items = rawItems.map(sanitizeCartItem).filter((item): item is CartItem => item !== null);

  return {
    id: r.id,
    name: r.name,
    items,
    discount: sanitizeFiniteNumber(r.discount, 0),
    discountType: r.discountType === 'percentage' ? 'percentage' : 'fixed',
    notes: typeof r.notes === 'string' ? r.notes : '',
    tip: sanitizeFiniteNumber(r.tip, 0),
    couponCode: typeof r.couponCode === 'string' ? r.couponCode : '',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
  };
}

export const useHeldCartsStore = create<HeldCartsState>()(
  persist(
    (set, get) => ({
      carts: [],

      holdCart: (name, items, discount, discountType, extras) =>
        set((state) => ({
          carts: [
            ...state.carts,
            {
              id: String(Date.now()),
              name,
              items,
              discount,
              discountType,
              notes: extras?.notes ?? '',
              tip: extras?.tip ?? 0,
              couponCode: extras?.couponCode ?? '',
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      retrieveCart: (id) => get().carts.find((c) => c.id === id),

      deleteCart: (id) =>
        set((state) => ({
          carts: state.carts.filter((c) => c.id !== id),
        })),
    }),
    {
      name: HELD_CARTS_STORAGE_KEY,
      version: HELD_CARTS_SCHEMA_VERSION,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as { carts?: unknown };
        const rawCarts = Array.isArray(state.carts) ? state.carts : [];
        const carts = rawCarts.map(migrateHeldCartV0toV1).filter((c): c is HeldCart => c !== null);
        return { carts } satisfies HeldCartsPersistedV1;
      },
    }
  )
);
