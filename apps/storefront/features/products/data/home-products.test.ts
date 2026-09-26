import { describe, expect, it } from 'vitest';
import { catalogSlots } from '@/lib/editorial/slots';
import { fromHomeMock } from '../utils/product-card-model';
import { curatedEdit, newArrivals } from './home-products';

const all = [...newArrivals, ...curatedEdit];

describe('homepage editorial frames', () => {
  it('have unique ids across both datasets', () => {
    const ids = all.map((product) => product.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reference only catalog slots the registry defines', () => {
    const known = new Set<string>(catalogSlots);
    for (const product of all) {
      expect(known.has(product.images.a), `${product.id} a`).toBe(true);
      expect(known.has(product.images.b), `${product.id} b`).toBe(true);
      expect(product.images.a).not.toBe(product.images.b);
    }
  });

  it('have a name in both locales', () => {
    for (const product of all) {
      expect(product.name.en.trim(), product.id).not.toBe('');
      expect(product.name.ar.trim(), product.id).not.toBe('');
    }
  });

  /**
   * HIGH-1: these frames published nine product links, five of which 404'd. They carry
   * no product identity now, so a card built from one can make no commerce claim — no
   * link, no price, no badge. The `id` is for React lists and must never reach a URL.
   */
  it('map to editorial cards that make no commerce claim', () => {
    for (const product of all) {
      const model = fromHomeMock(product, 'en');
      expect(model.href, `${product.id} href`).toBeNull();
      expect(model.price, `${product.id} price`).toBeNull();
      expect(model.badge, `${product.id} badge`).toBeNull();
      expect(model.primary).toEqual({ kind: 'static', slot: product.images.a });
      expect(model.secondary).toEqual({ kind: 'static', slot: product.images.b });
    }
  });

  it('carry no product identity a href could be built from', () => {
    for (const product of all) {
      expect(product, product.id).not.toHaveProperty('slug');
      expect(product, product.id).not.toHaveProperty('price');
    }
  });

  it('fill the two homepage grids exactly: four new arrivals, five in the edit', () => {
    expect(newArrivals).toHaveLength(4);
    expect(curatedEdit).toHaveLength(5);
  });
});
