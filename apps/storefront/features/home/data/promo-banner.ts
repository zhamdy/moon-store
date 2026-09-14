import type { EditorialSlot } from '@/lib/editorial/slots';

export interface PromoBannerData {
  /**
   * Locale-less, absolute (`/...`) destination. `@/i18n/navigation`'s `Link` adds
   * the locale prefix, so this must never carry one itself.
   */
  href: string;
  /** 16:9 desktop/tablet crop, shown from 768px. */
  wide: EditorialSlot;
  /** 4:5 mobile crop, shown below 768px. */
  portrait: EditorialSlot;
  /**
   * `object-position` for the portrait crop, below 768px. Written as a full
   * class name (no `md:` prefix) so Tailwind's static scanner can find it as a
   * complete candidate string in this file.
   */
  portraitImageClassName: string;
  /**
   * `object-position` for the wide crop, from 768px. Carries its own `md:`
   * prefix for the same reason — building it by concatenating a bare
   * `md:` + a dynamic value at runtime would never appear in source as one
   * token, and Tailwind would not generate the rule.
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
  wideImageClassName: 'md:object-[70%_30%]',
};
