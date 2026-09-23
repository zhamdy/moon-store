// @vitest-environment jsdom
/**
 * MED-9: cross-tab sync was the one store path with no coverage at all. The suite is
 * deliberately DOM-free and a `storage` event needs a window, so the documented
 * last-write-wins rule, the `key === null` clear, and — the part most likely to break
 * silently — the subscribe/unsubscribe listener lifecycle were all unasserted. A lost
 * listener after a route change that unmounts every bag surface would have shipped green.
 *
 * jsdom is opted into per file (MED-7's harness), so the pure suites keep their
 * environment.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { CART_STORAGE_KEY } from '../constants';
import { serializeCart } from '../utils/cart-storage';
import { createCartStore } from './cart-store';
import type { CartLine } from '../utils/cart-lines';

const dress: CartLine = { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 1 };
const tote: CartLine = { slug: 'leather-tote', options: {}, quantity: 2 };

/** A store over the real `window.localStorage`, which is what a `storage` event implies. */
function store() {
  return createCartStore(() => window.localStorage);
}

/** What another tab writing the bag looks like to this one. */
function otherTabWrote(lines: CartLine[]) {
  const value = serializeCart(lines);
  window.localStorage.setItem(CART_STORAGE_KEY, value);
  window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: value }));
}

beforeEach(() => window.localStorage.clear());

describe('cross-tab sync', () => {
  it('picks up another tab s write, last write wins', () => {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart([dress]));
    const s = store();
    const seen: unknown[] = [];
    s.subscribe(() => seen.push(s.getSnapshot()));

    otherTabWrote([dress, tote]);

    expect(s.getSnapshot()).toEqual({ hydrated: true, lines: [dress, tote] });
    expect(seen.length).toBeGreaterThan(1);
  });

  it('treats another tab s localStorage.clear() as an emptied bag', () => {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart([dress]));
    const s = store();
    s.subscribe(() => {});

    window.localStorage.clear();
    // `key === null` is the clear(), which the listener must not filter out.
    window.dispatchEvent(new StorageEvent('storage', { key: null }));

    expect(s.getSnapshot()).toEqual({ hydrated: true, lines: [] });
  });

  it('ignores another key changing in the same origin', () => {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart([dress]));
    const s = store();
    const seen: unknown[] = [];
    s.subscribe(() => seen.push(s.getSnapshot()));
    const before = seen.length;

    window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-app-key' }));

    expect(seen.length).toBe(before);
    expect(s.getSnapshot()).toEqual({ hydrated: true, lines: [dress] });
  });

  /**
   * The lifecycle, which is where a leak or a missed re-attach would live: the listener
   * is attached for the first subscriber and detached when the last leaves. Navigating
   * away from every bag surface and back must not leave the bag deaf.
   */
  it('stops listening when the last subscriber leaves, and listens again on the next', () => {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart([dress]));
    const s = store();
    const unsubscribe = s.subscribe(() => {});

    unsubscribe();
    otherTabWrote([dress, tote]);
    expect(s.getSnapshot()).toEqual({ hydrated: true, lines: [dress] });

    // Re-subscribing re-reads storage, so the write made while nobody listened is not lost.
    s.subscribe(() => {});
    expect(s.getSnapshot()).toEqual({ hydrated: true, lines: [dress, tote] });

    otherTabWrote([tote]);
    expect(s.getSnapshot()).toEqual({ hydrated: true, lines: [tote] });
  });

  it('does not notify when another tab rewrites the same bag', () => {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart([dress]));
    const s = store();
    const seen: unknown[] = [];
    s.subscribe(() => seen.push(s.getSnapshot()));
    const before = seen.length;

    otherTabWrote([dress]);

    expect(seen.length).toBe(before);
  });
});
