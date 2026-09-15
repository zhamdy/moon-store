import { describe, expect, it } from 'vitest';
import { isPlausiblePhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('maps Arabic digits and removes punctuation, keeping a leading +', () => {
    expect(normalizePhone('01001112233')).toBe('01001112233');
    expect(normalizePhone('+20 100 111 2233')).toBe('+201001112233');
    expect(normalizePhone('(010) 0111-2233')).toBe('01001112233');
    expect(normalizePhone('٠١٠٠١١١٢٢٣٣')).toBe('01001112233');
    expect(normalizePhone(' 010.0111.2233 ')).toBe('01001112233');
  });
});

describe('isPlausiblePhone', () => {
  it('accepts 8-15 digits with an optional leading +', () => {
    expect(isPlausiblePhone('01001112233')).toBe(true);
    expect(isPlausiblePhone('+20 100 111 2233')).toBe(true);
    expect(isPlausiblePhone('٠١٠٠١١١٢٢٣٣')).toBe(true);
    expect(isPlausiblePhone('12345678')).toBe(true);
    expect(isPlausiblePhone('123456789012345')).toBe(true);
    // Not Egypt-only: a UK number passes.
    expect(isPlausiblePhone('+44 20 7946 0958')).toBe(true);
  });

  it('rejects letters, too few or too many digits, and a misplaced +', () => {
    expect(isPlausiblePhone('abc')).toBe(false);
    expect(isPlausiblePhone('1234567')).toBe(false);
    expect(isPlausiblePhone('1234567890123456')).toBe(false);
    expect(isPlausiblePhone('+')).toBe(false);
    expect(isPlausiblePhone('++201001112233')).toBe(false);
    expect(isPlausiblePhone('0100+1112233')).toBe(false);
    expect(isPlausiblePhone('')).toBe(false);
  });
});
