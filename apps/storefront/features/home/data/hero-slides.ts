import type { Messages } from 'next-intl';
import type { EditorialSlot } from '@/lib/editorial/slots';

export type HeroSlideKey = keyof Messages['home']['hero']['slides'];

export interface HeroSlide {
  key: HeroSlideKey;
  /**
   * `/shop/<category>` or `/collections/<slug>`, naming a `REQUIRED_CATALOG_KEYS` key
   * (enforced by `commerce-hrefs.test.ts`).
   */
  href: string;
  /** Wide crop (16:10), used when the viewport is at least 3:2. */
  wide: EditorialSlot;
  /** Portrait crop (4:5), used on phones, tablets and 4:3 screens. */
  portrait: EditorialSlot;
  /** Keep the close editorial portraits top-aligned without additional zoom. */
  imageClassName: string;
}

/**
 * The hero's collections, in slide order. The first slide is the page's only
 * eager, high-priority image, so it should be the strongest photograph.
 *
 * Close editorial portraits use their native crop without extra zoom.
 * Photographs are never mirrored; scrims support copy in both locales.
 */
export const heroSlides: readonly HeroSlide[] = [
  {
    key: 'evening',
    href: '/collections/evening',
    wide: 'hero-desktop',
    portrait: 'hero-mobile',
    imageClassName: 'object-top origin-top',
  },
  {
    key: 'linen',
    href: '/collections/linen',
    wide: 'hero-linen-desktop',
    portrait: 'hero-linen-mobile',
    imageClassName: 'object-top origin-top',
  },
  {
    key: 'abaya',
    href: '/shop/abayas',
    wide: 'hero-abaya-desktop',
    portrait: 'hero-abaya-mobile',
    imageClassName: 'object-top origin-top',
  },
  {
    key: 'knitwear',
    href: '/shop/knitwear',
    wide: 'hero-knitwear-desktop',
    portrait: 'hero-knitwear-mobile',
    imageClassName: 'object-top origin-top',
  },
];
