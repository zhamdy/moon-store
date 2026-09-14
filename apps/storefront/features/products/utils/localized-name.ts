import type { AppLocale } from '@/i18n/routing';

export interface LocalizedText {
  text: string;
  /** The language the text is actually in, for the element's `lang` attribute. */
  lang: AppLocale;
}

/**
 * The name to show in `locale` (KD-7). Arabic is the primary name every entity has;
 * English falls back to it when `nameEn` is missing or blank, and says so through
 * `lang` so the text is announced and shaped as Arabic.
 */
export function localizedName(
  dto: { name: string; nameEn: string | null },
  locale: AppLocale
): LocalizedText {
  if (locale === 'en' && dto.nameEn !== null && dto.nameEn.trim() !== '') {
    return { text: dto.nameEn, lang: 'en' };
  }
  return { text: dto.name, lang: 'ar' };
}

/**
 * An optional Arabic-primary text pair in `locale`, or `null`. English falls back to the
 * Arabic (marked by `lang`), as names do; an Arabic page never shows English copy.
 * Empty and whitespace-only strings count as absent.
 */
export function localizedText(
  ar: string | null,
  en: string | null,
  locale: AppLocale
): LocalizedText | null {
  if (locale === 'en' && en?.trim()) return { text: en, lang: 'en' };
  return ar?.trim() ? { text: ar, lang: 'ar' } : null;
}

/** The description to show in `locale`, or `null` (see `localizedText`). */
export function localizedDescription(
  dto: { description: string | null; descriptionEn: string | null },
  locale: AppLocale
): LocalizedText | null {
  return localizedText(dto.description, dto.descriptionEn, locale);
}
