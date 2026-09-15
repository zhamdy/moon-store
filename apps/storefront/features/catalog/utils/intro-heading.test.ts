import { describe, expect, it } from 'vitest';
import { catalogIntroHeadings, type IntroLabels } from './intro-heading';

const EN: IntroLabels = {
  shop: 'Shop',
  collections: 'Collections',
  allPieces: 'All pieces',
  newIn: 'New In',
};
const AR: IntroLabels = {
  shop: 'تسوّقي',
  collections: 'المجموعات',
  allPieces: 'كل القطع',
  newIn: 'وصل حديثًا',
};

const DRESSES = { text: 'Dresses', lang: 'en' as const };
const KNITWEAR = { text: 'Knitwear', lang: 'en' as const };
const SILK = { text: 'Silk', lang: 'en' as const };
const EVENING = { text: 'Evening', lang: 'en' as const };

describe('catalogIntroHeadings', () => {
  it('category: the category name is the h1, "Shop" links to /shop', () => {
    expect(catalogIntroHeadings({ kind: 'category', name: DRESSES }, EN, 'en')).toEqual({
      h1: DRESSES,
      context: { text: { text: 'Shop', lang: 'en' }, href: '/shop' },
    });
  });

  it('collection: the collection name is the h1, "Collections" links to /collections', () => {
    const ar = { text: 'مجموعة الحرير', lang: 'ar' as const };
    expect(catalogIntroHeadings({ kind: 'collection', name: ar }, AR, 'ar')).toEqual({
      h1: ar,
      context: { text: { text: 'المجموعات', lang: 'ar' }, href: '/collections' },
    });
  });

  it('New In: "New In" is the h1, "Shop" links to /shop', () => {
    expect(catalogIntroHeadings({ kind: 'new' }, EN, 'en')).toEqual({
      h1: { text: 'New In', lang: 'en' },
      context: { text: { text: 'Shop', lang: 'en' }, href: '/shop' },
    });
  });

  it('Shop All: unchanged, "Shop" h1 with plain "All pieces"', () => {
    expect(catalogIntroHeadings({ kind: 'all' }, EN, 'en')).toEqual({
      h1: { text: 'Shop', lang: 'en' },
      context: { text: { text: 'All pieces', lang: 'en' }, href: null },
    });
  });

  it('collections index: unchanged "Collections" h1, no context line', () => {
    expect(catalogIntroHeadings({ kind: 'collections' }, AR, 'ar')).toEqual({
      h1: { text: 'المجموعات', lang: 'ar' },
      context: null,
    });
  });

  it('keeps a fallback name in its own language', () => {
    const fallback = { text: 'فساتين', lang: 'ar' as const };
    expect(catalogIntroHeadings({ kind: 'category', name: fallback }, EN, 'en').h1).toBe(fallback);
  });

  it('omits a context line that only repeats the h1, ignoring case and spacing', () => {
    const name = { text: ' shop ', lang: 'en' as const };
    expect(catalogIntroHeadings({ kind: 'category', name }, EN, 'en').context).toBeNull();
    expect(
      catalogIntroHeadings({ kind: 'all' }, { ...EN, allPieces: '  ' }, 'en').context
    ).toBeNull();
  });

  // #200 regression guard: listing pages must never fall back to one shared, generic h1.
  it('gives two categories two different h1s, neither the generic label', () => {
    const a = catalogIntroHeadings({ kind: 'category', name: DRESSES }, EN, 'en').h1.text;
    const b = catalogIntroHeadings({ kind: 'category', name: KNITWEAR }, EN, 'en').h1.text;
    expect(a).not.toBe(b);
    for (const h1 of [a, b]) expect([EN.shop, EN.collections]).not.toContain(h1);
  });

  it('gives two collections two different h1s, neither the generic label', () => {
    const a = catalogIntroHeadings({ kind: 'collection', name: SILK }, EN, 'en').h1.text;
    const b = catalogIntroHeadings({ kind: 'collection', name: EVENING }, EN, 'en').h1.text;
    expect(a).not.toBe(b);
    for (const h1 of [a, b]) expect([EN.shop, EN.collections]).not.toContain(h1);
  });
});
