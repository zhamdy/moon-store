import { describe, expect, it } from 'vitest';
import { orderCategories } from './category-order';

const slugs = (list: { slug: string }[]) => list.map((c) => c.slug);

describe('orderCategories', () => {
  it('puts the named categories in the shop order', () => {
    const api = ['shoes', 'accessories', 'tops', 'bags', 'abayas', 'dresses'].map((slug) => ({
      slug,
    }));
    expect(slugs(orderCategories(api))).toEqual([
      'dresses',
      'tops',
      'abayas',
      'shoes',
      'bags',
      'accessories',
    ]);
  });

  it('keeps unknown categories after the named ones, in their API order', () => {
    const api = ['capes', 'shoes', 'belts', 'dresses'].map((slug) => ({ slug }));
    expect(slugs(orderCategories(api))).toEqual(['dresses', 'shoes', 'capes', 'belts']);
  });

  it('does not mutate its input', () => {
    const api = [{ slug: 'shoes' }, { slug: 'dresses' }];
    orderCategories(api);
    expect(slugs(api)).toEqual(['shoes', 'dresses']);
  });
});
