import { describe, expect, it } from 'vitest';
import { addLine, cartLineKey, type CartLine } from './cart-lines';
import { addToBagIntent, drawerOpeningFor } from './add-to-bag-action';
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from '../constants';

const strings = {
  added: 'Added to your bag: {name}',
  capped: 'You can add up to {max} of this piece',
  full: 'Your bag is full. Remove a piece to add another',
};

describe('addToBagIntent', () => {
  it('adds the ready options for a variant product', () => {
    expect(addToBagIntent({ kind: 'ready', options: { size: 'M' } }, 'silk-midi-dress')).toEqual({
      kind: 'add',
      identity: { slug: 'silk-midi-dress', options: { size: 'M' } },
    });
  });

  it('adds empty options for a product with none', () => {
    expect(addToBagIntent({ kind: 'ready', options: {} }, 'leather-tote')).toEqual({
      kind: 'add',
      identity: { slug: 'leather-tote', options: {} },
    });
  });

  it('focuses the first unselected option and writes nothing while a choice is missing', () => {
    expect(
      addToBagIntent({ kind: 'needsSelection', keys: ['size', 'color'] }, 'silk-midi-dress')
    ).toEqual({ kind: 'focusSelection', key: 'size' });
  });

  it('does nothing when sold out', () => {
    expect(addToBagIntent({ kind: 'soldOut' }, 'silk-slip-dress')).toEqual({ kind: 'none' });
  });
});

describe('drawerOpeningFor', () => {
  const identity = { slug: 'silk-midi-dress', options: { size: 'M' } };
  const key = cartLineKey(identity);

  it('opens in added mode with the page name for a new line', () => {
    const result = addLine([], identity);
    expect(result.outcome).toBe('added');
    expect(drawerOpeningFor(result, 'Silk Midi Dress', strings)).toEqual({
      mode: 'added',
      addedKey: key,
      description: 'Added to your bag: Silk Midi Dress',
    });
  });

  it('opens in added mode for a merge into an existing line', () => {
    const result = addLine([{ ...identity, quantity: 2 }], identity);
    expect(result.outcome).toBe('merged');
    expect(drawerOpeningFor(result, 'Silk Midi Dress', strings).mode).toBe('added');
  });

  it('opens in browse mode with the capped notice and the line to scroll to', () => {
    const lines = [{ ...identity, quantity: MAX_LINE_QUANTITY }];
    const result = addLine(lines, identity);
    expect(result.outcome).toBe('capped');
    expect(result.lines).toBe(lines);
    expect(drawerOpeningFor(result, 'Silk Midi Dress', strings)).toEqual({
      mode: 'browse',
      addedKey: key,
      description: `You can add up to ${MAX_LINE_QUANTITY} of this piece`,
    });
  });

  it('opens in browse mode with the full notice and adds nothing', () => {
    const lines: CartLine[] = Array.from({ length: MAX_CART_LINES }, (_, i) => ({
      slug: `piece-${i}`,
      options: {},
      quantity: 1,
    }));
    const result = addLine(lines, identity);
    expect(result.outcome).toBe('full');
    expect(result.lines).toBe(lines);
    expect(drawerOpeningFor(result, 'Silk Midi Dress', strings)).toEqual({
      mode: 'browse',
      addedKey: null,
      description: strings.full,
    });
  });
});
