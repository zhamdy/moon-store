import { MAX_CART_LINES, MAX_LINE_QUANTITY } from '../constants';

/**
 * Pure bag rules. Every operation returns the same array reference when nothing changed,
 * so the store can skip a write and a notify.
 */

export type CartOptions = Readonly<Record<string, string>>;

export interface CartLine {
  readonly slug: string;
  readonly options: CartOptions;
  readonly quantity: number;
}

export type CartLineIdentity = Pick<CartLine, 'slug' | 'options'>;

export type AddOutcome = 'added' | 'merged' | 'capped' | 'full';

export interface AddResult {
  lines: readonly CartLine[];
  outcome: AddOutcome;
  key: string;
}

function byKey([a]: [string, string], [b]: [string, string]): number {
  // Code-unit order, not localeCompare: the key must not depend on the runtime's locale.
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The one line identity (CD-2): slug plus options sorted by key, JSON-encoded. Used for
 * merging, React keys and quote query keys, so option order never splits a line.
 */
export function cartLineKey({ slug, options }: CartLineIdentity): string {
  return JSON.stringify([slug, Object.entries(options).sort(byKey)]);
}

export function totalPieces(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

function capQuantity(quantity: number): number {
  return Math.min(quantity, MAX_LINE_QUANTITY);
}

/**
 * Adds one piece (or `quantity`). Same identity merges in place; a line already at the cap
 * is `capped` and a new line past `MAX_CART_LINES` is `full`, both leaving lines unchanged.
 */
export function addLine(
  lines: readonly CartLine[],
  identity: CartLineIdentity,
  quantity = 1
): AddResult {
  const key = cartLineKey(identity);
  const index = lines.findIndex((line) => cartLineKey(line) === key);

  if (index >= 0) {
    const current = lines[index];
    if (current.quantity >= MAX_LINE_QUANTITY) {
      return { lines, outcome: 'capped', key };
    }
    const next = lines.slice();
    next[index] = { ...current, quantity: capQuantity(current.quantity + quantity) };
    return { lines: next, outcome: 'merged', key };
  }

  if (lines.length >= MAX_CART_LINES) {
    return { lines, outcome: 'full', key };
  }

  const line: CartLine = {
    slug: identity.slug,
    options: { ...identity.options },
    quantity: Math.max(1, capQuantity(quantity)),
  };
  return { lines: [...lines, line], outcome: 'added', key };
}

/**
 * Sets a line's quantity, clamped to 1..10: the stepper stops at 1 and removal is explicit
 * (CD-14). A non-integer is a caller bug, so it changes nothing rather than guessing.
 */
export function setLineQuantity(
  lines: readonly CartLine[],
  key: string,
  quantity: number
): readonly CartLine[] {
  if (!Number.isInteger(quantity)) {
    return lines;
  }
  const index = lines.findIndex((line) => cartLineKey(line) === key);
  if (index < 0) {
    return lines;
  }
  const clamped = Math.min(Math.max(quantity, 1), MAX_LINE_QUANTITY);
  if (lines[index].quantity === clamped) {
    return lines;
  }
  const next = lines.slice();
  next[index] = { ...lines[index], quantity: clamped };
  return next;
}

export function removeLine(lines: readonly CartLine[], key: string): readonly CartLine[] {
  const next = lines.filter((line) => cartLineKey(line) !== key);
  return next.length === lines.length ? lines : next;
}

export function clearLines(): readonly CartLine[] {
  return [];
}

/**
 * Merges lines sharing a key into the first occurrence (sum capped at 10) and keeps at
 * most `MAX_CART_LINES` distinct lines, in order.
 */
export function mergeDuplicateLines(lines: readonly CartLine[]): readonly CartLine[] {
  const merged: CartLine[] = [];
  const positions = new Map<string, number>();

  for (const line of lines) {
    const key = cartLineKey(line);
    const position = positions.get(key);
    if (position !== undefined) {
      const existing = merged[position];
      merged[position] = { ...existing, quantity: capQuantity(existing.quantity + line.quantity) };
    } else if (merged.length < MAX_CART_LINES) {
      positions.set(key, merged.length);
      merged.push(line);
    }
  }

  const unchanged =
    merged.length === lines.length && merged.every((line, index) => line === lines[index]);
  return unchanged ? lines : merged;
}

/**
 * The quote's one store correction: rewrite a line's stored option spelling to the
 * server's canonical one, then merge any line that now shares its key.
 */
export function applyCanonical(
  lines: readonly CartLine[],
  key: string,
  canonicalOptions: CartOptions
): readonly CartLine[] {
  const index = lines.findIndex((line) => cartLineKey(line) === key);
  if (index < 0) {
    return lines;
  }
  const current = lines[index];
  const rewritten = { ...current, options: { ...canonicalOptions } };
  if (cartLineKey(rewritten) === key) {
    return lines;
  }
  const next = lines.slice();
  next[index] = rewritten;
  return mergeDuplicateLines(next);
}
