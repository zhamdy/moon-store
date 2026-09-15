import { useSyncExternalStore } from 'react';
import { CART_STORAGE_KEY } from '../constants';
import {
  addLine,
  applyCanonical,
  clearLines,
  removeLine,
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

export type DrawerMode = 'browse' | 'added';

export interface DrawerState {
  readonly open: boolean;
  readonly mode: DrawerMode;
  /** The line to scroll into view in an `added` or capped opening. */
  readonly addedKey: string | null;
  /** The description fixed at open (CD-13); `null` for a plain browse opening. */
  readonly description: string | null;
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
}

export interface OpenDrawerInput {
  mode?: DrawerMode;
  addedKey?: string | null;
  description?: string | null;
}

export interface CartActions {
  add(identity: CartLineIdentity): AddResult;
  setQuantity(key: string, quantity: number): void;
  remove(key: string): void;
  clear(): void;
  applyCanonical(key: string, canonicalOptions: CartOptions): void;
  openDrawer(input?: OpenDrawerInput): void;
  closeDrawer(): void;
  /** Ends an `added` opening at the first bag interaction; keeps the drawer open. */
  browseDrawer(): void;
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

const CLOSED_DRAWER: DrawerState = {
  open: false,
  mode: 'browse',
  addedKey: null,
  description: null,
};

export function createCartStore(getStorage: GetCartStorage = browserCartStorage): CartStore {
  let snapshot: CartSnapshot = NOT_HYDRATED;
  let session: CartSession = {
    drawer: CLOSED_DRAWER,
    previousPrices: new Map(),
    priceUpdates: new Map(),
    announcedQuoteKeys: new Set(),
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

    add(identity) {
      ensureHydrated();
      const result = addLine(currentLines(), identity);
      commit(result.lines);
      return result;
    },
    setQuantity(key, quantity) {
      ensureHydrated();
      commit(setLineQuantity(currentLines(), key, quantity));
    },
    remove(key) {
      ensureHydrated();
      commit(removeLine(currentLines(), key));
    },
    clear() {
      ensureHydrated();
      if (currentLines().length > 0) {
        commit(clearLines());
      }
    },
    applyCanonical(key, canonicalOptions) {
      ensureHydrated();
      commit(applyCanonical(currentLines(), key, canonicalOptions));
    },

    openDrawer({ mode = 'browse', addedKey = null, description = null } = {}) {
      setSession({ ...session, drawer: { open: true, mode, addedKey, description } });
    },
    closeDrawer() {
      if (session.drawer.open) {
        setSession({ ...session, drawer: CLOSED_DRAWER });
      }
    },
    browseDrawer() {
      const { drawer } = session;
      if (drawer.mode !== 'browse' || drawer.description !== null || drawer.addedKey !== null) {
        setSession({
          ...session,
          drawer: { ...drawer, mode: 'browse', addedKey: null, description: null },
        });
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
  clear: cartStore.clear,
  applyCanonical: cartStore.applyCanonical,
  openDrawer: cartStore.openDrawer,
  closeDrawer: cartStore.closeDrawer,
  browseDrawer: cartStore.browseDrawer,
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

/** Session state: the drawer, previous prices and announced quote keys. Never persisted. */
export function useCartSession(): CartSession {
  return useSyncExternalStore(cartStore.subscribe, cartStore.getSession, cartStore.getSession);
}

/** Stable across renders; safe in effect dependency lists. */
export function useCartActions(): CartActions {
  return cartActions;
}
