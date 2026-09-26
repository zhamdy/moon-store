import type { Product } from '../types/index';

/**
 * The stock figure that actually governs whether a piece can be sold.
 *
 * `products.stock` is **dead state on a variant product**: no sale, refund or exchange
 * path writes or reads it once `has_variants` is set, and the catalog and the cart quote
 * read the variant rows. The two agree only at seed time, where the seed sets
 * `products.stock = SUM(variants.stock)`, and they drift with the first variant sale.
 *
 * Measured (HIGH-4 in `docs/audits/2026-09-22-shop-cart-fullstack-audit.md`): after one
 * variant sale a product reported `products.stock` 6, `SUM(variants)` 5 and per-size
 * sellable 3/0/2 — three answers for one product at one instant, with the Stock column
 * and the low-stock badge both reading the dead one. Writing `stock: 99` from the product
 * form changed nothing a shopper could see or buy.
 *
 * POS has always had this rule; the inventory list did not, which is why it showed the
 * wrong number. One authority now, rather than two copies that can disagree.
 */
export function sellableStock(
  product: Pick<Product, 'stock' | 'has_variants' | 'variant_stock' | 'variant_count'>
): number {
  if (product.has_variants && product.variant_count > 0) return product.variant_stock;
  return product.stock;
}

/** Whether the product's sellable stock is at or below its reorder threshold. */
export function isLowStock(
  product: Pick<Product, 'stock' | 'has_variants' | 'variant_stock' | 'variant_count' | 'min_stock'>
): boolean {
  return sellableStock(product) <= product.min_stock;
}
