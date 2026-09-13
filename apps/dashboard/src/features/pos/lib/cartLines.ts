/**
 * How a cart line is identified in the UI: by product, variant AND bundle. The same
 * product can appear twice under different variants, and since #124 it can also appear
 * both loose and as a member of a bundle -- those are priced differently and the server
 * validates the bundle group against its definition, so they are two lines that must
 * never be mistaken for each other. Shared by the cart list, its `data-testid`, and the
 * memo-editing state that keys off it.
 */
import type { CartItem } from '../store/cartStore';

export function lineKey(item: Pick<CartItem, 'product_id' | 'variant_id' | 'bundle_id'>): string {
  return `${item.product_id}-${item.variant_id || 0}-${item.bundle_id || 0}`;
}
