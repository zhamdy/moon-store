import { CART_STORAGE_KEY, CART_VERSION } from '../constants';
import {
  persistedCartEnvelopeSchema,
  persistedCartLineSchema,
  type PersistedCart,
} from '../schemas/persisted-cart';
import { mergeDuplicateLines, type CartLine } from './cart-lines';

/**
 * Reading, repairing and writing the persisted bag. Nothing here touches `window` at import
 * time; the browser storage is reached only through a getter called inside try/catch, since
 * private mode, quota and disabled site data all throw.
 */

export type CartStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type GetCartStorage = () => CartStorage | null;

export interface ParsedCart {
  lines: readonly CartLine[];
  /** The stored value differs from the canonical serialization and should be rewritten. */
  repaired: boolean;
}

export type CartReadResult = ({ ok: true } & ParsedCart) | { ok: false };

export const browserCartStorage: GetCartStorage = () =>
  typeof window === 'undefined' ? null : window.localStorage;

export function serializeCart(lines: readonly CartLine[]): string {
  const cart: PersistedCart = {
    version: CART_VERSION,
    lines: lines.map(({ slug, options, quantity }) => ({
      slug,
      options: { ...options },
      quantity,
    })),
  };
  return JSON.stringify(cart);
}

/**
 * The v1 read policy: malformed JSON or envelope, or an unknown version, resets; invalid
 * lines are dropped one by one; duplicates merge. `null` (never written) is an empty bag
 * that needs no write.
 */
export function parseCart(raw: string | null): ParsedCart {
  if (raw === null) {
    return { lines: [], repaired: false };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { lines: [], repaired: true };
  }

  const envelope = persistedCartEnvelopeSchema.safeParse(json);
  if (!envelope.success || envelope.data.version !== CART_VERSION) {
    return { lines: [], repaired: true };
  }

  const valid: CartLine[] = [];
  for (const candidate of envelope.data.lines) {
    const line = persistedCartLineSchema.safeParse(candidate);
    if (line.success) {
      valid.push(line.data);
    }
  }

  const lines = mergeDuplicateLines(valid);
  return { lines, repaired: serializeCart(lines) !== raw };
}

/** Writes the bag; `false` when storage is unavailable or throws. Never throws. */
export function writeCart(getStorage: GetCartStorage, lines: readonly CartLine[]): boolean {
  try {
    const storage = getStorage();
    if (!storage) {
      return false;
    }
    storage.setItem(CART_STORAGE_KEY, serializeCart(lines));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads and repairs the bag. `ok: false` means storage could not be read, so the caller
 * keeps whatever bag it holds in memory rather than treating it as empty.
 */
export function readCart(getStorage: GetCartStorage): CartReadResult {
  let raw: string | null;
  try {
    const storage = getStorage();
    if (!storage) {
      return { ok: false };
    }
    raw = storage.getItem(CART_STORAGE_KEY);
  } catch {
    return { ok: false };
  }

  const parsed = parseCart(raw);
  if (parsed.repaired) {
    writeCart(getStorage, parsed.lines);
  }
  return { ok: true, ...parsed };
}
