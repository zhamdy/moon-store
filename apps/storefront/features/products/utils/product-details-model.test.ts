import { describe, expect, it } from 'vitest';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import type { StorePolicies } from '../types/store-policies';
import { productInfo, productLead, splitParagraphs } from './product-details-model';

const BARE: CatalogProductDetail = {
  slug: 'gown',
  name: 'فستان',
  nameEn: 'Gown',
  description: null,
  descriptionEn: null,
  material: null,
  materialEn: null,
  care: null,
  careEn: null,
  fit: null,
  fitEn: null,
  price: 1000,
  isNew: false,
  inStock: true,
  images: [],
  category: null,
  collections: [],
  options: [],
  variants: [],
};

const FULL: CatalogProductDetail = {
  ...BARE,
  description: 'وصف أول\n\nوصف ثان',
  descriptionEn: 'First line\nsame paragraph\n\n  Second  \n\n',
  material: 'حرير',
  materialEn: 'Silk',
  care: 'تنظيف جاف',
  careEn: null,
  fit: 'واسع',
  fitEn: 'Relaxed',
  category: { slug: 'dresses', name: 'فساتين', nameEn: 'Dresses' },
  collections: [
    { slug: 'silk', name: 'حرير', nameEn: 'Silk' },
    { slug: 'evening', name: 'سهرة', nameEn: null },
  ],
  options: [
    { key: 'color', label: 'Colour', values: ['Ivory'] },
    { key: 'size', label: 'Size', values: ['S', 'M', 'L'] },
  ],
};

const POLICIES: StorePolicies = {
  delivery: 'توصيل',
  deliveryEn: 'Delivery copy',
  returns: 'إرجاع',
  returnsEn: null,
};

describe('splitParagraphs and productLead', () => {
  it('splits on blank lines and keeps single breaks', () => {
    expect(splitParagraphs(FULL.descriptionEn!)).toEqual(['First line\nsame paragraph', 'Second']);
  });

  it('leads with the first paragraph, marking a fallback language', () => {
    expect(productLead(FULL, 'en')).toEqual({ text: 'First line\nsame paragraph', lang: 'en' });
    expect(productLead({ description: 'أ\n\nب', descriptionEn: null }, 'en')).toEqual({
      text: 'أ',
      lang: 'ar',
    });
    expect(productLead(BARE, 'ar')).toBeNull();
    expect(productLead({ description: '  \n\n ', descriptionEn: null }, 'ar')).toBeNull();
  });
});

describe('productInfo', () => {
  it('is empty for a bare product with no policies', () => {
    expect(productInfo(BARE, null, 'en')).toEqual({ rows: [], more: null, shipping: [] });
    expect(
      productInfo(BARE, { delivery: ' ', deliveryEn: null, returns: null, returnsEn: '' }, 'en')
    ).toEqual({ rows: [], more: null, shipping: [] });
  });

  it('builds the facts rows in order, omitting empty ones', () => {
    const { rows } = productInfo(FULL, null, 'en');
    expect(rows.map((row) => row.id)).toEqual([
      'material',
      'care',
      'fit',
      'category',
      'collection',
      'sizes',
    ]);
    expect(rows[1]).toEqual({
      id: 'care',
      kind: 'text',
      value: { text: 'تنظيف جاف', lang: 'ar' },
    });
    expect(rows[4]).toMatchObject({
      links: [
        { slug: 'silk', name: { text: 'Silk', lang: 'en' } },
        { slug: 'evening', name: { text: 'سهرة', lang: 'ar' } },
      ],
    });
  });

  it('takes sizes only from the size option', () => {
    expect(productInfo(FULL, null, 'en').rows.at(-1)).toEqual({
      id: 'sizes',
      kind: 'values',
      values: ['S', 'M', 'L'],
    });
    const colourOnly = productInfo(
      { ...BARE, material: 'قطن', options: [FULL.options[0]] },
      null,
      'en'
    );
    expect(colourOnly.rows.map((row) => row.id)).toEqual(['material']);
  });

  it('folds only the paragraphs after the lead, so the description is said once', () => {
    expect(productInfo(FULL, null, 'en').more).toEqual({ lang: 'en', paragraphs: ['Second'] });
    expect(productInfo(FULL, null, 'ar').more).toEqual({ lang: 'ar', paragraphs: ['وصف ثان'] });
    expect(productInfo({ ...BARE, descriptionEn: 'One paragraph' }, null, 'en').more).toBeNull();
  });

  it('never shows English copy on an Arabic page', () => {
    expect(
      productInfo(
        { ...BARE, materialEn: 'Silk', descriptionEn: 'English only\n\nMore' },
        { delivery: null, deliveryEn: 'English', returns: null, returnsEn: null },
        'ar'
      )
    ).toEqual({ rows: [], more: null, shipping: [] });
  });

  it('builds shipping sections from the localized policies', () => {
    expect(productInfo(BARE, POLICIES, 'en').shipping).toEqual([
      { id: 'delivery', lang: 'en', paragraphs: ['Delivery copy'] },
      { id: 'returns', lang: 'ar', paragraphs: ['إرجاع'] },
    ]);
  });
});
