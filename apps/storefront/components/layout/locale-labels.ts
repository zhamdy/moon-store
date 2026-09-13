import { getTranslations } from 'next-intl/server';
import type { LocaleSwitcherProps } from './locale-switcher';

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
