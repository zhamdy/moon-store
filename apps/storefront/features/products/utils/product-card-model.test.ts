import { describe, expect, it } from 'vitest';
import { newArrivals, curatedEdit } from '../data/home-products';
import type { CatalogProduct } from '../types/catalog-product';
import { fromCatalogDto, fromHomeMock } from './product-card-model';

function dto(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    slug: 'silk-slip-dress',
    name: 'فستان حريري',
    nameEn: 'Silk slip dress',
    description: 'قصّة انسيابية من الحرير الطبيعي',
    descriptionEn: 'A fluid cut in natural silk',
    price: 2850,
    images: [
      { url: 'https://media.example.com/a.jpg' },
      { url: 'https://media.example.com/b.jpg' },
    ],
    isNew: false,
    inStock: true,
    options: [],
    variants: [],
    ...overrides,
  };
}

describe('fromCatalogDto', () => {
  it('maps two images to remote primary and secondary sources and a product href', () => {
    const model = fromCatalogDto(dto(), 'en');
    expect(model).toEqual({
      href: '/products/silk-slip-dress',
      name: { text: 'Silk slip dress', lang: 'en' },
      description: { text: 'A fluid cut in natural silk', lang: 'en' },
      price: 2850,
      priceFrom: false,
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

  it('shows the lowest variant price as "from" only when the variants differ', () => {
    const varied = fromCatalogDto(
      dto({
        options: [{ key: 'size', label: 'Size', values: ['S', 'M'] }],
        variants: [
          { options: { size: 'S' }, price: 2850, inStock: true },
          { options: { size: 'M' }, price: 3100, inStock: true },
        ],
      }),
      'en'
    );
    expect(varied).toMatchObject({ price: 2850, priceFrom: true });

    const level = fromCatalogDto(
      dto({
        options: [{ key: 'size', label: 'Size', values: ['S', 'M'] }],
        variants: [
          { options: { size: 'S' }, price: 2850, inStock: true },
          { options: { size: 'M' }, price: 2850, inStock: false },
        ],
      }),
      'en'
    );
    expect(level).toMatchObject({ price: 2850, priceFrom: false });
  });

  it('falls back to the Arabic description on an English page, and says so through lang', () => {
    expect(fromCatalogDto(dto({ descriptionEn: null }), 'en').description).toEqual({
      text: 'قصّة انسيابية من الحرير الطبيعي',
      lang: 'ar',
    });
  });

  it('has no description line when the product carries no copy', () => {
    expect(
      fromCatalogDto(dto({ description: null, descriptionEn: null }), 'ar').description
    ).toBeNull();
  });
});

describe('fromHomeMock', () => {
  // HIGH-1: an editorial frame names no product, so it may make no commerce claim —
  // no link to a page that may not exist, no price the store does not charge, no badge.
  it('preserves the static slots and makes no commerce claim', () => {
    const [mock] = newArrivals;
    expect(fromHomeMock(mock, 'en')).toEqual({
      href: null,
      name: { text: mock.name.en, lang: 'en' },
      description: null,
      priceFrom: false,
      price: null,
      primary: { kind: 'static', slot: mock.images.a },
      secondary: { kind: 'static', slot: mock.images.b },
      badge: null,
    });
  });

  it('names the frame in the page locale, so lang always matches it', () => {
    const [mock] = curatedEdit;
    expect(fromHomeMock(mock, 'ar').name).toEqual({ text: mock.name.ar, lang: 'ar' });
  });
});
