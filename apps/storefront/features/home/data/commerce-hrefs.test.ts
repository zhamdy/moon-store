import { describe, expect, it } from 'vitest';
import { homeCategories } from '@/features/collections/data/home-categories';
import { REQUIRED_CATALOG_KEYS } from '@/features/collections/data/required-catalog-keys';
import { curatedEdit, newArrivals } from '@/features/products/data/home-products';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { fromCatalogDto, fromHomeMock } from '@/features/products/utils/product-card-model';
import { heroSlides } from './hero-slides';
import { collectionHref, homeCollections } from './home-collections';
import { promoBanner } from './promo-banner';

const categories = new Set<string>(REQUIRED_CATALOG_KEYS.categories);
const collections = new Set<string>(REQUIRED_CATALOG_KEYS.collections);

const hrefs: readonly [source: string, href: string][] = [
  ...homeCategories.map((tile) => [`category ${tile.key}`, tile.href] as [string, string]),
  ...heroSlides.map((slide) => [`hero ${slide.key}`, slide.href] as [string, string]),
  ['promo banner', promoBanner.href],
  ['featured collection', collectionHref(homeCollections.featured)],
  ['moon selection', collectionHref(homeCollections.selection)],
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

/**
 * HIGH-1: the homepage published nine `/products/<slug>` links built from static
 * editorial data, and five of them 404'd — the mock set is not a catalogue and could
 * never track one.
 *
 * The category and collection links above are guarded by naming a key the seed is
 * proven to serve (`REQUIRED_CATALOG_KEYS`, whose twin is
 * `apps/server/tests/database/seedCatalogKeys.test.ts`). A product slug cannot be
 * guarded that way — the catalogue's products are the store's to change, not a fixed
 * list. So the contract here is structural instead: **a product href may only come
 * from a catalog DTO.** The editorial set carries no slug, so there is nothing to
 * build one from.
 */
describe('homepage product hrefs originate in the catalogue', () => {
  const dto: CatalogProduct = {
    slug: 'silk-midi-dress',
    name: 'فستان ميدي من الحرير',
    nameEn: 'Silk midi dress',
    description: null,
    descriptionEn: null,
    price: 2850,
    images: [],
    isNew: true,
    inStock: true,
    options: [],
    variants: [],
  };

  it('emits a product href for a catalog DTO', () => {
    expect(fromCatalogDto(dto, 'en').href).toBe('/products/silk-midi-dress');
  });

  it('emits none for any editorial frame', () => {
    for (const frame of [...newArrivals, ...curatedEdit]) {
      expect(fromHomeMock(frame, 'en').href, frame.id).toBeNull();
    }
  });

  it('keeps the editorial frames structurally incapable of naming a product', () => {
    // If a `slug` is ever added back here, this fails before anything renders it.
    for (const frame of [...newArrivals, ...curatedEdit]) {
      expect(Object.keys(frame), frame.id).not.toContain('slug');
    }
  });
});
