import type { CartLine } from './cart-lines';
import { cartQuoteKey, type BagRowStatus, type BagView, type CartQuoteFetch } from './reconcile';

/**
 * Whether the bag can go to Checkout (plan 2026-09-15-002, CO-3/CO-5). Pure: the Bag entry
 * and the checkout page both derive it from the reconciled view, so they never disagree.
 * It lives in the cart slice so `features/checkout` depends on `features/cart`, never back.
 */

export type CheckoutReadiness =
  | { kind: 'hydrating' }
  | { kind: 'empty' }
  /** No verdict for the current lines yet (or, strict, a quote is in flight). */
  | { kind: 'checking' }
  /** `rejected`: a 400, so retrying the same bag cannot succeed. */
  | { kind: 'failed'; rejected: boolean }
  | {
      kind: 'blocked';
      /** Sold out, variant or product unavailable. */
      unavailable: number;
      /** Stored quantity above what the quote allows. */
      limited: number;
      /** Row keys of the blocking lines, in rendered order (newest first). */
      blockedKeys: readonly string[];
    }
  | {
      kind: 'ready';
      /** `cartQuoteKey` of the lines the current quote answered. Untrusted outside the UI. */
      quoteKey: string;
      pieces: number;
      subtotal: number;
      /** Rows showing a price change: shown, never blocking (CO-5). */
      priceUpdated: number;
    };

export interface CheckoutReadinessInput {
  hydrated: boolean;
  lines: readonly CartLine[];
  view: BagView;
  fetch: CartQuoteFetch;
}

export interface CheckoutReadinessOptions {
  /**
   * The submit path: any quote in flight counts as `checking`. The Bag entry is not strict,
   * so a focus refetch of an unchanged bag never flips the link into a button and back.
   */
  strict: boolean;
}

const UNAVAILABLE: ReadonlySet<BagRowStatus> = new Set<BagRowStatus>([
  'soldOut',
  'variantUnavailable',
  'productUnavailable',
]);

export function checkoutReadiness(
  { hydrated, lines, view, fetch }: CheckoutReadinessInput,
  { strict }: CheckoutReadinessOptions
): CheckoutReadiness {
  if (!hydrated) return { kind: 'hydrating' };

  switch (view.kind) {
    case 'empty':
      return { kind: 'empty' };
    case 'failed':
      return { kind: 'failed', rejected: view.canEmpty };
    case 'loading':
      return { kind: 'checking' };
    case 'ready':
      break;
  }

  const { rows, summary } = view;
  if (summary.state !== 'current' || rows.some((row) => row.status === 'pending')) {
    return { kind: 'checking' };
  }
  if (strict && fetch.status === 'fetching') return { kind: 'checking' };

  const unavailable = rows.filter((row) => UNAVAILABLE.has(row.status));
  const limited = rows.filter((row) => row.status === 'reduced');
  if (unavailable.length + limited.length > 0) {
    return {
      kind: 'blocked',
      unavailable: unavailable.length,
      limited: limited.length,
      blockedKeys: rows
        .filter((row) => UNAVAILABLE.has(row.status) || row.status === 'reduced')
        .map((row) => row.key),
    };
  }

  return {
    kind: 'ready',
    quoteKey: cartQuoteKey(lines),
    pieces: summary.purchasablePieces,
    subtotal: summary.subtotal,
    priceUpdated: rows.filter((row) => row.notices.some((notice) => notice.kind === 'priceUpdated'))
      .length,
  };
}
