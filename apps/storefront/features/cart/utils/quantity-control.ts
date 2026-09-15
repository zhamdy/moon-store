import { MAX_LINE_QUANTITY } from '../constants';

/**
 * A line's state as the stepper needs it. The five server statuses plus `unquoted` (no
 * quote has settled for this line yet). Declared here so the stepper rules stay independent
 * of the quote client; the reconciliation model maps onto it.
 */
export type QuantityLineStatus =
  | 'unquoted'
  | 'ok'
  | 'reduced'
  | 'soldOut'
  | 'variantUnavailable'
  | 'productUnavailable';

export interface QuantityControlInput {
  status: QuantityLineStatus;
  /**
   * The last known `maxQuantity` for this line. The caller keeps passing it while a re-quote
   * is pending, so + holds at that limit instead of reopening to 10 between quotes.
   */
  maxQuantity?: number;
  /** A re-quote for the current lines is in flight. The limit does not move while it is. */
  pending: boolean;
}

export type IncrementDescription = 'stockLimit' | 'capped';

export interface QuantityControlState {
  decrementDisabled: boolean;
  incrementDisabled: boolean;
  /** Why + is disabled at the limit: "Only {count} available" or the capped notice. */
  incrementDescription: IncrementDescription | null;
  /** The highest quantity the stepper allows; `{count}` in the stock-limit description. */
  limit: number;
}

const NOT_PURCHASABLE: ReadonlySet<QuantityLineStatus> = new Set([
  'soldOut',
  'variantUnavailable',
  'productUnavailable',
]);

/**
 * Stepper rules (R9, Unit 6): − stops at 1 (deletion is an explicit Remove); + stops at the
 * limit, which is the last known `maxQuantity` capped at `MAX_LINE_QUANTITY`, or that cap
 * before any quote. A line that cannot be bought has both buttons disabled; Remove is the
 * way out.
 */
export function quantityControl(
  quantity: number,
  { status, maxQuantity }: QuantityControlInput
): QuantityControlState {
  const limit =
    maxQuantity === undefined
      ? MAX_LINE_QUANTITY
      : Math.max(0, Math.min(Math.floor(maxQuantity), MAX_LINE_QUANTITY));

  if (NOT_PURCHASABLE.has(status)) {
    return { decrementDisabled: true, incrementDisabled: true, incrementDescription: null, limit };
  }

  const incrementDisabled = quantity >= limit;
  return {
    decrementDisabled: quantity <= 1,
    incrementDisabled,
    incrementDescription: incrementDisabled
      ? limit < MAX_LINE_QUANTITY
        ? 'stockLimit'
        : 'capped'
      : null,
    limit,
  };
}
