/**
 * The one canonical order in which any transaction may take product/variant row locks.
 *
 * Two transactions that touch the same rows in opposite orders deadlock. Sorting every
 * stock write phase through this single function is what removes the cycle — and it only
 * works if EVERY path uses the same rule, which is precisely why this lives in one place
 * rather than being reimplemented per module.
 *
 * A path that mutates stock in more than one phase (an exchange restocks returned items
 * and deducts new ones) must sort the COMBINED set, not each phase separately: sorting
 * each half independently still lets two callers interleave the halves in opposite order.
 */
export interface StockWriteTarget {
  product_id: number;
  variant_id?: number | null;
}

/** Products before variants, then ascending by id. */
export function sortForStockWrites<T extends StockWriteTarget>(lines: T[]): T[] {
  return [...lines].sort((a, b) => {
    const aVariant = a.variant_id ?? 0;
    const bVariant = b.variant_id ?? 0;
    if (aVariant !== bVariant) {
      return aVariant - bVariant;
    }
    return a.product_id - b.product_id;
  });
}
