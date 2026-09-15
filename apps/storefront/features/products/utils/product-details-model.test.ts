import { describe, expect, it } from 'vitest';
import type { CatalogProductDetail } from '../types/catalog-product-detail';
import type { StorePolicies } from '../types/store-policies';
import {
  productDetailsTabs,
  productLead,
  splitParagraphs,
  tabHasFocusableContent,
  type DetailsTab,
} from './product-details-model';

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

const ids = (tabs: DetailsTab[]) => tabs.map((tab) => tab.id);

function tab<Id extends DetailsTab['id']>(tabs: DetailsTab[], id: Id) {
  return tabs.find((candidate) => candidate.id === id) as Extract<DetailsTab, { id: Id }>;
}

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

describe('productDetailsTabs', () => {
  it('renders all three tabs in order when everything exists', () => {
    expect(ids(productDetailsTabs(FULL, POLICIES, 'en'))).toEqual([
      'description',
      'details',
      'shipping',
    ]);
  });

  it('has no tabs for a bare product with no policies', () => {
    expect(productDetailsTabs(BARE, null, 'en')).toEqual([]);
    expect(
      productDetailsTabs(
        BARE,
        { delivery: ' ', deliveryEn: null, returns: null, returnsEn: '' },
        'en'
      )
    ).toEqual([]);
  });

  it('can be a single tab', () => {
    expect(ids(productDetailsTabs({ ...BARE, description: 'وصف' }, null, 'ar'))).toEqual([
      'description',
    ]);
    expect(ids(productDetailsTabs(BARE, POLICIES, 'ar'))).toEqual(['shipping']);
  });

  it('builds the details rows in order, omitting empty ones', () => {
    const details = tab(productDetailsTabs(FULL, null, 'en'), 'details');
    expect(details.rows.map((row) => row.id)).toEqual([
      'material',
      'care',
      'fit',
      'category',
      'collection',
      'sizes',
    ]);
    expect(details.rows[1]).toEqual({
      id: 'care',
      kind: 'text',
      value: { text: 'تنظيف جاف', lang: 'ar' },
    });
    expect(details.rows[4]).toMatchObject({
      links: [
        { slug: 'silk', name: { text: 'Silk', lang: 'en' } },
        { slug: 'evening', name: { text: 'سهرة', lang: 'ar' } },
      ],
    });
  });

  it('takes sizes only from the size option', () => {
    const details = tab(productDetailsTabs(FULL, null, 'en'), 'details');
    expect(details.rows.at(-1)).toEqual({ id: 'sizes', kind: 'values', values: ['S', 'M', 'L'] });

    const colourOnly = productDetailsTabs(
      { ...BARE, material: 'قطن', options: [FULL.options[0]] },
      null,
      'en'
    );
    expect(tab(colourOnly, 'details').rows.map((row) => row.id)).toEqual(['material']);
  });

  it('never shows English copy on an Arabic page', () => {
    const tabs = productDetailsTabs(
      { ...BARE, materialEn: 'Silk', descriptionEn: 'English only' },
      { delivery: null, deliveryEn: 'English', returns: null, returnsEn: null },
      'ar'
    );
    expect(tabs).toEqual([]);
  });

  it('builds shipping sections from the localized policies', () => {
    const shipping = tab(productDetailsTabs(BARE, POLICIES, 'en'), 'shipping');
    expect(shipping.sections).toEqual([
      { id: 'delivery', lang: 'en', paragraphs: ['Delivery copy'] },
      { id: 'returns', lang: 'ar', paragraphs: ['إرجاع'] },
    ]);
  });
});

describe('tabHasFocusableContent', () => {
  it('is true only for a details panel with links', () => {
    const tabs = productDetailsTabs(FULL, POLICIES, 'en');
    expect(tabs.map(tabHasFocusableContent)).toEqual([false, true, false]);
    const textOnly = productDetailsTabs({ ...BARE, fit: 'واسع' }, null, 'ar');
    expect(tabHasFocusableContent(textOnly[0])).toBe(false);
  });
});
