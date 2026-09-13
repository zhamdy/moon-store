import type { Messages } from 'next-intl';
import type { EditorialSlot } from '@/lib/editorial/slots';

export type HeroSlideKey = keyof Messages['home']['hero']['slides'];

export interface HeroSlide {
  key: HeroSlideKey;
  /** Intended destination; 404s today (no placeholder pages). */
  href: string;
  desktop: EditorialSlot;
  mobile: EditorialSlot;
  /** `object-position` per crop, tuned to where the figure stands in the photo. */
  imageClassName: string;
}

/**
 * The hero's collections, in slide order. The first slide is the page's only
 * eager, high-priority image, so it should be the strongest photograph.
 */
export const heroSlides: readonly HeroSlide[] = [
  {
    key: 'evening',
    href: '/collections/evening',
    desktop: 'hero-desktop',
    mobile: 'hero-mobile',
    imageClassName: 'object-[50%_25%] md:object-[70%_30%]',
  },
  {
    key: 'linen',
    href: '/collections/linen',
    desktop: 'hero-linen-desktop',
    mobile: 'hero-linen-mobile',
    imageClassName: 'object-[50%_25%] md:object-[50%_30%]',
  },
  {
    key: 'abaya',
    href: '/collections/abayas',
    desktop: 'hero-abaya-desktop',
    mobile: 'hero-abaya-mobile',
    imageClassName: 'object-[50%_25%] md:object-[50%_30%]',
  },
  {
    key: 'knitwear',
    href: '/collections/knitwear',
    desktop: 'hero-knitwear-desktop',
    mobile: 'hero-knitwear-mobile',
    imageClassName: 'object-[50%_25%] md:object-[50%_30%]',
  },
];
