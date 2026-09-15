import { fillTemplate } from '@/lib/utils/fill-template';
import type { PurchaseReadiness } from '@/features/products/utils/variant-selection';
import { MAX_LINE_QUANTITY } from '../constants';
import type { AddResult, CartLineIdentity } from './cart-lines';
import type { OpenDrawerInput } from '../store/cart-store';
import type { AddToBagStrings } from './bag-strings';

export type AddToBagIntent =
  | { kind: 'add'; identity: CartLineIdentity }
  | { kind: 'focusSelection'; key: string }
  | { kind: 'none' };

/**
 * What one Add to Bag press does, from `purchaseReadiness` alone (R7): add one piece when
 * ready, send the shopper to the first unselected option otherwise, nothing when sold out.
 */
export function addToBagIntent(readiness: PurchaseReadiness, slug: string): AddToBagIntent {
  switch (readiness.kind) {
    case 'ready':
      return { kind: 'add', identity: { slug, options: { ...readiness.options } } };
    case 'needsSelection':
      return readiness.keys.length > 0
        ? { kind: 'focusSelection', key: readiness.keys[0]! }
        : { kind: 'none' };
    case 'soldOut':
      return { kind: 'none' };
  }
}

/**
 * The drawer opening that acknowledges an add (CD-13): its description is fixed here.
 * `name` is the product page's localized name, an in-memory hint that is never persisted.
 */
export function drawerOpeningFor(
  result: Pick<AddResult, 'outcome' | 'key'>,
  name: string,
  strings: Pick<AddToBagStrings, 'added' | 'capped' | 'full'>
): Required<OpenDrawerInput> {
  switch (result.outcome) {
    case 'added':
    case 'merged':
      return {
        mode: 'added',
        addedKey: result.key,
        description: fillTemplate(strings.added, { name }),
      };
    case 'capped':
      return {
        mode: 'browse',
        addedKey: result.key,
        description: fillTemplate(strings.capped, { max: MAX_LINE_QUANTITY }),
      };
    case 'full':
      return { mode: 'browse', addedKey: null, description: strings.full };
  }
}
