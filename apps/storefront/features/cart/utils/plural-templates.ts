import { fillTemplate } from '@/lib/utils/fill-template';

/** The six CLDR plural categories; Arabic uses all of them. */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

/**
 * Per-category `{count}` templates resolved on the server (`t.raw`), so a client island
 * pluralises without the message catalogue or an ICU formatter. `other` is the fallback.
 */
export type PluralTemplates = Partial<Record<PluralCategory, string>> & { other: string };

/** Picks the template `Intl.PluralRules` selects for `count` and fills `{count}`. */
export function selectPlural(templates: PluralTemplates, count: number, locale: string): string {
  const category = new Intl.PluralRules(locale).select(count) as PluralCategory;
  return fillTemplate(templates[category] ?? templates.other, { count });
}
