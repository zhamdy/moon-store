import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHECKOUT_DRAFT_KEY } from '../constants';
import { EMPTY_CHECKOUT_VALUES, type CheckoutFormValues } from '../schemas/checkout-form';
import {
  clearDraft,
  parseDraft,
  readDraft,
  writeDraft,
  type DraftStorage,
} from './checkout-draft-storage';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: DraftStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
  return { storage, map };
}

const FULL: CheckoutFormValues = {
  fullName: 'Nour Hassan',
  phone: '+20 100 111 2233',
  email: 'nour@moon.com',
  governorate: 'Giza',
  area: 'Dokki',
  street: 'Tahrir St, building 4',
  apartment: 'Floor 3, apt 7',
  landmark: 'Next to the pharmacy',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkout draft storage', () => {
  it('round-trips all eight fields', () => {
    const { storage } = memoryStorage();
    writeDraft(storage, FULL);
    expect(readDraft(storage)).toEqual(FULL);
  });

  it('stores only non-empty fields, and removes the key for an empty form', () => {
    const { storage, map } = memoryStorage();
    writeDraft(storage, { ...EMPTY_CHECKOUT_VALUES, fullName: 'Nour' });
    expect(JSON.parse(map.get(CHECKOUT_DRAFT_KEY)!)).toEqual({
      version: 1,
      draft: { fullName: 'Nour' },
    });
    writeDraft(storage, EMPTY_CHECKOUT_VALUES);
    expect(map.has(CHECKOUT_DRAFT_KEY)).toBe(false);
  });

  it('never written: null and no write', () => {
    const { storage, map } = memoryStorage();
    expect(readDraft(storage)).toBeNull();
    expect(map.size).toBe(0);
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['another version', JSON.stringify({ version: 2, draft: { fullName: 'A' } })],
    ['an array', '[]'],
    ['a draft that is not an object', JSON.stringify({ version: 1, draft: 'x' })],
  ])('%s: null and the key removed', (_label, raw) => {
    const { storage, map } = memoryStorage({ [CHECKOUT_DRAFT_KEY]: raw });
    expect(readDraft(storage)).toBeNull();
    expect(map.has(CHECKOUT_DRAFT_KEY)).toBe(false);
  });

  it('keeps only known string fields within their limits', () => {
    const parsed = parseDraft(
      JSON.stringify({
        version: 1,
        draft: { fullName: 'A', price: 5, phone: 123, street: 'x'.repeat(151), area: 'Dokki' },
      })
    );
    expect(parsed).toEqual({ ok: true, draft: { fullName: 'A', area: 'Dokki' } });
  });

  it('ignores a __proto__ key and never pollutes the prototype', () => {
    const parsed = parseDraft(
      '{"version":1,"draft":{"__proto__":{"polluted":"yes"},"area":"Dokki"}}'
    );
    expect(parsed).toEqual({ ok: true, draft: { area: 'Dokki' } });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('storage that throws: read null, write and clear are no-ops, nothing thrown', () => {
    const throwing: DraftStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readDraft(throwing)).toBeNull();
    expect(() => writeDraft(throwing, FULL)).not.toThrow();
    expect(() => clearDraft(throwing)).not.toThrow();
    expect(readDraft(null)).toBeNull();
  });

  it('never logs draft content, even on a malformed draft', () => {
    const spies = [
      vi.spyOn(console, 'log'),
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
      vi.spyOn(console, 'info'),
    ];
    const { storage } = memoryStorage({ [CHECKOUT_DRAFT_KEY]: '{"version":1,"draft":' });
    readDraft(storage);
    writeDraft(storage, FULL);
    readDraft(storage);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
