import type { EditorialSlot } from '@/lib/editorial/slots';

export interface PromoBannerData {
  /**
   * Locale-less, absolute (`/...`) destination. `@/i18n/navigation`'s `Link` adds
   * the locale prefix, so this must never carry one itself.
   */
  href: string;
  /** Shown on landscape screens at least 768px wide and 4:3 (`banner-wide`). */
  wide: EditorialSlot;
  /** Shown on phones and portrait tablets. May be the same slot as `wide`. */
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
 * edit this record, `home.banner` in both message catalogues, and the photograph
 * at `assets/editorial/silk-edit-campaign.jpg`. No component change needed.
 *
 * Both crops name the same 16:9 source: the mobile background is cropped by
 * `portraitImageClassName` (the model sits at 82% horizontally) rather than by a
 * second file. `moment` / `moment-wide` are the older brand-moment slots and are
 * no longer what this banner renders.
 */
export const promoBanner: PromoBannerData = {
  href: '/collections/silk',
  wide: 'silk-edit-campaign',
  portrait: 'silk-edit-campaign',
  portraitImageClassName: 'object-[82%_center]',
  wideImageClassName: 'banner-wide:object-center',
};
