import type { EditorialSlot } from '@/lib/editorial/slots';

export interface PromoBannerData {
  /**
   * Locale-less, absolute (`/...`) destination. `@/i18n/navigation`'s `Link` adds
   * the locale prefix, so this must never carry one itself.
   */
  href: string;
  /** The photograph's source from 1024, where it fills the split's inline-end column. */
  wide: EditorialSlot;
  /** The source below 1024, where the photograph sits above the copy. May equal `wide`. */
  portrait: EditorialSlot;
  /**
   * `object-position` for the portrait crop. Written as a full class name so
   * Tailwind's static scanner can find it as a complete candidate string in this file.
   */
  portraitImageClassName: string;
  /**
   * `object-position` for the split's crop from 1024. Carries its own `lg:` variant for
   * the same reason: a variant concatenated at runtime never appears in source as one
   * token, so Tailwind would not generate it.
   */
  wideImageClassName: string;
  /**
   * The small 4:5 detail set into the split from 1024 (homepage Phase 2): a close
   * crop of the fabric the section is named for. Decorative context, so it has its
   * own alt (`home.banner.detailAlt`).
   */
  detail: EditorialSlot;
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
  wideImageClassName: 'lg:object-[80%_center]',
  detail: 'strip-01',
};
