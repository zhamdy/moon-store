import type { AppLocale } from '@/i18n/routing';

// Western digits in both locales (`nu-latn` keeps `1,250` from becoming `١٬٢٥٠`),
// no decimals, currency label trailing as in the guideline card: `1,250 EGP`.
// Not `style: 'currency'`, whose symbol choice and position differ per ICU build
// and per locale. If Eastern Arabic digits are preferred, drop the `-u-nu-latn`.
const numberLocale: Record<AppLocale, string> = {
  en: 'en-EG',
  ar: 'ar-EG-u-nu-latn',
};

/**
 * Pure: the localised currency label (`products.currency`) is passed in by the
 * server component that owns the translations, so this needs no catalogue.
 */
export function formatPrice(amount: number, locale: AppLocale, currencyLabel: string): string {
  const number = new Intl.NumberFormat(numberLocale[locale], {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${number} ${currencyLabel}`;
}
