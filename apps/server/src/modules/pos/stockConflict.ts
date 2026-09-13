import type { ValidationDetail } from '../../http/errors';
import { INSUFFICIENT_STOCK_CODE, type StockConflict } from './sales/types';

/**
 * The one shape in which any POS path reports "this line could not be taken out of
 * stock". Checkout and exchange refuse for the same reason and a client should not have
 * to special-case them per endpoint, so both build their details here.
 *
 * One detail per refused line. `field` names the request array the line sits in, as Zod
 * details do; the numbers ride in `meta`, because `message` is English prose written for
 * a person and a client must never have to parse it.
 */
export function stockConflictDetails(
  conflicts: readonly StockConflict[],
  message: string
): ValidationDetail[] {
  return conflicts.map((conflict) => ({
    field: 'items',
    code: INSUFFICIENT_STOCK_CODE,
    message,
    meta: {
      productId: conflict.productId,
      variantId: conflict.variantId,
      requested: conflict.requested,
      available: conflict.available,
    },
  }));
}
