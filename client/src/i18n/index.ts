import { useMemo } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import en from './en.json';
import ar from './ar.json';

export type Locale = 'en' | 'ar';

type TranslationParams = Record<string, string | number>;

type TranslationFunction = (key: string, params?: TranslationParams) => string;

const messages: Record<Locale, Record<string, string>> = { en, ar };

function translate(locale: Locale, key: string, params?: TranslationParams): string {
  const val = messages[locale]?.[key] || messages.en[key] || key;
  if (!params) return val;
  return val.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}

export interface UseTranslationReturn {
  t: TranslationFunction;
  locale: Locale;
  isRtl: boolean;
}

/** Hook for use in functional components */
export function useTranslation(): UseTranslationReturn {
  const locale = useSettingsStore((s) => s.locale) as Locale;
  const t: TranslationFunction = useMemo(
    () => (key, params) => translate(locale, key, params),
    [locale]
  );
  const isRtl = locale === 'ar';
  return { t, locale, isRtl };
}

/** Standalone function for use outside React (class components, Zod schemas, etc.) */
export function t(key: string, params?: TranslationParams): string {
  const locale = useSettingsStore.getState().locale as Locale;
  return translate(locale, key, params);
}
