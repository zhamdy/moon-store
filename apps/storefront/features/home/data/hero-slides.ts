import type { Messages } from 'next-intl';
import type { EditorialSlot } from '@/lib/editorial/slots';

export type HeroSlideKey = keyof Messages['home']['hero']['slides'];

export interface HeroSlide {
  key: HeroSlideKey;
  /** Intended destination; 404s today (no placeholder pages). */
  href: string;
  /** Wide crop (16:10), used when the viewport is at least 3:2. */
  wide: EditorialSlot;
  /** Portrait crop (4:5), used on phones, tablets and 4:3 screens. */
  portrait: EditorialSlot;
  /**
   * `object-position` for the portrait crop, which on a landscape tablet is cut
   * top and bottom: keep the figure's head in view.
   */
  imageClassName: string;
}

/**
 * The hero's collections, in slide order. The first slide is the page's only
 * eager, high-priority image, so it should be the strongest photograph.
 *
 * Every hero photograph keeps its figure centred with empty floor below, because
 * the copy sits bottom-left in English and bottom-right in Arabic and photographs
 * are never mirrored (docs/design/editorial-image-brief.md).
 */
export const heroSlides: readonly HeroSlide[] = [
  {
    key: 'evening',
    href: '/collections/evening',
    wide: 'hero-desktop',
    portrait: 'hero-mobile',
    imageClassName: 'object-[50%_30%]',
  },
  {
    key: 'linen',
    href: '/collections/linen',
    wide: 'hero-linen-desktop',
    portrait: 'hero-linen-mobile',
    imageClassName: 'object-[50%_30%]',
  },
  {
    key: 'abaya',
    href: '/collections/abayas',
    wide: 'hero-abaya-desktop',
    portrait: 'hero-abaya-mobile',
    imageClassName: 'object-[50%_30%]',
  },
  {
    key: 'knitwear',
    href: '/collections/knitwear',
    wide: 'hero-knitwear-desktop',
    portrait: 'hero-knitwear-mobile',
    // Higher than the others: on a 4:3 laptop the portrait crop is cut top and
    // bottom, and at 30% the trousers reached the English body line (freeze
    // capture, 2026-09-14). Phones and portrait tablets are cut at the sides, not
    // vertically, so this changes nothing there.
    imageClassName: 'object-[50%_44%]',
  },
];
