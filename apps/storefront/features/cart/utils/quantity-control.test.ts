import { describe, expect, it } from 'vitest';
import { MAX_LINE_QUANTITY } from '../constants';
import { quantityControl } from './quantity-control';

describe('quantityControl', () => {
  it('disables − at 1 and leaves + open below the limit', () => {
    expect(quantityControl(1, { status: 'ok', maxQuantity: 5, pending: false })).toEqual({
      decrementDisabled: true,
      incrementDisabled: false,
      incrementDescription: null,
      limit: 5,
    });
  });

  it('opens − above 1', () => {
    expect(
      quantityControl(2, { status: 'ok', maxQuantity: 5, pending: false }).decrementDisabled
    ).toBe(false);
  });

  it('disables + at a stock limit below 10 with the stock-limit description', () => {
    expect(quantityControl(2, { status: 'ok', maxQuantity: 2, pending: false })).toMatchObject({
      incrementDisabled: true,
      incrementDescription: 'stockLimit',
      limit: 2,
    });
  });

  it('describes a reduced line above its allowed quantity as stock-limited', () => {
    expect(quantityControl(4, { status: 'reduced', maxQuantity: 2, pending: false })).toMatchObject(
      {
        decrementDisabled: false,
        incrementDisabled: true,
        incrementDescription: 'stockLimit',
        limit: 2,
      }
    );
  });

  it('disables + at 10 with the capped description', () => {
    expect(
      quantityControl(MAX_LINE_QUANTITY, { status: 'ok', maxQuantity: 10, pending: false })
    ).toMatchObject({ incrementDisabled: true, incrementDescription: 'capped', limit: 10 });
  });

  it('uses 10 as the limit before any quote', () => {
    const before = quantityControl(9, { status: 'unquoted', pending: false });
    expect(before).toMatchObject({ incrementDisabled: false, limit: 10 });
    expect(quantityControl(10, { status: 'unquoted', pending: true })).toMatchObject({
      incrementDisabled: true,
      incrementDescription: 'capped',
    });
  });

  it('holds the last known maxQuantity while a re-quote is pending', () => {
    expect(quantityControl(3, { status: 'ok', maxQuantity: 3, pending: true })).toMatchObject({
      incrementDisabled: true,
      incrementDescription: 'stockLimit',
      limit: 3,
    });
  });

  it('never lets a server maxQuantity lift the limit past 10', () => {
    expect(quantityControl(10, { status: 'ok', maxQuantity: 25, pending: false }).limit).toBe(10);
  });

  it.each(['soldOut', 'variantUnavailable', 'productUnavailable'] as const)(
    'disables both buttons for a %s line',
    (status) => {
      expect(quantityControl(2, { status, maxQuantity: 0, pending: false })).toMatchObject({
        decrementDisabled: true,
        incrementDisabled: true,
        incrementDescription: null,
      });
    }
  );
});
