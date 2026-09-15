import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import { selectPlural, type PluralTemplates } from './plural-templates';

describe('selectPlural', () => {
  it('uses the English one/other forms for the header count', () => {
    expect(selectPlural(en.bag.count, 1, 'en')).toBe('Bag, 1 item');
    expect(selectPlural(en.bag.count, 3, 'en')).toBe('Bag, 3 items');
  });

  it.each([
    [1, 'one'],
    [2, 'two'],
    [3, 'few'],
    [11, 'many'],
    [100, 'other'],
  ] as const)('selects the Arabic %i template from the %s category', (count, category) => {
    expect(selectPlural(ar.bag.count, count, 'ar')).toBe(
      ar.bag.count[category].replace('{count}', String(count))
    );
  });

  it('gives each Arabic category a distinct template where the grammar differs', () => {
    const forms = [1, 2, 3, 11].map((count) => selectPlural(ar.bag.pieces, count, 'ar'));
    expect(forms).toEqual(['1 قطعة', '2 قطعتان', '3 قطع', '11 قطعة']);
  });

  it('falls back to other when the selected category is missing', () => {
    const templates: PluralTemplates = { other: '{count} pieces' };
    expect(selectPlural(templates, 2, 'ar')).toBe('2 pieces');
  });
});
