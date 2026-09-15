import { describe, expect, it } from 'vitest';
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from '../constants';
import {
  addLine,
  applyCanonical,
  cartLineKey,
  clearLines,
  mergeDuplicateLines,
  removeLine,
  setLineQuantity,
  totalPieces,
  type CartLine,
} from './cart-lines';

const dressM = { slug: 'silk-midi-dress', options: { size: 'M' } };
const dressL = { slug: 'silk-midi-dress', options: { size: 'L' } };
const tote = { slug: 'leather-tote', options: {} };

function addTimes(lines: readonly CartLine[], identity: typeof dressM, times: number) {
  let current = lines;
  for (let i = 0; i < times; i += 1) {
    current = addLine(current, identity).lines;
  }
  return current;
}

describe('cartLineKey', () => {
  it('ignores option key order', () => {
    expect(cartLineKey({ slug: 'a', options: { size: 'M', color: 'Red' } })).toBe(
      cartLineKey({ slug: 'a', options: { color: 'Red', size: 'M' } })
    );
  });

  it('separates slugs and values that concatenate alike', () => {
    expect(cartLineKey({ slug: 'a', options: { b: 'c' } })).not.toBe(
      cartLineKey({ slug: 'ab', options: { '': 'c' } })
    );
  });
});

describe('addLine', () => {
  it('adds a first line with quantity 1', () => {
    const result = addLine([], dressM);
    expect(result.outcome).toBe('added');
    expect(result.lines).toEqual([
      { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 1 },
    ]);
    expect(totalPieces(result.lines)).toBe(1);
    expect(result.key).toBe(cartLineKey(dressM));
  });

  it('merges the same slug and options', () => {
    const first = addLine([], dressM);
    const second = addLine(first.lines, dressM);
    expect(second.outcome).toBe('merged');
    expect(second.lines).toHaveLength(1);
    expect(second.lines[0].quantity).toBe(2);
  });

  it('merges options listed in a different key order', () => {
    const first = addLine([], { slug: 'a', options: { size: 'M', color: 'Red' } });
    const second = addLine(first.lines, { slug: 'a', options: { color: 'Red', size: 'M' } });
    expect(second.outcome).toBe('merged');
    expect(second.lines).toHaveLength(1);
    expect(second.lines[0].quantity).toBe(2);
  });

  it('keeps a different size as a separate line', () => {
    const lines = addLine(addLine(addLine([], dressM).lines, dressM).lines, dressL).lines;
    expect(lines).toHaveLength(2);
    expect(totalPieces(lines)).toBe(3);
  });

  it('merges a no-variant product with itself', () => {
    const second = addLine(addLine([], tote).lines, { slug: 'leather-tote', options: {} });
    expect(second.outcome).toBe('merged');
    expect(second.lines).toEqual([{ slug: 'leather-tote', options: {}, quantity: 2 }]);
  });

  it('stops at the line cap and reports capped', () => {
    const atCap = addTimes([], dressM, MAX_LINE_QUANTITY);
    expect(atCap[0].quantity).toBe(MAX_LINE_QUANTITY);
    const result = addLine(atCap, dressM);
    expect(result.outcome).toBe('capped');
    expect(result.lines).toBe(atCap);
    expect(result.lines[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('rejects a new line past the line limit and reports full', () => {
    let lines: readonly CartLine[] = [];
    for (let i = 0; i < MAX_CART_LINES; i += 1) {
      lines = addLine(lines, { slug: `piece-${i}`, options: {} }).lines;
    }
    const result = addLine(lines, { slug: 'one-more', options: {} });
    expect(result.outcome).toBe('full');
    expect(result.lines).toBe(lines);
    expect(result.lines).toHaveLength(MAX_CART_LINES);
  });

  it('still merges into an existing line when the bag is full', () => {
    let lines: readonly CartLine[] = [];
    for (let i = 0; i < MAX_CART_LINES; i += 1) {
      lines = addLine(lines, { slug: `piece-${i}`, options: {} }).lines;
    }
    expect(addLine(lines, { slug: 'piece-0', options: {} }).outcome).toBe('merged');
  });

  it('does not share the caller options object', () => {
    const options: Record<string, string> = { size: 'M' };
    const { lines } = addLine([], { slug: 'a', options });
    options.size = 'L';
    expect(lines[0].options).toEqual({ size: 'M' });
  });
});

describe('setLineQuantity', () => {
  const lines = addTimes([], dressM, 3);
  const key = cartLineKey(dressM);

  it('sets an integer quantity', () => {
    expect(setLineQuantity(lines, key, 5)[0].quantity).toBe(5);
  });

  it('clamps 0 and negatives to 1', () => {
    expect(setLineQuantity(lines, key, 0)[0].quantity).toBe(1);
    expect(setLineQuantity(lines, key, -4)[0].quantity).toBe(1);
  });

  it('clamps above the cap to 10', () => {
    expect(setLineQuantity(lines, key, 11)[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('rejects non-integers, leaving state unchanged', () => {
    expect(setLineQuantity(lines, key, 1.5)).toBe(lines);
    expect(setLineQuantity(lines, key, Number.NaN)).toBe(lines);
    expect(setLineQuantity(lines, key, Number.POSITIVE_INFINITY)).toBe(lines);
  });

  it('stops a decrement at 1', () => {
    const one = setLineQuantity(lines, key, 1);
    expect(setLineQuantity(one, key, one[0].quantity - 1)).toBe(one);
  });

  it('ignores an unknown key', () => {
    expect(setLineQuantity(lines, 'nope', 2)).toBe(lines);
  });
});

describe('removeLine and clearLines', () => {
  it('removes the only line', () => {
    const lines = addLine([], dressM).lines;
    expect(removeLine(lines, cartLineKey(dressM))).toEqual([]);
  });

  it('is a no-op for an unknown key', () => {
    const lines = addLine([], dressM).lines;
    expect(removeLine(lines, cartLineKey(dressL))).toBe(lines);
  });

  it('clears to empty', () => {
    expect(clearLines()).toEqual([]);
  });
});

describe('applyCanonical', () => {
  it('rewrites the stored spelling and merges with the canonical line, capped at 10', () => {
    const lower = { slug: 'silk-midi-dress', options: { size: 'm' } };
    let lines = addTimes([], dressM, 6);
    lines = addTimes(lines, lower, 7);
    expect(lines).toHaveLength(2);

    const next = applyCanonical(lines, cartLineKey(lower), { size: 'M' });
    expect(next).toEqual([{ slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 10 }]);
  });

  it('rewrites without merging when no canonical line exists', () => {
    const lower = { slug: 'silk-midi-dress', options: { size: 'm' } };
    const lines = addTimes([], lower, 2);
    expect(applyCanonical(lines, cartLineKey(lower), { size: 'M' })).toEqual([
      { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 },
    ]);
  });

  it('is a fixed point when the spelling already matches', () => {
    const lines = addLine([], dressM).lines;
    expect(applyCanonical(lines, cartLineKey(dressM), { size: 'M' })).toBe(lines);
  });
});

describe('mergeDuplicateLines', () => {
  it('returns the same reference when there is nothing to merge', () => {
    const lines = addLine(addLine([], dressM).lines, dressL).lines;
    expect(mergeDuplicateLines(lines)).toBe(lines);
  });
});
