import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import type { BagTriggerStrings } from './bag-strings';
import { addLine, totalPieces, type CartLine } from './cart-lines';
import { bagTriggerLabel } from './bag-trigger-label';

const enStrings: BagTriggerStrings = { label: en.navigation.bag, count: en.bag.count };
const arStrings: BagTriggerStrings = { label: ar.navigation.bag, count: ar.bag.count };

describe('bagTriggerLabel', () => {
  it('matches the server render before hydration: "Bag", no badge, no haspopup', () => {
    expect(bagTriggerLabel(false, 3, false, enStrings, 'en')).toEqual({
      badgeText: null,
      ariaLabel: 'Bag',
    });
  });

  it('keeps "Bag" and hides the badge for a hydrated empty bag', () => {
    const label = bagTriggerLabel(true, 0, false, enStrings, 'en');
    expect(label.badgeText).toBeNull();
    expect(label.ariaLabel).toBe('Bag');
  });

  it('shows the count in the badge and the accessible name', () => {
    const label = bagTriggerLabel(true, 3, false, enStrings, 'en');
    expect(label.badgeText).toBe('3');
    expect(label.ariaLabel).toBe('Bag, 3 items');
  });

  it('uses the singular template for one piece', () => {
    expect(bagTriggerLabel(true, 1, false, enStrings, 'en').ariaLabel).toBe('Bag, 1 item');
  });

  it('caps the badge at 99+ while the label keeps the real count', () => {
    const label = bagTriggerLabel(true, 120, false, enStrings, 'en');
    expect(label.badgeText).toBe('99+');
    expect(label.ariaLabel).toBe('Bag, 120 items');
    expect(bagTriggerLabel(true, 99, false, enStrings, 'en').badgeText).toBe('99');
    expect(bagTriggerLabel(true, 100, false, enStrings, 'en').badgeText).toBe('99+');
  });

  it.each([
    [1, 'one'],
    [2, 'two'],
    [3, 'few'],
    [11, 'many'],
    [120, 'other'],
  ] as const)('selects the Arabic %i template from the %s category', (count, category) => {
    expect(bagTriggerLabel(true, count, false, arStrings, 'ar').ariaLabel).toBe(
      ar.bag.count[category].replace('{count}', String(count))
    );
  });

  it('keeps the Arabic noun label when empty', () => {
    expect(bagTriggerLabel(true, 0, false, arStrings, 'ar').ariaLabel).toBe(ar.navigation.bag);
  });

  it('announces a dialog popup once hydrated off /bag', () => {
    const label = bagTriggerLabel(true, 0, false, enStrings, 'en');
    expect(label.ariaHaspopup).toBe('dialog');
    expect(label.ariaCurrent).toBeUndefined();
  });

  it('marks the current page on /bag and never a popup', () => {
    for (const hydrated of [false, true]) {
      const label = bagTriggerLabel(hydrated, 2, true, enStrings, 'en');
      expect(label.ariaCurrent).toBe('page');
      expect(label.ariaHaspopup).toBeUndefined();
    }
  });

  it('counts every stored piece, including lines a quote would exclude (CD-18)', () => {
    // The trigger never reads the quote: a sold-out or unavailable line is still stored.
    let lines: readonly CartLine[] = [];
    lines = addLine(lines, { slug: 'silk-slip-dress', options: { size: 'M' } }).lines;
    lines = addLine(lines, { slug: 'silk-slip-dress', options: { size: 'M' } }).lines;
    lines = addLine(lines, { slug: 'retired-piece', options: {} }).lines;
    expect(bagTriggerLabel(true, totalPieces(lines), false, enStrings, 'en').badgeText).toBe('3');
  });
});
