/**
 * How the till *renders* money.
 *
 * This is presentation, not arithmetic — the amounts themselves still come from
 * `contracts/checkout-totals.v1.json` (D7). It mirrors `formatCurrency` in
 * `client/src/shared/lib/utils.ts`, and the one detail that catches people out is the
 * first line of it: **whole numbers drop their decimals**. A 150.00 EGP total renders as
 * `150 EG`, never `150.00 EGP`. Asserting the obvious-looking string would fail against a
 * perfectly correct till.
 *
 * If the app's formatter changes, assertions built on this fail — which is the right
 * outcome. What a cashier reads off the screen is part of what this suite covers.
 */
import type { Locale } from './i18n';

export function formatMoney(amountMajor: number, locale: Locale = 'en'): string {
  const isWholeNumber = amountMajor % 1 === 0;
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'decimal',
    minimumFractionDigits: isWholeNumber ? 0 : 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(amountMajor);
  return `${formatted} ${locale === 'ar' ? 'جم' : 'EG'}`;
}

/** The same, from the minor units the contract file speaks in. */
export function formatMoneyMinor(amountMinor: number, locale: Locale = 'en'): string {
  return formatMoney(amountMinor / 100, locale);
}
