import type { LocalizedText } from '@/features/products/utils/localized-name';

/**
 * The intro's description line under its `h1` (owner decision, 2026-09-14: the former
 * eyebrow is the title and the former title is the description). Where both say the
 * same thing (`/collections` is "Collections" twice) the description is dropped rather
 * than rendered as an echo of the heading.
 */
export function introDescription(heading: string, lead: LocalizedText): LocalizedText | null {
  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  return normalize(lead.text) === '' || normalize(lead.text) === normalize(heading) ? null : lead;
}
