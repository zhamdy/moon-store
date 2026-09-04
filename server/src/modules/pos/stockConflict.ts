import type { ValidationDetail } from '../../http/errors';
import { INSUFFICIENT_STOCK_CODE } from './sales/types';

/**
 * The one shape in which any POS path reports "this line could not be taken out of
 * stock". Checkout and exchange refuse for the same reason and a client should not have
 * to special-case them per endpoint, so both build their detail here.
 *
 * `available` is what the caller could actually have had: the row's committed stock,
 * with any decrement this same (now doomed) transaction already applied added back.
 * Reporting the mid-transaction figure would understate it — the transaction rolls back,
 * so those decrements never happened as far as anyone else is concerned.
 *
 * `available` is 0 when the row is gone entirely. The guarded UPDATE cannot tell
 * "not enough" from "deleted", and for a cashier both mean the same thing: this line
 * cannot be sold right now.
 */
export interface StockConflict {
  productId: number;
  variantId: number | null;
  requested: number;
  available: number;
}

/** `field` names the request array the offending line sits in, as Zod details do. */
export function stockConflictDetail(conflict: StockConflict, message: string): ValidationDetail {
  return {
    field: 'items',
    code: INSUFFICIENT_STOCK_CODE,
    message,
    meta: {
      productId: conflict.productId,
      variantId: conflict.variantId,
      requested: conflict.requested,
      available: conflict.available,
    },
  };
}
