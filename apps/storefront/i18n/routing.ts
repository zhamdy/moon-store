import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];

const rtlLocales: readonly AppLocale[] = ['ar'];

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return rtlLocales.includes(locale as AppLocale) ? 'rtl' : 'ltr';
}
