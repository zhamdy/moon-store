import type { EditorialSlot } from '@/lib/editorial/slots';

export interface PromoBannerData {
  /**
   * Locale-less, absolute (`/...`) destination. `@/i18n/navigation`'s `Link` adds
   * the locale prefix, so this must never carry one itself.
   */
  href: string;
  /** 16:9 crop, shown on landscape screens at least 768px wide and 4:3 (`banner-wide`). */
  wide: EditorialSlot;
  /** 4:5 crop, shown on phones and portrait tablets. */
  portrait: EditorialSlot;
  /**
   * `object-position` for the portrait crop. Written as a full class name so
   * Tailwind's static scanner can find it as a complete candidate string in this file.
   */
  portraitImageClassName: string;
  /**
   * `object-position` for the wide crop. Carries its own `banner-wide:` variant
   * (app/globals.css) for the same reason: concatenating a variant and a value at
   * runtime never appears in source as one token, so Tailwind would not generate it.
   */
  wideImageClassName: string;
}

/**
 * Repurposing the banner for a new collection or offer is a data + copy change:
 * edit this record, `home.banner` in both message catalogues, and the two files
 * at `assets/editorial/moment.jpg` / `moment-wide.jpg`. No component change
 * needed. The slot names `moment` / `moment-wide` are legacy (left over from the
 * guideline's replaced brand-moment section) and stay as-is; renaming them is
 * deferred to the Collections task that reuses this banner.
 */
export const promoBanner: PromoBannerData = {
  href: '/collections/silk',
  wide: 'moment-wide',
  portrait: 'moment',
  portraitImageClassName: 'object-[60%_30%]',
  wideImageClassName: 'banner-wide:object-[70%_30%]',
};
