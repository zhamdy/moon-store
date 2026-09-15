import { describe, expect, it } from 'vitest';
import { parsePersistedCartEnvelope, parsePersistedCartLine } from './persisted-cart';

const valid = { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 };

function accepts(line: unknown): boolean {
  return parsePersistedCartLine(line) !== null;
}

describe('parsePersistedCartLine', () => {
  it('accepts a v1 line and a no-variant line', () => {
    expect(accepts(valid)).toBe(true);
    expect(accepts({ slug: 'leather-tote', options: {}, quantity: 1 })).toBe(true);
  });

  it('strips unknown keys such as price and name', () => {
    expect(parsePersistedCartLine({ ...valid, price: 2850, name: 'Dress' })).toEqual(valid);
  });

  it('builds fresh objects rather than returning the input', () => {
    const input = { ...valid, options: { size: 'M' } };
    const line = parsePersistedCartLine(input);
    expect(line).not.toBe(input);
    expect(line?.options).not.toBe(input.options);
    expect(Object.getPrototypeOf(line?.options)).toBe(Object.prototype);
  });

  it('bounds quantity to integers 1..10, by typeof only', () => {
    for (const quantity of [
      0,
      -1,
      1.5,
      11,
      '2',
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      null,
      true,
    ]) {
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
    expect(accepts({ ...valid, options: { '': 'M' } })).toBe(false);
    expect(accepts({ ...valid, options: { size: 'v'.repeat(60) } })).toBe(true);
    expect(accepts({ ...valid, options: { size: 'v'.repeat(61) } })).toBe(false);
    expect(accepts({ ...valid, options: { size: '' } })).toBe(false);
    expect(accepts({ ...valid, options: { size: 3 } })).toBe(false);
  });

  it('rejects arrays and non-plain objects as options', () => {
    expect(accepts({ ...valid, options: ['M'] })).toBe(false);
    expect(accepts({ ...valid, options: [] })).toBe(false);
    expect(accepts({ ...valid, options: null })).toBe(false);
    expect(accepts({ ...valid, options: 'size=M' })).toBe(false);
    expect(accepts({ ...valid, options: new Date() })).toBe(false);
    expect(accepts({ ...valid, options: new Map([['size', 'M']]) })).toBe(false);
  });

  it('rejects prototype keys without polluting Object.prototype', () => {
    for (const raw of [
      '{"slug":"a","options":{"__proto__":{"polluted":"yes"}},"quantity":1}',
      '{"slug":"a","options":{"__proto__":"M"},"quantity":1}',
      '{"slug":"a","options":{"constructor":"M"},"quantity":1}',
      '{"slug":"a","options":{"prototype":"M"},"quantity":1}',
    ]) {
      expect(accepts(JSON.parse(raw))).toBe(false);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('ignores inherited option members', () => {
    const options = Object.create({ inherited: 'x' }) as Record<string, string>;
    expect(accepts({ ...valid, options })).toBe(false);
    const own = Object.assign(Object.create(null) as Record<string, string>, { size: 'M' });
    expect(parsePersistedCartLine({ ...valid, options: own })).toEqual(valid);
  });

  it('requires every field and an object line', () => {
    expect(accepts({ slug: 'a', quantity: 1 })).toBe(false);
    expect(accepts({ slug: 'a', options: {} })).toBe(false);
    expect(accepts(null)).toBe(false);
    expect(accepts([valid.slug, valid.options, valid.quantity])).toBe(false);
  });
});

describe('parsePersistedCartEnvelope', () => {
  it('accepts a version and a lines array without judging the lines', () => {
    expect(parsePersistedCartEnvelope({ version: 1, lines: [{ slug: 5 }] })).toEqual({
      version: 1,
      lines: [{ slug: 5 }],
    });
  });

  it('drops extra envelope keys', () => {
    expect(parsePersistedCartEnvelope({ version: 1, lines: [], extra: true })).toEqual({
      version: 1,
      lines: [],
    });
  });

  it('rejects a missing or non-array lines field, or a non-number version', () => {
    expect(parsePersistedCartEnvelope({ version: 1 })).toBeNull();
    expect(parsePersistedCartEnvelope({ version: 1, lines: {} })).toBeNull();
    expect(parsePersistedCartEnvelope({ version: '1', lines: [] })).toBeNull();
    expect(parsePersistedCartEnvelope([])).toBeNull();
    expect(parsePersistedCartEnvelope(null)).toBeNull();
    expect(parsePersistedCartEnvelope('{"version":1}')).toBeNull();
  });
});
