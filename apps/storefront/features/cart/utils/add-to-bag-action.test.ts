import { describe, expect, it } from 'vitest';
import { addLine, type CartLine } from './cart-lines';
import { ADD_TO_BAG_TOAST_ID, addToBagIntent, addToBagToast } from './add-to-bag-action';
import { MAX_CART_LINES, MAX_LINE_QUANTITY } from '../constants';

const strings = {
  added: 'Added to your bag: {name}',
  addedQuantity: 'Added to your bag: {name} ({count})',
  capped: 'You can add up to {max} of this piece',
  full: 'Your bag is full. Remove a piece to add another',
};

describe('addToBagIntent', () => {
  it('adds the ready options for a variant product, with the stepper quantity', () => {
    expect(addToBagIntent({ kind: 'ready', options: { size: 'M' } }, 'silk-midi-dress', 1)).toEqual(
      {
        kind: 'add',
        identity: { slug: 'silk-midi-dress', options: { size: 'M' } },
        quantity: 1,
      }
    );
  });

  it('carries a quantity above one', () => {
    expect(addToBagIntent({ kind: 'ready', options: {} }, 'leather-tote', 3)).toEqual({
      kind: 'add',
      identity: { slug: 'leather-tote', options: {} },
      quantity: 3,
    });
  });

  it('focuses the first unselected option and writes nothing while a choice is missing', () => {
    expect(
      addToBagIntent({ kind: 'needsSelection', keys: ['size', 'color'] }, 'silk-midi-dress', 4)
    ).toEqual({ kind: 'focusSelection', key: 'size' });
  });

  it('does nothing when sold out', () => {
    expect(addToBagIntent({ kind: 'soldOut' }, 'silk-slip-dress', 2)).toEqual({ kind: 'none' });
  });
});

describe('addToBagToast', () => {
  const identity = { slug: 'silk-midi-dress', options: { size: 'M' } };
  const cappedNotice = `You can add up to ${MAX_LINE_QUANTITY} of this piece`;
  const toastOf = (tone: string, message: string) => ({
    tone,
    message,
    id: ADD_TO_BAG_TOAST_ID,
    action: 'viewBag',
  });

  it('is a success naming the piece for one new piece', () => {
    const result = addLine([], identity);
    expect(result.outcome).toBe('added');
    expect(addToBagToast(result, 'Silk Midi Dress', strings, 1)).toEqual(
      toastOf('success', 'Added to your bag: Silk Midi Dress')
    );
  });

  it('is a success for a one-piece merge into an existing line', () => {
    const result = addLine([{ ...identity, quantity: 2 }], identity);
    expect(result.outcome).toBe('merged');
    expect(addToBagToast(result, 'Silk Midi Dress', strings, 1)).toEqual(
      toastOf('success', 'Added to your bag: Silk Midi Dress')
    );
  });

  it('names the count when three pieces are added', () => {
    const result = addLine([], identity, 3);
    expect(addToBagToast(result, 'Silk Midi Dress', strings, 3)).toEqual(
      toastOf('success', 'Added to your bag: Silk Midi Dress (3)')
    );
  });

  it('is an info notice when a merge landed fewer pieces than requested', () => {
    const result = addLine([{ ...identity, quantity: 8 }], identity, 5);
    expect(result).toMatchObject({ outcome: 'merged', addedQuantity: 2 });
    expect(addToBagToast(result, 'Silk Midi Dress', strings, 5)).toEqual(
      toastOf('info', cappedNotice)
    );
  });

  it('is an info notice when the line is already at the cap', () => {
    const lines = [{ ...identity, quantity: MAX_LINE_QUANTITY }];
    const result = addLine(lines, identity, 3);
    expect(result.outcome).toBe('capped');
    expect(result.lines).toBe(lines);
    expect(addToBagToast(result, 'Silk Midi Dress', strings, 3)).toEqual(
      toastOf('info', cappedNotice)
    );
  });

  it('is an error when the bag is full, and adds nothing', () => {
    const lines: CartLine[] = Array.from({ length: MAX_CART_LINES }, (_, i) => ({
      slug: `piece-${i}`,
      options: {},
      quantity: 1,
    }));
    const result = addLine(lines, identity, 2);
    expect(result.outcome).toBe('full');
    expect(result.lines).toBe(lines);
    expect(addToBagToast(result, 'Silk Midi Dress', strings, 2)).toEqual(
      toastOf('error', strings.full)
    );
  });
});
