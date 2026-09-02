/**
 * How a cart line is identified in the UI: by product AND variant, since the
 * same product can appear twice under different variants. Shared by the cart
 * list, its `data-testid`, and the memo-editing state that keys off it.
 */
import type { CartItem } from '../store/cartStore';

export function lineKey(item: Pick<CartItem, 'product_id' | 'variant_id'>): string {
  return `${item.product_id}-${item.variant_id || 0}`;
}
