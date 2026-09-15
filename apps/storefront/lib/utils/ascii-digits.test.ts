import { describe, expect, it } from 'vitest';
import { toAsciiDigits } from './ascii-digits';

describe('toAsciiDigits', () => {
  it('maps Eastern Arabic and Persian digits', () => {
    expect(toAsciiDigits('١٢٣')).toBe('123');
    expect(toAsciiDigits('۰۱۲')).toBe('012');
    expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('keeps everything that is not a digit, including spaces and signs', () => {
    expect(toAsciiDigits('+٢٠ 10')).toBe('+20 10');
    expect(toAsciiDigits(' (٠١٠) ')).toBe(' (010) ');
    expect(toAsciiDigits('abc')).toBe('abc');
  });
});
