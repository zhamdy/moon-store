import { describe, expect, it } from 'vitest';
import { newArrivals, curatedEdit } from '../data/home-products';
import type { CatalogProduct } from '../types/catalog-product';
import { fromCatalogDto, fromHomeMock } from './product-card-model';

function dto(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    slug: 'silk-slip-dress',
    name: 'فستان حريري',
    nameEn: 'Silk slip dress',
    price: 2850,
    images: [
      { url: 'https://media.example.com/a.jpg' },
      { url: 'https://media.example.com/b.jpg' },
    ],
    isNew: false,
    inStock: true,
    ...overrides,
  };
}

describe('fromCatalogDto', () => {
  it('maps two images to remote primary and secondary sources and a product href', () => {
    const model = fromCatalogDto(dto(), 'en');
    expect(model).toEqual({
      href: '/products/silk-slip-dress',
      name: { text: 'Silk slip dress', lang: 'en' },
      price: 2850,
      primary: { kind: 'remote', url: 'https://media.example.com/a.jpg' },
      secondary: { kind: 'remote', url: 'https://media.example.com/b.jpg' },
      badge: null,
    });
  });

  it('carries lang "ar" when an English page falls back to the Arabic name', () => {
    expect(fromCatalogDto(dto({ nameEn: null }), 'en').name).toEqual({
      text: 'فستان حريري',
      lang: 'ar',
    });
  });

  it('uses the Arabic name with lang "ar" on an Arabic page', () => {
    expect(fromCatalogDto(dto(), 'ar').name).toEqual({ text: 'فستان حريري', lang: 'ar' });
  });

  it('gives a null secondary for one image and null for both with none', () => {
    const one = fromCatalogDto(dto({ images: [{ url: 'https://media.example.com/a.jpg' }] }), 'en');
    expect(one.primary).toEqual({ kind: 'remote', url: 'https://media.example.com/a.jpg' });
    expect(one.secondary).toBeNull();

    const none = fromCatalogDto(dto({ images: [] }), 'en');
    expect(none.primary).toBeNull();
    expect(none.secondary).toBeNull();
  });

  it('lets sold out win over new', () => {
    expect(fromCatalogDto(dto({ inStock: false, isNew: true }), 'en').badge).toBe('soldOut');
    expect(fromCatalogDto(dto({ inStock: false, isNew: false }), 'en').badge).toBe('soldOut');
  });

  it('badges an in-stock new product as new, and nothing otherwise', () => {
    expect(fromCatalogDto(dto({ inStock: true, isNew: true }), 'en').badge).toBe('new');
    expect(fromCatalogDto(dto({ inStock: true, isNew: false }), 'en').badge).toBeNull();
  });
});

describe('fromHomeMock', () => {
  it('preserves the static slots, price and isNew as the new badge', () => {
    const [mock] = newArrivals;
    expect(fromHomeMock(mock, 'en')).toEqual({
      href: `/products/${mock.slug}`,
      name: { text: mock.name.en, lang: 'en' },
      price: mock.price,
      primary: { kind: 'static', slot: mock.images.a },
      secondary: { kind: 'static', slot: mock.images.b },
      badge: 'new',
    });
  });

  it('names the product in the page locale, so lang always matches it', () => {
    const [mock] = curatedEdit;
    expect(fromHomeMock(mock, 'ar').name).toEqual({ text: mock.name.ar, lang: 'ar' });
  });

  it('gives no badge to a mock that is not new', () => {
    const [mock] = curatedEdit;
    expect(mock.isNew).toBeFalsy();
    expect(fromHomeMock(mock, 'en').badge).toBeNull();
  });
});
