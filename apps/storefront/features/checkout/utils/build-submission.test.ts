import { describe, expect, it } from 'vitest';
import type { CartLine } from '@/features/cart/utils/cart-lines';
import { buildSubmission } from './build-submission';

const LINES: CartLine[] = [
  { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 },
  { slug: 'leather-tote', options: {}, quantity: 1 },
];

function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) => [key, ...keysDeep(nested)]);
  }
  return [];
}

describe('buildSubmission', () => {
  const submission = buildSubmission(
    {
      fullName: '  Nour Hassan ',
      phone: '+20 100 111 2233',
      email: '',
      governorate: ' Cairo ',
      area: 'Zamalek',
      street: '26th of July St, building 12 ',
      apartment: '  ',
      landmark: 'Near the bookshop',
    },
    LINES,
    'quote-key'
  );

  it('trims, normalises the phone and turns empty optionals into null', () => {
    expect(submission.contact).toEqual({
      fullName: 'Nour Hassan',
      phone: '+201001112233',
      email: null,
    });
    expect(submission.address).toEqual({
      governorate: 'Cairo',
      area: 'Zamalek',
      street: '26th of July St, building 12',
      apartment: null,
      landmark: 'Near the bookshop',
    });
    expect(submission.deliveryMethod).toBeNull();
  });

  it('copies intent lines and the quote key', () => {
    expect(submission.cart).toEqual({ quoteKey: 'quote-key', lines: LINES });
    expect(submission.cart.lines[0]!.options).not.toBe(LINES[0]!.options);
  });

  it('carries no price, total, name or image anywhere', () => {
    const keys = keysDeep(submission);
    for (const banned of [
      'price',
      'unitPrice',
      'subtotal',
      'lineTotal',
      'total',
      'name',
      'image',
    ]) {
      expect(keys).not.toContain(banned);
    }
  });
});
