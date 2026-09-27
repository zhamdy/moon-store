import { describe, expect, it } from 'vitest';
import { homeCategories } from '@/features/collections/data/home-categories';
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

// The header's Shop panel and menu, the footer, the wayfinding directory and the homepage
// panels list `homeCategories`; the Shop page lists `CATEGORY_ORDER`. One order everywhere.
describe('homeCategories', () => {
  it('follows the shop order', () => {
    const keys = homeCategories.map((category) => ({ slug: category.key }));
    expect(slugs(orderCategories(keys))).toEqual(slugs(keys));
  });
});
