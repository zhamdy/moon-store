import { fillTemplate } from '@/lib/utils/fill-template';
import type { ToastTone } from '@/components/feedback/show-toast';
import type { PurchaseReadiness } from '@/features/products/utils/variant-selection';
import { MAX_LINE_QUANTITY } from '../constants';
import type { AddResult, CartLineIdentity } from './cart-lines';
import type { AddToBagStrings } from './bag-strings';

export type AddToBagIntent =
  | { kind: 'add'; identity: CartLineIdentity; quantity: number }
  | { kind: 'focusSelection'; key: string }
  | { kind: 'none' };

/**
 * What one Add to Bag press does, from `purchaseReadiness` alone (R7): add the stepper's
 * `quantity` when ready (owner decision 2026-09-15), send the shopper to the first
 * unselected option otherwise, nothing when sold out.
 */
export function addToBagIntent(
  readiness: PurchaseReadiness,
  slug: string,
  quantity: number
): AddToBagIntent {
  switch (readiness.kind) {
    case 'ready':
      return { kind: 'add', identity: { slug, options: { ...readiness.options } }, quantity };
    case 'needsSelection':
      return readiness.keys.length > 0
        ? { kind: 'focusSelection', key: readiness.keys[0]! }
        : { kind: 'none' };
    case 'soldOut':
      return { kind: 'none' };
  }
}

/** One id for every add acknowledgement: a second press replaces the toast, never stacks. */
export const ADD_TO_BAG_TOAST_ID = 'add-to-bag';

export interface AddToBagToast {
  tone: ToastTone;
  message: string;
  id: string;
  action: 'viewBag';
}

/**
 * The toast that acknowledges an add (owner decision 2026-09-15, overriding CD-13's drawer
 * opening). Every outcome carries View bag. `name` is the product page's localized name, an
 * in-memory hint that is never persisted. A merge that landed fewer pieces than requested is
 * an info notice, not a success.
 */
export function addToBagToast(
  result: Pick<AddResult, 'outcome' | 'addedQuantity'>,
  name: string,
  strings: Pick<AddToBagStrings, 'added' | 'addedQuantity' | 'capped' | 'full'>,
  requestedQuantity: number
): AddToBagToast {
  const base = { id: ADD_TO_BAG_TOAST_ID, action: 'viewBag' } as const;
  const cappedNotice = fillTemplate(strings.capped, { max: MAX_LINE_QUANTITY });
  switch (result.outcome) {
    case 'added':
    case 'merged':
      if (result.addedQuantity < requestedQuantity) {
        return { ...base, tone: 'info', message: cappedNotice };
      }
      return {
        ...base,
        tone: 'success',
        message:
          requestedQuantity > 1
            ? fillTemplate(strings.addedQuantity, { name, count: result.addedQuantity })
            : fillTemplate(strings.added, { name }),
      };
    case 'capped':
      return { ...base, tone: 'info', message: cappedNotice };
    case 'full':
      return { ...base, tone: 'error', message: strings.full };
  }
}
