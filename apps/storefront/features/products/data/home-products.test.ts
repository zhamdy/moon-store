import { describe, expect, it } from 'vitest';
import { catalogSlots } from '@/lib/editorial/slots';
import { curatedEdit, newArrivals } from './home-products';

const all = [...newArrivals, ...curatedEdit];

describe('homepage product mocks', () => {
  it('have unique slugs across both datasets', () => {
    const slugs = all.map((product) => product.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('reference only catalog slots the registry defines', () => {
    const known = new Set<string>(catalogSlots);
    for (const product of all) {
      expect(known.has(product.images.a), `${product.slug} a`).toBe(true);
      expect(known.has(product.images.b), `${product.slug} b`).toBe(true);
      expect(product.images.a).not.toBe(product.images.b);
    }
  });

  it('have positive whole-EGP prices and a name in both locales', () => {
    for (const product of all) {
      expect(Number.isInteger(product.price), product.slug).toBe(true);
      expect(product.price).toBeGreaterThan(0);
      expect(product.name.en.trim()).not.toBe('');
      expect(product.name.ar.trim()).not.toBe('');
    }
  });

  it('fill the two homepage grids exactly: four new arrivals, five in the edit', () => {
    expect(newArrivals).toHaveLength(4);
    expect(curatedEdit).toHaveLength(5);
  });
});
