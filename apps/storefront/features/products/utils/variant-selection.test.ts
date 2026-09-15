import { describe, expect, it } from 'vitest';
import type { CatalogProductOption, CatalogProductVariant } from '../types/catalog-product-detail';
import {
  availabilityStatus,
  displayedPrice,
  initialSelection,
  purchaseReadiness,
  selectedVariant,
  valueAvailable,
  type PurchaseProduct,
  type Selection,
} from './variant-selection';

const sizeOption: CatalogProductOption = { key: 'size', label: 'Size', values: ['S', 'M', 'L'] };

function variant(
  options: Record<string, string>,
  inStock = true,
  price = 1200
): CatalogProductVariant {
  return { options, price, inStock };
}

function product(overrides: Partial<PurchaseProduct> = {}): PurchaseProduct {
  return { price: 1200, inStock: true, options: [], variants: [], ...overrides };
}

const knit = product({
  options: [sizeOption],
  variants: [variant({ size: 'S' }), variant({ size: 'M' }, false), variant({ size: 'L' })],
});

// size x color with S/black missing entirely and M/ivory sold out.
const twoOptions = product({
  options: [
    { key: 'size', label: 'Size', values: ['S', 'M'] },
    { key: 'color', label: 'Color', values: ['Black', 'Ivory'] },
  ],
  variants: [
    variant({ size: 'S', color: 'Ivory' }),
    variant({ size: 'M', color: 'Black' }),
    variant({ size: 'M', color: 'Ivory' }, false),
  ],
});

describe('initialSelection', () => {
  it('preselects a single-value option and leaves a multi-value option null', () => {
    const selection = initialSelection([
      { key: 'fit', label: 'Fit', values: ['Regular'] },
      sizeOption,
    ]);
    expect(selection).toEqual({ fit: 'Regular', size: null });
  });

  it('is empty with no options', () => {
    expect(initialSelection([])).toEqual({});
  });
});

describe('one option', () => {
  it('selecting an in-stock L gives the variant, an exact price, in stock and ready', () => {
    const selection: Selection = { size: 'L' };
    expect(selectedVariant(selection, knit)).toEqual(variant({ size: 'L' }));
    expect(displayedPrice(selection, knit)).toEqual({ kind: 'exact', price: 1200 });
    expect(availabilityStatus(selection, knit)).toBe('inStock');
    expect(purchaseReadiness(selection, knit)).toEqual({ kind: 'ready', options: { size: 'L' } });
  });

  it('selecting a sold-out M gives the variant, sold out and soldOut readiness', () => {
    const selection: Selection = { size: 'M' };
    expect(selectedVariant(selection, knit)).toEqual(variant({ size: 'M' }, false));
    expect(availabilityStatus(selection, knit)).toBe('soldOut');
    expect(purchaseReadiness(selection, knit)).toEqual({ kind: 'soldOut' });
  });

  it('marks a sold-out value unavailable and in-stock values available', () => {
    const selection: Selection = { size: null };
    expect(valueAvailable('size', 'S', selection, knit.variants)).toBe(true);
    expect(valueAvailable('size', 'M', selection, knit.variants)).toBe(false);
  });

  it('never marks a listed value with no variant available', () => {
    const partial = product({ options: [sizeOption], variants: [variant({ size: 'S' })] });
    expect(valueAvailable('size', 'L', { size: null }, partial.variants)).toBe(false);
    expect(valueAvailable('size', 'L', { size: 'L' }, partial.variants)).toBe(false);
  });

  it('has no selected variant and needs selection while unselected', () => {
    const selection = initialSelection(knit.options);
    expect(selectedVariant(selection, knit)).toBeNull();
    expect(availabilityStatus(selection, knit)).toBe('none');
    expect(purchaseReadiness(selection, knit)).toEqual({ kind: 'needsSelection', keys: ['size'] });
  });
});

describe('no options', () => {
  it('is ready immediately with empty options when the product is in stock', () => {
    const plain = product();
    const selection = initialSelection(plain.options);
    expect(selectedVariant(selection, plain)).toBeNull();
    expect(displayedPrice(selection, plain)).toEqual({ kind: 'exact', price: 1200 });
    expect(availabilityStatus(selection, plain)).toBe('none');
    expect(purchaseReadiness(selection, plain)).toEqual({ kind: 'ready', options: {} });
  });

  it('is sold out, never ready, when the product is not in stock', () => {
    // Also the shape of a variant product with no usable variants.
    const soldOut = product({ inStock: false });
    expect(availabilityStatus({}, soldOut)).toBe('soldOut');
    expect(purchaseReadiness({}, soldOut)).toEqual({ kind: 'soldOut' });
  });
});

describe('two options with a missing combination', () => {
  it('makes a value unavailable given the other choice', () => {
    expect(valueAvailable('color', 'Black', { size: 'S', color: null }, twoOptions.variants)).toBe(
      false
    );
    expect(valueAvailable('size', 'S', { size: null, color: 'Black' }, twoOptions.variants)).toBe(
      false
    );
  });

  it('makes it available again when the other choice changes', () => {
    expect(valueAvailable('color', 'Black', { size: 'M', color: null }, twoOptions.variants)).toBe(
      true
    );
  });

  it('makes it available again when the other choice is cleared', () => {
    expect(valueAvailable('color', 'Black', { size: null, color: null }, twoOptions.variants)).toBe(
      true
    );
  });

  it('ignores the key own current choice when judging its values', () => {
    expect(valueAvailable('size', 'S', { size: 'M', color: 'Ivory' }, twoOptions.variants)).toBe(
      true
    );
  });

  it('treats a combination that is sold out as unavailable', () => {
    expect(valueAvailable('color', 'Ivory', { size: 'M', color: null }, twoOptions.variants)).toBe(
      false
    );
  });

  it('has no selected variant while one key is unselected', () => {
    expect(selectedVariant({ size: 'M', color: null }, twoOptions)).toBeNull();
  });

  it('is sold out when every key is chosen but no variant has that combination', () => {
    const selection: Selection = { size: 'S', color: 'Black' };
    expect(selectedVariant(selection, twoOptions)).toBeNull();
    expect(purchaseReadiness(selection, twoOptions)).toEqual({ kind: 'soldOut' });
  });

  it('is ready with the full option record for an in-stock combination', () => {
    expect(purchaseReadiness({ size: 'M', color: 'Black' }, twoOptions)).toEqual({
      kind: 'ready',
      options: { size: 'M', color: 'Black' },
    });
  });
});

describe('displayedPrice', () => {
  const priced = product({
    price: 1000,
    options: [sizeOption],
    variants: [
      variant({ size: 'S' }, true, 1400),
      variant({ size: 'M' }, false, 1100),
      variant({ size: 'L' }, true, 1250),
    ],
  });

  it('is from the minimum, sold-out variants included, when prices differ and nothing is selected', () => {
    expect(displayedPrice({ size: null }, priced)).toEqual({ kind: 'from', price: 1100 });
  });

  it('is the selected variant price once selected', () => {
    expect(displayedPrice({ size: 'L' }, priced)).toEqual({ kind: 'exact', price: 1250 });
  });

  it('is exact when every variant price is equal', () => {
    expect(displayedPrice({ size: null }, knit)).toEqual({ kind: 'exact', price: 1200 });
  });

  it('uses the variant price, not the product price, when all variants share one', () => {
    const uniform = product({
      price: 900,
      options: [sizeOption],
      variants: [variant({ size: 'S' }, true, 1300), variant({ size: 'M' }, true, 1300)],
    });
    expect(displayedPrice({ size: null }, uniform)).toEqual({ kind: 'exact', price: 1300 });
  });
});

describe('availabilityStatus', () => {
  it('is sold out without a selection when the product is sold out', () => {
    const soldOut = product({
      inStock: false,
      options: [sizeOption],
      variants: [variant({ size: 'S' }, false), variant({ size: 'M' }, false)],
    });
    expect(availabilityStatus({ size: null }, soldOut)).toBe('soldOut');
  });

  it('shows nothing without a full selection when the product is in stock', () => {
    expect(availabilityStatus({ size: null, color: 'Black' }, twoOptions)).toBe('none');
  });
});

describe('purchaseReadiness precedence', () => {
  it('lists every unselected key in option order, not selection insertion order', () => {
    const selection: Selection = { color: null, size: null };
    expect(purchaseReadiness(selection, twoOptions)).toEqual({
      kind: 'needsSelection',
      keys: ['size', 'color'],
    });
  });

  it('treats a key missing from the selection as unselected', () => {
    expect(purchaseReadiness({ color: 'Black' }, twoOptions)).toEqual({
      kind: 'needsSelection',
      keys: ['size'],
    });
  });

  it('puts product soldOut before needsSelection', () => {
    const soldOut = { ...twoOptions, inStock: false };
    expect(purchaseReadiness({ size: null, color: null }, soldOut)).toEqual({ kind: 'soldOut' });
  });

  it('puts needsSelection before a sold-out partial choice', () => {
    expect(purchaseReadiness({ size: 'M', color: null }, twoOptions)).toEqual({
      kind: 'needsSelection',
      keys: ['color'],
    });
  });

  it('returns a copy of the options, not the variant record', () => {
    const result = purchaseReadiness({ size: 'L' }, knit);
    expect(result.kind).toBe('ready');
    if (result.kind === 'ready') {
      expect(result.options).not.toBe(knit.variants[2]!.options);
    }
  });
});
