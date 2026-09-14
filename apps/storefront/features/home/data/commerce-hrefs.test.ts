import { describe, expect, it } from 'vitest';
import { homeCategories } from '@/features/collections/data/home-categories';
import { REQUIRED_CATALOG_KEYS } from '@/features/collections/data/required-catalog-keys';
import { heroSlides } from './hero-slides';
import { promoBanner } from './promo-banner';

const categories = new Set<string>(REQUIRED_CATALOG_KEYS.categories);
const collections = new Set<string>(REQUIRED_CATALOG_KEYS.collections);

const hrefs: readonly [source: string, href: string][] = [
  ...homeCategories.map((tile) => [`category ${tile.key}`, tile.href] as [string, string]),
  ...heroSlides.map((slide) => [`hero ${slide.key}`, slide.href] as [string, string]),
  ['promo banner', promoBanner.href],
];

/** Null when the href is neither `/shop/<key>` nor `/collections/<key>` with a known key. */
function requiredKeyOf(href: string): string | null {
  const shop = /^\/shop\/([a-z0-9-]+)$/.exec(href);
  if (shop) return categories.has(shop[1]) ? shop[1] : null;
  const collection = /^\/collections\/([a-z0-9-]+)$/.exec(href);
  if (collection) return collections.has(collection[1]) ? collection[1] : null;
  return null;
}

describe('homepage commerce hrefs', () => {
  it.each(hrefs)('%s (%s) names a REQUIRED_CATALOG_KEYS key', (_source, href) => {
    expect(requiredKeyOf(href)).not.toBeNull();
  });

  it('points every category tile at its own shop page', () => {
    for (const tile of homeCategories) expect(tile.href).toBe(`/shop/${tile.key}`);
  });

  it('rejects any other commerce href shape', () => {
    expect(requiredKeyOf('/collections/dresses')).toBeNull();
    expect(requiredKeyOf('/shop/silk')).toBeNull();
    expect(requiredKeyOf('/shop?category=dresses')).toBeNull();
    expect(requiredKeyOf('/shop/dresses/extra')).toBeNull();
    expect(requiredKeyOf('/en/shop/dresses')).toBeNull();
  });
});
