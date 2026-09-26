import { describe, expect, it } from 'vitest';
import { isLowStock, sellableStock } from './productStock';

type StockShape = Parameters<typeof isLowStock>[0];

const product = (over: Partial<StockShape> = {}): StockShape => ({
  stock: 10,
  min_stock: 5,
  has_variants: 0,
  variant_count: 0,
  variant_stock: 0,
  ...over,
});

describe('sellableStock', () => {
  it('is the product column when there are no variants', () => {
    expect(sellableStock(product({ stock: 10 }))).toBe(10);
  });

  /**
   * HIGH-4's exact case: after a variant sale the two columns disagree, and the dashboard
   * used to render the dead one. `products.stock` 6 vs `SUM(variants)` 5 was measured
   * live after a single sale.
   */
  it('is the variant sum when the product has variants', () => {
    expect(
      sellableStock(product({ stock: 6, has_variants: 1, variant_count: 3, variant_stock: 5 }))
    ).toBe(5);
  });

  it('ignores a stale has_variants flag with no variant rows behind it', () => {
    expect(
      sellableStock(product({ stock: 6, has_variants: 1, variant_count: 0, variant_stock: 0 }))
    ).toBe(6);
  });

  it('reports a variant product as sold out when every variant is', () => {
    expect(
      sellableStock(product({ stock: 99, has_variants: 1, variant_count: 3, variant_stock: 0 }))
    ).toBe(0);
  });
});

describe('isLowStock', () => {
  it('compares the sellable figure against min_stock, not the dead column', () => {
    // The measured case: products.stock 6 > min_stock 5 kept the badge silent while the
    // sellable figure had already fallen to 5.
    const drifted = product({
      stock: 6,
      min_stock: 5,
      has_variants: 1,
      variant_count: 3,
      variant_stock: 5,
    });
    expect(isLowStock(drifted)).toBe(true);
  });

  it('is false with healthy stock', () => {
    expect(isLowStock(product({ stock: 10, min_stock: 5 }))).toBe(false);
  });

  it('is true at exactly the threshold', () => {
    expect(isLowStock(product({ stock: 5, min_stock: 5 }))).toBe(true);
  });
});
