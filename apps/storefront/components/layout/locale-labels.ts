import { getTranslations } from 'next-intl/server';
import type { LocaleSwitcherProps, LocaleToggleProps } from './locale-switcher';

/**
 * Resolves LocaleSwitcher's strings on the server so the client island never needs
 * the message catalogue. The object literal is checked against Record<AppLocale, string>,
 * so a locale added to i18n/routing.ts fails to compile here until it is named.
 */
export async function getLocaleSwitcherLabels(): Promise<LocaleSwitcherProps> {
  const t = await getTranslations('common');

  return {
    groupLabel: t('languageLabel'),
    labels: {
      en: t('localeNames.en'),
      ar: t('localeNames.ar'),
    },
  };
}

/** The header toggle's strings, resolved on the server for the same reason. */
export async function getLocaleToggleLabels(): Promise<Omit<LocaleToggleProps, 'className'>> {
  const t = await getTranslations('common');

  return {
    labels: {
      en: t('localeNames.en'),
      ar: t('localeNames.ar'),
    },
    shortLabels: {
      en: t('localeShort.en'),
      ar: t('localeShort.ar'),
    },
  };
}
