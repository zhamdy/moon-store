import { describe, expect, it } from 'vitest';
import { validateVariantDraft, type VariantDraft } from './variantDraft';

const MESSAGES = {
  skuRequired: 'SKU is required',
  pricePositive: 'Price must be a positive number, or blank to use the product price',
  costNonNegative: 'Cost cannot be negative',
  stockInteger: 'Stock must be a whole number, zero or more',
  attributesRequired: 'At least one attribute is required',
};

const draft = (over: Partial<VariantDraft> = {}): VariantDraft => ({
  sku: 'MN-KNT-001-S',
  barcode: '',
  price: '',
  costPrice: '',
  stock: '4',
  attributes: [{ key: 'size', value: 'S' }],
  ...over,
});

describe('validateVariantDraft', () => {
  it('builds the request body from a valid draft', () => {
    expect(validateVariantDraft(draft(), MESSAGES).body).toEqual({
      sku: 'MN-KNT-001-S',
      barcode: null,
      price: null,
      cost_price: 0,
      stock: 4,
      attributes: { size: 'S' },
    });
  });

  /**
   * MED-12, the defect this exists for: `Number(stock) || 0` turned a typo into a
   * perfectly valid request creating the variant with stock 0, and said nothing. On a
   * variant product that column is what governs sale.
   */
  it('refuses a non-numeric stock instead of silently zeroing it', () => {
    const result = validateVariantDraft(draft({ stock: 'abc' }), MESSAGES);
    expect(result.body).toBeUndefined();
    expect(result.errors.stock).toBe(MESSAGES.stockInteger);
  });

  it('refuses a partly-numeric entry rather than parsing its prefix', () => {
    expect(validateVariantDraft(draft({ stock: '12abc' }), MESSAGES).errors.stock).toBeTruthy();
    expect(validateVariantDraft(draft({ price: '99kg' }), MESSAGES).errors.price).toBeTruthy();
  });

  it('refuses a negative or fractional stock', () => {
    expect(validateVariantDraft(draft({ stock: '-1' }), MESSAGES).errors.stock).toBeTruthy();
    expect(validateVariantDraft(draft({ stock: '1.5' }), MESSAGES).errors.stock).toBeTruthy();
  });

  it('requires a stock figure rather than defaulting it', () => {
    expect(validateVariantDraft(draft({ stock: '' }), MESSAGES).errors.stock).toBeTruthy();
  });

  /** Blank price is the NULL override seam; zero and negative are refused. */
  it('keeps a blank price as the inherit-the-product-price null', () => {
    expect(validateVariantDraft(draft({ price: '' }), MESSAGES).body?.price).toBeNull();
  });

  it('refuses a zero or negative price, matching the server and migration 019', () => {
    expect(validateVariantDraft(draft({ price: '0' }), MESSAGES).errors.price).toBeTruthy();
    expect(validateVariantDraft(draft({ price: '-5' }), MESSAGES).errors.price).toBeTruthy();
  });

  it('keeps an explicit price override', () => {
    expect(validateVariantDraft(draft({ price: '2750' }), MESSAGES).body?.price).toBe(2750);
  });

  it('requires a SKU and at least one complete attribute pair', () => {
    expect(validateVariantDraft(draft({ sku: '  ' }), MESSAGES).errors.sku).toBeTruthy();
    expect(
      validateVariantDraft(draft({ attributes: [{ key: 'size', value: '' }] }), MESSAGES).errors
        .attributes
    ).toBeTruthy();
  });

  it('trims, and drops an incomplete attribute pair rather than sending a blank key', () => {
    const result = validateVariantDraft(
      draft({
        sku: '  MN-1  ',
        barcode: ' 6221002001 ',
        attributes: [
          { key: ' size ', value: ' S ' },
          { key: 'colour', value: '   ' },
        ],
      }),
      MESSAGES
    );
    expect(result.body).toMatchObject({
      sku: 'MN-1',
      barcode: '6221002001',
      attributes: { size: 'S' },
    });
  });

  it('reports every bad field at once, so the operator fixes them in one pass', () => {
    const result = validateVariantDraft(
      draft({ sku: '', price: 'abc', stock: 'abc', attributes: [] }),
      MESSAGES
    );
    expect(Object.keys(result.errors).sort()).toEqual(['attributes', 'price', 'sku', 'stock']);
  });
});
