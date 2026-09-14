import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ar from '@/messages/ar.json';
import en from '@/messages/en.json';
import { formatResultCount, formatResultsHeading } from './result-count';

const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'catalog' });
const tAr = createTranslator({ locale: 'ar', messages: ar, namespace: 'catalog' });

describe('formatResultCount', () => {
  it('selects the English plural forms', () => {
    expect([0, 1, 2, 11, 100].map((n) => formatResultCount(tEn, n))).toEqual([
      'No pieces',
      '1 piece',
      '2 pieces',
      '11 pieces',
      '100 pieces',
    ]);
  });

  it('selects the distinct Arabic forms (zero, one, two, few, many, other)', () => {
    expect([0, 1, 2, 3, 11, 100].map((n) => formatResultCount(tAr, n))).toEqual([
      'لا توجد قطع',
      'قطعة واحدة',
      'قطعتان',
      '3 قطع',
      '11 قطعة',
      '100 قطعة',
    ]);
  });

  it('keeps Western digits in Arabic, matching prices', () => {
    expect(formatResultCount(tAr, 1250)).toMatch(/^1,250 /);
  });

  it('groups thousands and treats invalid counts as zero', () => {
    expect(formatResultCount(tEn, 1250)).toBe('1,250 pieces');
    expect(formatResultCount(tEn, Number.NaN)).toBe('No pieces');
    expect(formatResultCount(tAr, -3)).toBe('لا توجد قطع');
  });
});

describe('formatResultsHeading', () => {
  it('adds the page position only past page 1', () => {
    expect(formatResultsHeading(tEn, 1, 12)).toBe('Products');
    expect(formatResultsHeading(tEn, 3, 12)).toBe('Products, page 3 of 12');
    expect(formatResultsHeading(tAr, 3, 12)).toBe('المنتجات، الصفحة 3 من 12');
  });
});
