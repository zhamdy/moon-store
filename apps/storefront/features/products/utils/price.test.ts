import { describe, expect, it } from 'vitest';
import { formatPrice } from './price';

describe('formatPrice', () => {
  it('formats English with a grouping comma and a trailing label', () => {
    expect(formatPrice(1250, 'en', 'EGP')).toBe('1,250 EGP');
  });

  it('formats Arabic with Western digits and the Arabic label', () => {
    const result = formatPrice(1250, 'ar', 'ج.م');
    expect(result).toBe('1,250 ج.م');
    expect(result).not.toMatch(/[٠-٩]/);
  });

  it('formats zero', () => {
    expect(formatPrice(0, 'en', 'EGP')).toBe('0 EGP');
  });

  it('rounds to whole units with no decimals', () => {
    expect(formatPrice(4500.5, 'en', 'EGP')).toBe('4,501 EGP');
    expect(formatPrice(1999.4, 'en', 'EGP')).toBe('1,999 EGP');
  });
});
