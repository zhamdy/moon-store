import { toAsciiDigits } from '@/lib/utils/ascii-digits';

// Spaces (including no-break), hyphens, dots and parentheses people type inside a number.
const PHONE_PUNCTUATION = /[\s \-.()]/g;

/**
 * The typed number with Arabic digits mapped and punctuation removed. A leading `+` stays;
 * nothing else is inferred (no country code is added).
 */
export function normalizePhone(raw: string): string {
  return toAsciiDigits(raw.trim()).replace(PHONE_PUNCTUATION, '');
}

/**
 * Deliberately broad (owner decision 2026-09-15, CO-9): an optional leading `+` and 8-15
 * digits. 15 is the E.164 maximum; 8 rejects obvious typos. No Egyptian prefix rule: that
 * business rule is not approved.
 */
export function isPlausiblePhone(raw: string): boolean {
  return /^\+?\d{8,15}$/.test(normalizePhone(raw));
}
