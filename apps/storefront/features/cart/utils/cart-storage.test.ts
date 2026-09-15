import { describe, expect, it } from 'vitest';
import { CART_STORAGE_KEY } from '../constants';
import { createCartStore } from '../store/cart-store';
import { cartLineKey, type CartLine } from './cart-lines';
import { parseCart, readCart, serializeCart, writeCart, type CartStorage } from './cart-storage';

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) {
    data.set(CART_STORAGE_KEY, initial);
  }
  let writes = 0;
  const storage: CartStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      data.set(key, value);
    },
  };
  return { storage, raw: () => data.get(CART_STORAGE_KEY) ?? null, writes: () => writes };
}

const throwingStorage: CartStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

const dress: CartLine = { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 };
const tote: CartLine = { slug: 'leather-tote', options: {}, quantity: 1 };

describe('parseCart / serializeCart', () => {
  it('round-trips lines exactly with no repair', () => {
    const raw = serializeCart([dress, tote]);
    expect(JSON.parse(raw)).toEqual({ version: 1, lines: [dress, tote] });
    expect(parseCart(raw)).toEqual({ lines: [dress, tote], repaired: false });
  });

  it('treats a never-written bag as empty without a rewrite', () => {
    expect(parseCart(null)).toEqual({ lines: [], repaired: false });
  });

  it('resets malformed JSON', () => {
    expect(parseCart('{not json')).toEqual({ lines: [], repaired: true });
  });

  it('resets an unknown version', () => {
    expect(parseCart(JSON.stringify({ version: 2, lines: [dress] }))).toEqual({
      lines: [],
      repaired: true,
    });
  });

  it('resets a malformed envelope', () => {
    expect(parseCart(JSON.stringify({ version: 1, lines: 'x' }))).toEqual({
      lines: [],
      repaired: true,
    });
    expect(parseCart('null')).toEqual({ lines: [], repaired: true });
  });

  it('drops only invalid lines', () => {
    const raw = JSON.stringify({
      version: 1,
      lines: [dress, { slug: 5 }, { slug: 'x', options: {}, quantity: 0 }],
    });
    expect(parseCart(raw)).toEqual({ lines: [dress], repaired: true });
  });

  it('drops extra keys such as price and name', () => {
    const raw = JSON.stringify({
      version: 1,
      lines: [{ ...dress, price: 2850, name: 'Silk dress' }],
    });
    const parsed = parseCart(raw);
    expect(parsed.lines).toEqual([dress]);
    expect(parsed.repaired).toBe(true);
    expect(Object.keys(parsed.lines[0])).toEqual(['slug', 'options', 'quantity']);
  });

  it('merges duplicates by line key, capped at 10', () => {
    const raw = JSON.stringify({
      version: 1,
      lines: [
        { slug: 'a', options: { size: 'M', color: 'Red' }, quantity: 6 },
        tote,
        { slug: 'a', options: { color: 'Red', size: 'M' }, quantity: 7 },
      ],
    });
    expect(parseCart(raw)).toEqual({
      lines: [{ slug: 'a', options: { size: 'M', color: 'Red' }, quantity: 10 }, tote],
      repaired: true,
    });
  });

  it('keeps at most 30 distinct lines', () => {
    const lines = Array.from({ length: 31 }, (_, i) => ({
      slug: `piece-${i}`,
      options: {},
      quantity: 1,
    }));
    const parsed = parseCart(JSON.stringify({ version: 1, lines }));
    expect(parsed.lines).toHaveLength(30);
    expect(parsed.repaired).toBe(true);
  });
});

describe('readCart / writeCart', () => {
  it('rewrites a repaired value to the canonical serialization', () => {
    const memory = memoryStorage('{not json');
    const result = readCart(() => memory.storage);
    expect(result).toEqual({ ok: true, lines: [], repaired: true });
    expect(memory.raw()).toBe(serializeCart([]));
  });

  it('does not write a value that needs no repair', () => {
    const memory = memoryStorage(serializeCart([dress]));
    readCart(() => memory.storage);
    expect(memory.writes()).toBe(0);
  });

  it('reports storage that throws without throwing', () => {
    expect(readCart(() => throwingStorage)).toEqual({ ok: false });
    expect(writeCart(() => throwingStorage, [dress])).toBe(false);
    expect(readCart(() => null)).toEqual({ ok: false });
    expect(
      readCart(() => {
        throw new Error('localStorage is disabled');
      })
    ).toEqual({ ok: false });
  });
});

describe('createCartStore', () => {
  it('starts not hydrated; the first subscription reads storage and notifies', () => {
    const memory = memoryStorage(serializeCart([dress]));
    const store = createCartStore(() => memory.storage);
    expect(store.getSnapshot()).toEqual({ hydrated: false });
    expect(store.getServerSnapshot()).toEqual({ hydrated: false });

    const seen: unknown[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));

    expect(seen).toEqual([{ hydrated: true, lines: [dress] }]);
    expect(store.getServerSnapshot()).toEqual({ hydrated: false });
  });

  it('keeps a stable snapshot reference between notifications', () => {
    const memory = memoryStorage();
    const store = createCartStore(() => memory.storage);
    store.subscribe(() => {});
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('writes each mutation to storage and returns the add outcome', () => {
    const memory = memoryStorage();
    const store = createCartStore(() => memory.storage);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    notified = 0;

    expect(store.add({ slug: 'silk-midi-dress', options: { size: 'M' } }).outcome).toBe('added');
    expect(store.add({ slug: 'silk-midi-dress', options: { size: 'M' } }).outcome).toBe('merged');
    expect(parseCart(memory.raw()).lines).toEqual([dress]);

    const key = cartLineKey(dress);
    store.setQuantity(key, 1.5);
    expect(notified).toBe(2);
    store.remove(key);
    expect(memory.raw()).toBe(serializeCart([]));
  });

  it('keeps an in-memory bag when storage throws on read and write', () => {
    const store = createCartStore(() => throwingStorage);
    expect(() => store.subscribe(() => {})).not.toThrow();
    expect(store.getSnapshot()).toEqual({ hydrated: true, lines: [] });

    expect(() => store.add({ slug: 'leather-tote', options: {} })).not.toThrow();
    store.add({ slug: 'leather-tote', options: {} });
    expect(store.getSnapshot()).toEqual({ hydrated: true, lines: [{ ...tote, quantity: 2 }] });
  });

  it('hydrates before a mutation made ahead of any subscription', () => {
    const memory = memoryStorage(serializeCart([tote]));
    const store = createCartStore(() => memory.storage);
    store.add({ slug: 'silk-midi-dress', options: { size: 'M' } });
    expect(parseCart(memory.raw()).lines).toEqual([tote, { ...dress, quantity: 1 }]);
  });

  it('keeps drawer and session memory out of storage', () => {
    const memory = memoryStorage();
    const store = createCartStore(() => memory.storage);
    store.subscribe(() => {});
    store.openDrawer({ mode: 'added', addedKey: 'k', description: 'Added to your bag: Dress' });
    store.rememberPrices({ k: 2850 });
    store.markQuoteAnnounced('q');

    const session = store.getSession();
    expect(session.drawer).toEqual({
      open: true,
      mode: 'added',
      addedKey: 'k',
      description: 'Added to your bag: Dress',
    });
    expect(session.previousPrices.get('k')).toBe(2850);
    expect(session.announcedQuoteKeys.has('q')).toBe(true);

    store.browseDrawer();
    expect(store.getSession().drawer).toEqual({
      open: true,
      mode: 'browse',
      addedKey: null,
      description: null,
    });
    store.closeDrawer();
    expect(store.getSession().drawer.open).toBe(false);
    expect(memory.writes()).toBe(0);
  });

  const hint = {
    name: { text: 'Silk Midi Dress', lang: 'en' as const },
    imageUrl: 'https://media.example/silk-midi-dress.jpg',
    unitPrice: 2850,
  };

  it('keeps an Add to Bag hint in memory only, and drops it with its line', () => {
    const memory = memoryStorage();
    const store = createCartStore(() => memory.storage);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    notified = 0;

    const key = cartLineKey(dress);
    store.add({ slug: dress.slug, options: dress.options }, { hint });
    expect(notified).toBe(1);
    expect(store.getSession().hints.get(key)).toEqual(hint);

    const raw = memory.raw()!;
    expect(raw).toBe(serializeCart([{ ...dress, quantity: 1 }]));
    for (const leaked of ['Silk Midi Dress', 'silk-midi-dress.jpg', '2850', 'hint']) {
      expect(raw).not.toContain(leaked);
    }

    store.remove(key);
    expect(store.getSession().hints.has(key)).toBe(false);
    expect(memory.raw()).toBe(serializeCart([]));
  });

  it('persists a requested quantity and keeps the hint when a capped merge still adds', () => {
    const memory = memoryStorage(serializeCart([{ ...dress, quantity: 8 }]));
    const store = createCartStore(() => memory.storage);
    store.subscribe(() => {});

    const result = store.add({ slug: dress.slug, options: dress.options }, { quantity: 5, hint });
    expect(result).toMatchObject({ outcome: 'merged', addedQuantity: 2 });
    expect(parseCart(memory.raw()).lines).toEqual([{ ...dress, quantity: 10 }]);
    expect(store.getSession().hints.get(cartLineKey(dress))).toEqual(hint);

    store.add({ slug: tote.slug, options: {} }, { quantity: 3 });
    expect(parseCart(memory.raw()).lines).toEqual([
      { ...dress, quantity: 10 },
      { ...tote, quantity: 3 },
    ]);
  });

  it('clear drops every hint; a capped add stores none', () => {
    const memory = memoryStorage(serializeCart([{ ...dress, quantity: 10 }]));
    const store = createCartStore(() => memory.storage);
    store.subscribe(() => {});

    expect(
      store.add({ slug: dress.slug, options: dress.options }, { quantity: 3, hint }).outcome
    ).toBe('capped');
    expect(store.getSession().hints.size).toBe(0);

    store.add({ slug: tote.slug, options: {} }, { hint: { ...hint, imageUrl: null } });
    expect(store.getSession().hints.has(cartLineKey(tote))).toBe(true);
    store.clear();
    expect(store.getSession().hints.size).toBe(0);
    expect(memory.raw()).toBe(serializeCart([]));
  });
});
