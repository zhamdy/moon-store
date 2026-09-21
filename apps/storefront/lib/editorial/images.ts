import type { StaticImageData } from 'next/image';
import type { ImageRole, ImageSlot } from './slots';
import heroDesktop from '@/assets/editorial/hero-desktop.jpg';
import heroMobile from '@/assets/editorial/hero-mobile.jpg';
import heroLinenDesktop from '@/assets/editorial/hero-linen-desktop.jpg';
import heroLinenMobile from '@/assets/editorial/hero-linen-mobile.jpg';
import heroAbayaDesktop from '@/assets/editorial/hero-abaya-desktop.jpg';
import heroAbayaMobile from '@/assets/editorial/hero-abaya-mobile.jpg';
import heroKnitwearDesktop from '@/assets/editorial/hero-knitwear-desktop.jpg';
import heroKnitwearMobile from '@/assets/editorial/hero-knitwear-mobile.jpg';
import strip01 from '@/assets/editorial/strip-01.jpg';
import strip02 from '@/assets/editorial/strip-02.jpg';
import strip03 from '@/assets/editorial/strip-03.jpg';
import strip04 from '@/assets/editorial/strip-04.jpg';
import silkEditCampaign from '@/assets/editorial/silk-edit-campaign.png';
import featuredLarge from '@/assets/editorial/featured-large.jpg';
import featuredSmall from '@/assets/editorial/featured-small.jpg';
import categoryDresses from '@/assets/editorial/category-dresses.jpg';
import categoryTops from '@/assets/editorial/category-tops.jpg';
import categoryKnitwear from '@/assets/editorial/category-knitwear.jpg';
import categoryBags from '@/assets/editorial/category-bags.jpg';
import categoryAbayas from '@/assets/editorial/category-abayas.jpg';
import campaign from '@/assets/editorial/campaign.jpg';
import lookbook01 from '@/assets/editorial/lookbook-01.jpg';
import lookbook02 from '@/assets/editorial/lookbook-02.jpg';
import lookbook03 from '@/assets/editorial/lookbook-03.jpg';
import lookbook04 from '@/assets/editorial/lookbook-04.jpg';
import lookbook05 from '@/assets/editorial/lookbook-05.jpg';
import product01a from '@/assets/editorial/product-01-a.jpg';
import product01b from '@/assets/editorial/product-01-b.jpg';
import product02a from '@/assets/editorial/product-02-a.jpg';
import product02b from '@/assets/editorial/product-02-b.jpg';
import product03a from '@/assets/editorial/product-03-a.jpg';
import product03b from '@/assets/editorial/product-03-b.jpg';
import product04a from '@/assets/editorial/product-04-a.jpg';
import product04b from '@/assets/editorial/product-04-b.jpg';
import product05a from '@/assets/editorial/product-05-a.jpg';
import product05b from '@/assets/editorial/product-05-b.jpg';
import product06a from '@/assets/editorial/product-06-a.jpg';
import product06b from '@/assets/editorial/product-06-b.jpg';
import product07a from '@/assets/editorial/product-07-a.jpg';
import product07b from '@/assets/editorial/product-07-b.jpg';
import product08a from '@/assets/editorial/product-08-a.jpg';
import product08b from '@/assets/editorial/product-08-b.jpg';
import product09a from '@/assets/editorial/product-09-a.jpg';
import product09b from '@/assets/editorial/product-09-b.jpg';

export interface EditorialImage {
  src: StaticImageData;
  role: ImageRole;
}

/**
 * The only module that imports editorial image files. Static imports give
 * `next/image` width, height and a blur placeholder for free; nothing under
 * `public/` is involved. To swap an asset, replace the file at the same path in
 * `assets/editorial/` (same ratio — see `docs/design/editorial-image-brief.md`),
 * then re-check text contrast on the hero and campaign — no code changes.
 *
 * Alt text is not stored here: it is a message key resolved by the consuming
 * section, so it localises. No spec may import this module under vitest.
 */
export const editorialImages = {
  'hero-desktop': { src: heroDesktop, role: 'hero' },
  'hero-mobile': { src: heroMobile, role: 'hero' },
  'hero-linen-desktop': { src: heroLinenDesktop, role: 'hero' },
  'hero-linen-mobile': { src: heroLinenMobile, role: 'hero' },
  'hero-abaya-desktop': { src: heroAbayaDesktop, role: 'hero' },
  'hero-abaya-mobile': { src: heroAbayaMobile, role: 'hero' },
  'hero-knitwear-desktop': { src: heroKnitwearDesktop, role: 'hero' },
  'hero-knitwear-mobile': { src: heroKnitwearMobile, role: 'hero' },
  'strip-01': { src: strip01, role: 'editorial' },
  'strip-02': { src: strip02, role: 'editorial' },
  'strip-03': { src: strip03, role: 'editorial' },
  'strip-04': { src: strip04, role: 'editorial' },
  moment: { src: silkEditCampaign, role: 'editorial' },
  'moment-wide': { src: silkEditCampaign, role: 'editorial' },
  'featured-large': { src: featuredLarge, role: 'editorial' },
  'featured-small': { src: featuredSmall, role: 'editorial' },
  'category-dresses': { src: categoryDresses, role: 'category' },
  'category-tops': { src: categoryTops, role: 'category' },
  'category-knitwear': { src: categoryKnitwear, role: 'category' },
  'category-bags': { src: categoryBags, role: 'category' },
  'category-abayas': { src: categoryAbayas, role: 'category' },
  campaign: { src: campaign, role: 'editorial' },
  'lookbook-01': { src: lookbook01, role: 'lookbook' },
  'lookbook-02': { src: lookbook02, role: 'lookbook' },
  'lookbook-03': { src: lookbook03, role: 'lookbook' },
  'lookbook-04': { src: lookbook04, role: 'lookbook' },
  'lookbook-05': { src: lookbook05, role: 'lookbook' },
  'product-01-a': { src: product01a, role: 'catalog' },
  'product-01-b': { src: product01b, role: 'catalog' },
  'product-02-a': { src: product02a, role: 'catalog' },
  'product-02-b': { src: product02b, role: 'catalog' },
  'product-03-a': { src: product03a, role: 'catalog' },
  'product-03-b': { src: product03b, role: 'catalog' },
  'product-04-a': { src: product04a, role: 'catalog' },
  'product-04-b': { src: product04b, role: 'catalog' },
  'product-05-a': { src: product05a, role: 'catalog' },
  'product-05-b': { src: product05b, role: 'catalog' },
  'product-06-a': { src: product06a, role: 'catalog' },
  'product-06-b': { src: product06b, role: 'catalog' },
  'product-07-a': { src: product07a, role: 'catalog' },
  'product-07-b': { src: product07b, role: 'catalog' },
  'product-08-a': { src: product08a, role: 'catalog' },
  'product-08-b': { src: product08b, role: 'catalog' },
  'product-09-a': { src: product09a, role: 'catalog' },
  'product-09-b': { src: product09b, role: 'catalog' },
} as const satisfies Record<ImageSlot, EditorialImage>;
