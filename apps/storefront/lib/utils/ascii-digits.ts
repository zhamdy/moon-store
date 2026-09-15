// Eastern Arabic (U+0660-0669) and Persian (U+06F0-06F9) digits.
const NON_ASCII_DIGIT = /[٠-٩۰-۹]/g;

/**
 * Maps Eastern Arabic and Persian digits to ASCII and changes nothing else: no trimming, no
 * separator handling. Callers layer their own rules (a price, a phone number) on top.
 */
export function toAsciiDigits(raw: string): string {
  return raw.replace(NON_ASCII_DIGIT, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}
