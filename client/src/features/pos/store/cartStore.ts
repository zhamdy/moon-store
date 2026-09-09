import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CART_RECOVERY_STORAGE_KEY } from '../../../shared/lib/storageKeys';
import type { Product as ServerProduct } from '../../../shared/types/index';

export interface CartItem {
  product_id: number;
  variant_id?: number | null;
  name: string;
  unit_price: number;
  quantity: number;
  stock: number;
  memo?: string;
  /**
   * The bundle this line came from. Sent to the server, which re-derives the
   * allocation itself -- the prices computed here are for the cashier's screen, and the
   * server has no other way to tell a bundle member from a loose line of the same
   * product (#124).
   */
  bundle_id?: number | null;
}

/** addItem input: the product columns the cart needs, plus POS-side variant selection */
export type Product = Pick<ServerProduct, 'id' | 'name' | 'price' | 'stock'> & {
  variant_id?: number | null;
  variant_attributes?: Record<string, string>;
};

/**
 * Whether a cart line is the one an action names. Product and variant are not enough
 * since #124: a product can be in the cart twice, once loose and once as a member of a
 * bundle, at different prices. `bundleId` left undefined means the loose line, which is
 * what every pre-bundle call site meant and still means.
 */
export function isSameLine(
  line: CartItem,
  productId: number,
  variantId?: number | null,
  bundleId?: number | null
): boolean {
  return (
    line.product_id === productId &&
    (line.variant_id || null) === (variantId || null) &&
    (line.bundle_id || null) === (bundleId || null)
  );
}

export interface BundleForCart {
  id: number;
  name: string;
  price: number;
  items: {
    product_id: number;
    product_name: string;
    product_price: number;
    quantity: number;
    stock: number;
  }[];
}

export type DiscountType = 'fixed' | 'percentage';

/**
 * A cart carried over from a held cart, or hydrated from an older persisted
 * shape. `couponDiscount` is deliberately absent -- a recovered/restored cart
 * never carries a cached money amount forward as authoritative; the coupon
 * discount must always be revalidated (see Unit 6 plan notes on cartStore.ts).
 */
export interface RestorableCart {
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  notes?: string;
  tip?: number;
  couponCode?: string;
}

interface CartState {
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  notes: string;
  tip: number;
  couponCode: string;
  couponDiscount: number;
  lastUpdated: number;
  /**
   * True for a cart hydrated from persisted storage (recovery or held-cart
   * restore) whose financial preview has not yet been confirmed by the
   * cashier for THIS session -- e.g. a cleared `couponDiscount` that needs
   * re-applying, or values carried over from a schema version predating this
   * flag. Cleared by `acknowledgeReview()` and by `clearCart()`/normal cart
   * edits are NOT required to clear it automatically, since the underlying
   * financial preview is still unconfirmed until the cashier acts.
   */
  needsReview: boolean;
  /**
   * The idempotency key for the checkout currently being attempted, paired with a
   * fingerprint of the payload it was minted for. Persisted with the cart because a till
   * that reloads mid-checkout must retry under the SAME key — otherwise the server sees
   * an unrelated request and rings the sale up twice, which is the exact failure the key
   * exists to prevent. Null whenever no attempt is in flight.
   */
  checkoutAttempt: { fingerprint: string; key: string } | null;
  setCheckoutAttempt: (attempt: { fingerprint: string; key: string } | null) => void;
  addItem: (product: Product) => void;
  addBundle: (bundle: BundleForCart) => void;
  // `bundleId` completes the line's identity; omitted means the loose line.
  removeItem: (productId: number, variantId?: number | null, bundleId?: number | null) => void;
  updateQuantity: (
    productId: number,
    quantity: number,
    variantId?: number | null,
    bundleId?: number | null
  ) => void;
  setItemMemo: (
    productId: number,
    memo: string,
    variantId?: number | null,
    bundleId?: number | null
  ) => void;
  setDiscount: (discount: number) => void;
  setDiscountType: (discountType: DiscountType) => void;
  setNotes: (notes: string) => void;
  setTip: (tip: number) => void;
  setCoupon: (code: string, discount: number) => void;
  clearCoupon: () => void;
  clearCart: () => void;
  isRecoveredCart: () => boolean;
  /**
   * Replace the active cart with a held cart's contents (or any other
   * previously-persisted cart). `couponDiscount` is always reset to 0 and
   * `needsReview` is always set -- a restored cart's cached financial
   * preview must be recalculated/revalidated before checkout, never
   * displayed as final. See HeldCartsDialog.tsx.
   */
  restoreFromHeld: (cart: RestorableCart) => void;
  /** Cashier has reviewed a recovered/restored cart's contents; clear the review flag. */
  acknowledgeReview: () => void;
}

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

/**
 * Cart persisted-state schema version. Bumped whenever the shape of what we
 * write to `CART_RECOVERY_STORAGE_KEY` changes in a way that requires
 * migrating already-persisted browser state (see `migrate` below and Unit 6
 * of docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md).
 */
const CART_SCHEMA_VERSION = 1;

/**
 * CHARACTERIZATION: the exact shape persisted at `CART_RECOVERY_STORAGE_KEY`
 * before this migration existed (no `version` field at all -- zustand's
 * `persist` treats an unversioned stored blob as version 0). Captured from
 * the pre-Unit-6 `partialize`/`onRehydrateStorage` in this file's git
 * history, not guessed. Reused by cartStore.test.ts.
 */
export interface CartPersistedV0 {
  items?: unknown;
  discount?: unknown;
  discountType?: unknown;
  notes?: unknown;
  tip?: unknown;
  couponCode?: unknown;
  couponDiscount?: unknown;
  lastUpdated?: unknown;
}

export function sanitizeFiniteNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * v0 -> v1 per-item migration. A line with an unusable identity or a
 * negative/non-finite price is DROPPED (a fabricated price would misstate
 * what the customer owes far worse than losing one stale line); a bad
 * quantity is clamped to the minimum valid quantity of 1 rather than
 * dropping an otherwise-good, correctly-priced line. A price of exactly 0
 * (a legitimately free item) is preserved, never treated as "missing".
 * `variant_id`'s null vs. absent identity is preserved as an explicit null.
 */
export function sanitizeCartItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const productId = Number(r.product_id);
  if (!Number.isFinite(productId)) return null;

  const unitPrice = typeof r.unit_price === 'number' ? r.unit_price : Number(r.unit_price);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;

  const rawQuantity =
    typeof r.quantity === 'number' ? r.quantity : Number(r.quantity ?? Number.NaN);
  const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.floor(rawQuantity) : 1;

  const variantId =
    r.variant_id === null || r.variant_id === undefined
      ? null
      : sanitizeFiniteNumber(r.variant_id, 0);

  // Preserved through rehydration: a cart restored from localStorage that lost its
  // bundle tagging would check out at catalog prices, which is the whole of #124 again
  // for exactly the carts a till reload is most likely to produce.
  const bundleId =
    r.bundle_id === null || r.bundle_id === undefined
      ? null
      : sanitizeFiniteNumber(r.bundle_id, 0) || null;

  return {
    product_id: productId,
    variant_id: variantId,
    name: typeof r.name === 'string' ? r.name : '',
    unit_price: unitPrice,
    quantity,
    stock: sanitizeFiniteNumber(r.stock, 0),
    ...(bundleId ? { bundle_id: bundleId } : {}),
    ...(typeof r.memo === 'string' && r.memo ? { memo: r.memo } : {}),
  };
}

interface CartPersistedV1 {
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  notes: string;
  tip: number;
  couponCode: string;
  couponDiscount: number;
  lastUpdated: number;
  needsReview: boolean;
}

/**
 * v0 -> v1 migration, applied once per browser on first load after this
 * deploy. Field-by-field mapping (see Unit 6 plan):
 * - items: sanitized per `sanitizeCartItem` above; invalid lines are DROPPED,
 *   never silently zeroed into a "free" item.
 * - discount/discountType: numeric-sanitized / defaulted to 'fixed'; the
 *   discount VALUE is preserved as-is (never reinterpreted).
 * - notes: preserved verbatim (string or '').
 * - tip: preserved AS `tip`, verbatim -- even though a real historical UI bug
 *   let Quick Discount write into this field, we do NOT know which meaning
 *   any given persisted value has, so it is never auto-converted into a
 *   discount (see plan "Scope Boundaries"/"Key Technical Decisions"). Unit 5
 *   owns clarifying the UI; this migration only owns not destroying data.
 * - couponCode: preserved (still a valid identifier to re-validate).
 * - couponDiscount: ALWAYS reset to 0 -- a cached discount amount can never
 *   be trusted across a deploy that changed the calculation formula (Units
 *   1-4), so it must be revalidated via a fresh coupon lookup.
 * - needsReview: set `true` whenever the recovered cart had any content
 *   (items, tip, or discount), so the cashier is prompted to confirm the
 *   recovered state before checking out.
 */
function migrateCartV0toV1(persisted: CartPersistedV0): CartPersistedV1 {
  const rawItems = Array.isArray(persisted.items) ? persisted.items : [];
  const items = rawItems.map(sanitizeCartItem).filter((item): item is CartItem => item !== null);

  const discount = sanitizeFiniteNumber(persisted.discount, 0);
  const tip = sanitizeFiniteNumber(persisted.tip, 0);
  const hadContent = rawItems.length > 0 || discount !== 0 || tip !== 0;

  return {
    items,
    discount,
    discountType: persisted.discountType === 'percentage' ? 'percentage' : 'fixed',
    notes: typeof persisted.notes === 'string' ? persisted.notes : '',
    tip,
    couponCode: typeof persisted.couponCode === 'string' ? persisted.couponCode : '',
    couponDiscount: 0,
    lastUpdated: sanitizeFiniteNumber(persisted.lastUpdated, Date.now()),
    needsReview: hadContent,
  };
}

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
      needsReview: false,
      checkoutAttempt: null,

      setCheckoutAttempt: (attempt) => set({ checkoutAttempt: attempt }),

      addItem: (product) =>
        set((state) => {
          const variantId = product.variant_id || null;
          // Scanning a product that is already in the cart as part of a bundle adds a
          // separate loose line rather than incrementing the bundle's. Folding it in
          // would charge the loose unit the bundle's discounted allocation, and would
          // break the group against its definition when the server re-checks it (#124).
          const existing = state.items.find((i) => isSameLine(i, product.id, variantId));
          if (existing) {
            return {
              items: state.items.map((i) =>
                isSameLine(i, product.id, variantId) ? { ...i, quantity: i.quantity + 1 } : i
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

      addBundle: (bundle) =>
        set((state) => {
          const originalTotal = bundle.items.reduce(
            (sum, item) => sum + item.product_price * item.quantity,
            0
          );
          const newItems = [...state.items];

          for (const item of bundle.items) {
            // Proportional price: (item_original / total_original) * bundle_price
            const proportion =
              originalTotal > 0
                ? (item.product_price * item.quantity) / originalTotal
                : 1 / bundle.items.length;
            const adjustedUnitPrice = (proportion * bundle.price) / item.quantity;

            // Only another line of the SAME bundle merges. A loose line of the same
            // product must stay separate: the server validates a bundle group against
            // its definition, so folding a loose unit into it would both fail that
            // check and price the loose unit at the bundle's discount.
            const existing = newItems.find((i) => isSameLine(i, item.product_id, null, bundle.id));
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              newItems.push({
                product_id: item.product_id,
                name: item.product_name,
                unit_price: Math.round(adjustedUnitPrice * 100) / 100,
                quantity: item.quantity,
                stock: item.stock,
                memo: `[${bundle.name}]`,
                bundle_id: bundle.id,
              });
            }
          }

          return { items: newItems, lastUpdated: Date.now() };
        }),

      removeItem: (productId, variantId, bundleId) =>
        set((state) => ({
          items: state.items.filter((i) => !isSameLine(i, productId, variantId, bundleId)),
          lastUpdated: Date.now(),
        })),

      updateQuantity: (productId, quantity, variantId, bundleId) =>
        set((state) => ({
          items: state.items.map((i) =>
            isSameLine(i, productId, variantId, bundleId)
              ? { ...i, quantity: Math.max(1, quantity) }
              : i
          ),
          lastUpdated: Date.now(),
        })),

      setItemMemo: (productId, memo, variantId, bundleId) =>
        set((state) => ({
          items: state.items.map((i) =>
            isSameLine(i, productId, variantId, bundleId) ? { ...i, memo } : i
          ),
        })),

      setDiscount: (discount) => set({ discount }),
      setDiscountType: (discountType) => set({ discountType }),
      setNotes: (notes) => set({ notes }),
      setTip: (tip) => set({ tip }),
      setCoupon: (code, discount) => set({ couponCode: code, couponDiscount: discount }),
      clearCoupon: () => set({ couponCode: '', couponDiscount: 0 }),

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
          needsReview: false,
          // A committed or queued sale must never lend its key to the next one.
          checkoutAttempt: null,
        }),

      isRecoveredCart: () => {
        const { items, lastUpdated } = get();
        return items.length > 0 && Date.now() - lastUpdated > 60000; // > 1 minute old
      },

      restoreFromHeld: (cart) =>
        set({
          items: cart.items,
          discount: cart.discount,
          discountType: cart.discountType,
          notes: cart.notes ?? '',
          tip: cart.tip ?? 0,
          couponCode: cart.couponCode ?? '',
          // Never trust a cached coupon amount from a held/restored cart --
          // it must be revalidated before checkout, same as a v0->v1 recovery.
          couponDiscount: 0,
          needsReview: true,
          lastUpdated: Date.now(),
          // A restored held cart is a different checkout attempt.
          checkoutAttempt: null,
        }),

      acknowledgeReview: () => set({ needsReview: false }),
    }),
    {
      name: CART_RECOVERY_STORAGE_KEY,
      version: CART_SCHEMA_VERSION,
      partialize: (state) => ({
        items: state.items,
        discount: state.discount,
        discountType: state.discountType,
        notes: state.notes,
        tip: state.tip,
        couponCode: state.couponCode,
        couponDiscount: state.couponDiscount,
        lastUpdated: state.lastUpdated,
        needsReview: state.needsReview,
        // Additive and safely absent: a blob persisted before this shipped simply has no
        // key and falls back to the initial null, so no schema migration is needed.
        checkoutAttempt: state.checkoutAttempt,
      }),
      migrate: (persistedState) => {
        // Any stored version below CART_SCHEMA_VERSION is v0 -- this is the
        // only migration step that exists so far, so no per-version branching
        // is needed yet. Add a v1->v2 step here (not a rewrite of this one)
        // the next time the schema changes.
        return migrateCartV0toV1((persistedState ?? {}) as CartPersistedV0);
      },
      onRehydrateStorage: () => (state) => {
        // Discard if older than 8 hours regardless of schema version.
        if (state && Date.now() - state.lastUpdated > EIGHT_HOURS) {
          state.items = [];
          state.discount = 0;
          state.discountType = 'fixed';
          state.notes = '';
          state.tip = 0;
          state.couponCode = '';
          state.couponDiscount = 0;
          state.needsReview = false;
        }
      },
    }
  )
);
