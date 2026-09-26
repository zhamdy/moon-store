import { describe, expect, it } from 'vitest';
import { buildCatalogProductsPath } from '@/features/products/api/list-catalog-products';
import { defaultSortFor, type CatalogRoute } from '../search-params';
import { catalogRouteConfig } from './catalog-route';

const SHOP: CatalogRoute = { kind: 'all' };
const DRESSES: CatalogRoute = { kind: 'category', slug: 'dresses' };
const NEW_IN: CatalogRoute = { kind: 'new' };
const SILK: CatalogRoute = { kind: 'collection', slug: 'silk' };
const ROUTES = [SHOP, DRESSES, NEW_IN, SILK];

describe('catalogRouteConfig', () => {
  it('gives a collection curated first, then the listing sorts', () => {
    const config = catalogRouteConfig(SILK);
    expect(config.defaultSort).toBe('curated');
    expect(config.sorts).toEqual(['curated', 'newest', 'price-asc', 'price-desc']);
  });

  it('gives /shop newest and no curated sort', () => {
    const config = catalogRouteConfig(SHOP);
    expect(config.defaultSort).toBe('newest');
    expect(config.sorts).toEqual(['newest', 'price-asc', 'price-desc']);
  });

  it('shows category nav on Shop All and category pages only', () => {
    expect(catalogRouteConfig(SHOP).categoryNav).toBe(true);
    expect(catalogRouteConfig(DRESSES).categoryNav).toBe(true);
    expect(catalogRouteConfig(NEW_IN).categoryNav).toBe(false);
    expect(catalogRouteConfig(SILK).categoryNav).toBe(false);
  });

  it('agrees with the URL parser on every default sort, which it offers', () => {
    for (const route of ROUTES) {
      const config = catalogRouteConfig(route);
      expect(config.defaultSort).toBe(defaultSortFor(route));
      expect(config.sorts[0]).toBe(config.defaultSort);
    }
  });

  it('declares the API scope the listing request actually sends', () => {
    const query = {
      sort: 'newest',
      inStock: false,
      priceMin: null,
      priceMax: null,
      page: 1,
    } as const;
    for (const route of ROUTES) {
      const { apiScope } = catalogRouteConfig(route);
      const search = new URLSearchParams(
        buildCatalogProductsPath({ ...query, scope: route }).split('?')[1]
      );
      const sent = ['category', 'collection', 'new'].filter((key) => search.has(key));
      expect(sent).toEqual(apiScope === null ? [] : [apiScope]);
    }
  });

  it('closes New In with one editorial link, and nothing else', () => {
    expect(catalogRouteConfig(NEW_IN).endLink).toEqual({
      labelKey: 'shopByCategory',
      href: '/shop',
    });
    // A collection page ends on More collections, which the page composes itself.
    expect(catalogRouteConfig(SILK).endLink).toBeNull();
    expect(catalogRouteConfig(SHOP).endLink).toBeNull();
    expect(catalogRouteConfig(DRESSES).endLink).toBeNull();
  });
});
