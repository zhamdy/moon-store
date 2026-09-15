import { useSyncExternalStore } from 'react';
import { CART_STORAGE_KEY } from '../constants';
import {
  addLine,
  applyCanonical,
  clearLines,
  cartLineKey,
  removeLine,
  restoreLine,
  setLineQuantity,
  type AddResult,
  type CartLine,
  type CartLineIdentity,
  type CartOptions,
} from '../utils/cart-lines';
import {
  browserCartStorage,
  readCart,
  serializeCart,
  writeCart,
  type GetCartStorage,
} from '../utils/cart-storage';
import type { BagLineHint } from '../utils/reconcile';

/**
 * The bag's module-level external store (CD-8): the header badge, Add to Bag, the drawer
 * and the bag page are separate islands sharing one state with no provider.
 *
 * The server snapshot is "not hydrated": SSR never pretends to know the bag. The first
 * client subscription reads storage and notifies, so every subscriber moves to the hydrated
 * snapshot without a mutation. Session state (drawer, previous prices, announced quote keys)
 * lives here too and is never persisted.
 */

export type CartSnapshot =
  | { readonly hydrated: false }
  | { readonly hydrated: true; readonly lines: readonly CartLine[] };

/** Opened only by the header Bag link; Add to Bag raises a toast instead (owner, 2026-09-15). */
export interface DrawerState {
  readonly open: boolean;
}

export interface CartSession {
  readonly drawer: DrawerState;
  /** Last quoted unit price per line key, for the in-session "Price updated" notice (CD-16). */
  readonly previousPrices: ReadonlyMap<string, number>;
  /**
   * Line key → the quote key that found its price change. The notice shows while that quote
   * is on screen; `previousPrices` alone would lose it on the next render.
   */
  readonly priceUpdates: ReadonlyMap<string, string>;
  /** Quote keys whose issues were already announced this session. */
  readonly announcedQuoteKeys: ReadonlySet<string>;
  /** Line key -> the Add to Bag hint (name, image, unit price); dropped with its line. */
  readonly hints: ReadonlyMap<string, BagLineHint>;
}

export interface RestoreInput {
  /** The line as it was stored when removed. */
  line: CartLine;
  /** Its index in store order at removal. */
  index: number;
  /** Its Add to Bag hint, if it had one. */
  hint?: BagLineHint;
}

export interface AddInput {
  /** Pieces to add, normalised by `addLine` to 1..10; default 1. */
  quantity?: number;
  /** Kept in memory for an added or merged line; never written to storage. */
  hint?: BagLineHint;
}

export interface CartActions {
  add(identity: CartLineIdentity, input?: AddInput): AddResult;
  setQuantity(key: string, quantity: number): void;
  remove(key: string): void;
  /** Undo for Remove: the line back at its index, with its quantity and hint; a no-op if present. */
  restore(input: RestoreInput): void;
  clear(): void;
  applyCanonical(key: string, canonicalOptions: CartOptions): void;
  openDrawer(): void;
  closeDrawer(): void;
  rememberPrices(prices: Readonly<Record<string, number>>): void;
  /** Pins each line key's "Price updated" notice to the quote key that found the change. */
  markPriceUpdates(updates: Readonly<Record<string, string>>): void;
  markQuoteAnnounced(quoteKey: string): void;
}

export interface CartStore extends CartActions {
  subscribe(listener: () => void): () => void;
  getSnapshot(): CartSnapshot;
  getServerSnapshot(): CartSnapshot;
  getSession(): CartSession;
}

const NOT_HYDRATED: CartSnapshot = { hydrated: false };

const CLOSED_DRAWER: DrawerState = { open: false };
const OPEN_DRAWER: DrawerState = { open: true };

export function createCartStore(getStorage: GetCartStorage = browserCartStorage): CartStore {
  let snapshot: CartSnapshot = NOT_HYDRATED;
  let session: CartSession = {
    drawer: CLOSED_DRAWER,
    previousPrices: new Map(),
    priceUpdates: new Map(),
    announcedQuoteKeys: new Set(),
    hints: new Map(),
  };
  const listeners = new Set<() => void>();
  let detachStorageEvents: (() => void) | null = null;

  const notify = () => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const currentLines = (): readonly CartLine[] => (snapshot.hydrated ? snapshot.lines : []);

  /** Adopts what storage holds; a failed read keeps the in-memory bag. Returns whether it changed. */
  const syncFromStorage = (): boolean => {
    const result = readCart(getStorage);
    if (!result.ok) {
      if (snapshot.hydrated) {
        return false;
      }
      snapshot = { hydrated: true, lines: [] };
      return true;
    }
    if (snapshot.hydrated && serializeCart(snapshot.lines) === serializeCart(result.lines)) {
      return false;
    }
    snapshot = { hydrated: true, lines: result.lines };
    return true;
  };

  const ensureHydrated = () => {
    if (!snapshot.hydrated) {
      syncFromStorage();
    }
  };

  /** Pure reducer → storage write (failure keeps memory) → notify. */
  const commit = (next: readonly CartLine[]) => {
    if (snapshot.hydrated && next === snapshot.lines) {
      return;
    }
    snapshot = { hydrated: true, lines: next };
    writeCart(getStorage, next);
    notify();
  };

  const attachStorageEvents = () => {
    if (typeof window === 'undefined') {
      return;
    }
    const onStorage = (event: StorageEvent) => {
      // `key === null` is another tab calling `localStorage.clear()`.
      if (event.key !== CART_STORAGE_KEY && event.key !== null) {
        return;
      }
      if (syncFromStorage()) {
        notify();
      }
    };
    window.addEventListener('storage', onStorage);
    detachStorageEvents = () => window.removeEventListener('storage', onStorage);
  };

  const setSession = (next: CartSession) => {
    session = next;
    notify();
  };

  /** Rewrites hints without notifying: the line commit that follows notifies once. */
  const updateHints = (change: (hints: Map<string, BagLineHint>) => void) => {
    const hints = new Map(session.hints);
    change(hints);
    session = { ...session, hints };
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        // First subscriber (or the first after all left): read storage, since another tab may
        // have written while nobody listened, then notify so snapshots move to hydrated.
        attachStorageEvents();
        if (syncFromStorage()) {
          notify();
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && detachStorageEvents) {
          detachStorageEvents();
          detachStorageEvents = null;
        }
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => NOT_HYDRATED,
    getSession: () => session,

    add(identity, { quantity, hint } = {}) {
      ensureHydrated();
      const result = addLine(currentLines(), identity, quantity);
      if (hint && result.addedQuantity > 0) {
        updateHints((hints) => hints.set(result.key, hint));
      }
      commit(result.lines);
      return result;
    },
    setQuantity(key, quantity) {
      ensureHydrated();
      commit(setLineQuantity(currentLines(), key, quantity));
    },
    remove(key) {
      ensureHydrated();
      if (session.hints.has(key)) updateHints((hints) => hints.delete(key));
      commit(removeLine(currentLines(), key));
    },
    restore({ line, index, hint }) {
      ensureHydrated();
      const lines = currentLines();
      const next = restoreLine(lines, line, index);
      if (next === lines) return;
      if (hint) updateHints((hints) => hints.set(cartLineKey(line), hint));
      commit(next);
    },
    clear() {
      ensureHydrated();
      if (session.hints.size > 0) updateHints((hints) => hints.clear());
      if (currentLines().length > 0) {
        commit(clearLines());
      }
    },
    applyCanonical(key, canonicalOptions) {
      ensureHydrated();
      // A rewrite follows a settled quote, so the line is already named by it.
      if (session.hints.has(key)) updateHints((hints) => hints.delete(key));
      commit(applyCanonical(currentLines(), key, canonicalOptions));
    },

    openDrawer() {
      if (!session.drawer.open) {
        setSession({ ...session, drawer: OPEN_DRAWER });
      }
    },
    closeDrawer() {
      if (session.drawer.open) {
        setSession({ ...session, drawer: CLOSED_DRAWER });
      }
    },
    rememberPrices(prices) {
      const entries = Object.entries(prices);
      if (entries.every(([key, price]) => session.previousPrices.get(key) === price)) {
        return;
      }
      const previousPrices = new Map(session.previousPrices);
      for (const [key, price] of entries) {
        previousPrices.set(key, price);
      }
      setSession({ ...session, previousPrices });
    },
    markPriceUpdates(updates) {
      const entries = Object.entries(updates);
      if (entries.every(([key, quoteKey]) => session.priceUpdates.get(key) === quoteKey)) {
        return;
      }
      const priceUpdates = new Map(session.priceUpdates);
      for (const [key, quoteKey] of entries) {
        priceUpdates.set(key, quoteKey);
      }
      setSession({ ...session, priceUpdates });
    },
    markQuoteAnnounced(quoteKey) {
      if (session.announcedQuoteKeys.has(quoteKey)) {
        return;
      }
      setSession({
        ...session,
        announcedQuoteKeys: new Set(session.announcedQuoteKeys).add(quoteKey),
      });
    },
  };
}

/** The one browser bag. Creating it touches no browser API. */
export const cartStore = createCartStore();

const cartActions: CartActions = {
  add: cartStore.add,
  setQuantity: cartStore.setQuantity,
  remove: cartStore.remove,
  restore: cartStore.restore,
  clear: cartStore.clear,
  applyCanonical: cartStore.applyCanonical,
  openDrawer: cartStore.openDrawer,
  closeDrawer: cartStore.closeDrawer,
  rememberPrices: cartStore.rememberPrices,
  markPriceUpdates: cartStore.markPriceUpdates,
  markQuoteAnnounced: cartStore.markQuoteAnnounced,
};

/** `{ hydrated: false }` on the server and during hydration, then the stored lines. */
export function useCartLines(): CartSnapshot {
  return useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot
  );
}

/** Session state: the drawer, prices, announced quote keys and hints. Never persisted. */
export function useCartSession(): CartSession {
  return useSyncExternalStore(cartStore.subscribe, cartStore.getSession, cartStore.getSession);
}

/** Stable across renders; safe in effect dependency lists. */
export function useCartActions(): CartActions {
  return cartActions;
}
