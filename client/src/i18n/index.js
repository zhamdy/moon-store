import { useMemo } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import en from './en.json';
import ar from './ar.json';

const messages = { en, ar };

function translate(locale, key, params) {
  const val = messages[locale]?.[key] || messages.en[key] || key;
  if (!params) return val;
  return val.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
}

/** Hook for use in functional components */
export function useTranslation() {
  const locale = useSettingsStore((s) => s.locale);
  const t = useMemo(() => (key, params) => translate(locale, key, params), [locale]);
  const isRtl = locale === 'ar';
  return { t, locale, isRtl };
}

/** Standalone function for use outside React (class components, Zod schemas, etc.) */
export function t(key, params) {
  const locale = useSettingsStore.getState().locale;
  return translate(locale, key, params);
}
