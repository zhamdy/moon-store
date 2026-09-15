import { describe, expect, it } from 'vitest';
import { persistedCartEnvelopeSchema, persistedCartLineSchema } from './persisted-cart';

const valid = { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 };

function accepts(line: unknown): boolean {
  return persistedCartLineSchema.safeParse(line).success;
}

describe('persistedCartLineSchema', () => {
  it('accepts a v1 line and a no-variant line', () => {
    expect(accepts(valid)).toBe(true);
    expect(accepts({ slug: 'leather-tote', options: {}, quantity: 1 })).toBe(true);
  });

  it('strips unknown keys such as price and name', () => {
    const result = persistedCartLineSchema.safeParse({ ...valid, price: 2850, name: 'Dress' });
    expect(result.success && result.data).toEqual(valid);
  });

  it('bounds quantity to integers 1..10', () => {
    for (const quantity of [0, -1, 1.5, 11, '2', Number.NaN, null]) {
      expect(accepts({ ...valid, quantity })).toBe(false);
    }
    expect(accepts({ ...valid, quantity: 1 })).toBe(true);
    expect(accepts({ ...valid, quantity: 10 })).toBe(true);
  });

  it('requires a public slug of at most 80 characters', () => {
    expect(accepts({ ...valid, slug: 5 })).toBe(false);
    expect(accepts({ ...valid, slug: '' })).toBe(false);
    expect(accepts({ ...valid, slug: 'Silk Dress' })).toBe(false);
    expect(accepts({ ...valid, slug: 'a'.repeat(80) })).toBe(true);
    expect(accepts({ ...valid, slug: 'a'.repeat(81) })).toBe(false);
  });

  it('bounds options to 5 entries, keys to 40 and values to 60 characters', () => {
    const five = { a: '1', b: '1', c: '1', d: '1', e: '1' };
    expect(accepts({ ...valid, options: five })).toBe(true);
    expect(accepts({ ...valid, options: { ...five, f: '1' } })).toBe(false);
    expect(accepts({ ...valid, options: { ['k'.repeat(40)]: 'M' } })).toBe(true);
    expect(accepts({ ...valid, options: { ['k'.repeat(41)]: 'M' } })).toBe(false);
    expect(accepts({ ...valid, options: { size: 'v'.repeat(60) } })).toBe(true);
    expect(accepts({ ...valid, options: { size: 'v'.repeat(61) } })).toBe(false);
    expect(accepts({ ...valid, options: { size: 3 } })).toBe(false);
    expect(accepts({ ...valid, options: ['M'] })).toBe(false);
  });

  it('requires every field', () => {
    expect(accepts({ slug: 'a', quantity: 1 })).toBe(false);
    expect(accepts({ slug: 'a', options: {} })).toBe(false);
  });
});

describe('persistedCartEnvelopeSchema', () => {
  it('accepts a version and a lines array without judging the lines', () => {
    expect(
      persistedCartEnvelopeSchema.safeParse({ version: 1, lines: [{ slug: 5 }] }).success
    ).toBe(true);
  });

  it('rejects a missing or non-array lines field', () => {
    expect(persistedCartEnvelopeSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(persistedCartEnvelopeSchema.safeParse({ version: 1, lines: {} }).success).toBe(false);
    expect(persistedCartEnvelopeSchema.safeParse([]).success).toBe(false);
  });
});
