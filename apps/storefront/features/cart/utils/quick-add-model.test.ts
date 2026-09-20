import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from '@/features/products/types/catalog-product';
import { initialSelection, purchaseReadiness } from '@/features/products/utils/variant-selection';
import { quickAddPress, toQuickAddModel } from './quick-add-model';

function dto(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    slug: 'silk-slip-dress',
    name: 'فستان حريري',
    nameEn: 'Silk slip dress',
    description: null,
    descriptionEn: null,
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

const SIZES = {
  options: [{ key: 'size', label: 'Size', values: ['S', 'M'] }],
  variants: [
    { options: { size: 'S' }, price: 2850, inStock: true },
    { options: { size: 'M' }, price: 2850, inStock: false },
  ],
};

describe('toQuickAddModel', () => {
  it('carries the line identity, the hint and the server-derived options', () => {
    expect(toQuickAddModel(dto(SIZES), 'en')).toEqual({
      slug: 'silk-slip-dress',
      name: { text: 'Silk slip dress', lang: 'en' },
      imageUrl: 'https://media.example.com/a.jpg',
      price: 2850,
      inStock: true,
      options: SIZES.options,
      variants: SIZES.variants,
    });
  });

  it('marks an English page falling back to the Arabic name, and has no image to hint with', () => {
    const model = toQuickAddModel(dto({ nameEn: null, images: [] }), 'en');
    expect(model.name).toEqual({ text: 'فستان حريري', lang: 'ar' });
    expect(model.imageUrl).toBeNull();
  });
});

describe('quickAddPress', () => {
  const press = (product: CatalogProduct) => {
    const model = toQuickAddModel(product, 'en');
    return quickAddPress(purchaseReadiness(initialSelection(model.options), model));
  };

  it('adds straight away when the product sells as one piece', () => {
    expect(press(dto())).toBe('add');
  });

  it('adds straight away when every option has exactly one value: nothing is chosen for anyone', () => {
    expect(
      press(
        dto({
          options: [{ key: 'size', label: 'Size', values: ['One size'] }],
          variants: [{ options: { size: 'One size' }, price: 2850, inStock: true }],
        })
      )
    ).toBe('add');
  });

  it('opens the panel when a size is still to be chosen', () => {
    expect(press(dto(SIZES))).toBe('choose');
  });

  it('is sold out when the product is, whatever its options say', () => {
    expect(press(dto({ ...SIZES, inStock: false }))).toBe('soldOut');
  });
});
