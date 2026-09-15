import { describe, expect, it } from 'vitest';
import type { CartLine } from './cart-lines';
import { checkoutReadiness } from './checkout-readiness';
import {
  cartQuoteKey,
  type BagNotice,
  type BagRow,
  type BagRowStatus,
  type BagView,
  type CartQuoteFetch,
} from './reconcile';

const LINES: CartLine[] = [
  { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 },
  { slug: 'leather-tote', options: {}, quantity: 1 },
];

const SETTLED: CartQuoteFetch = { status: 'settled' };
const FETCHING: CartQuoteFetch = { status: 'fetching' };

function bagRow(key: string, status: BagRowStatus, notices: BagNotice[] = []): BagRow {
  return {
    key,
    line: { slug: key, options: {}, quantity: 1 },
    status,
    product: null,
    provisional: null,
    options: [],
    unitPrice: 100,
    displayQuantity: 1,
    maxQuantity: 10,
    knownMaxQuantity: 10,
    lineTotal: 100,
    notices,
  };
}

function readyView(rows: BagRow[], state: 'current' | 'stale' = 'current'): BagView {
  return {
    kind: 'ready',
    rows,
    summary: { state, subtotal: 6900, purchasablePieces: 3, excludedPieces: 0, localPieces: 3 },
  };
}

const STRICT = { strict: true };
const LOOSE = { strict: false };

describe('checkoutReadiness', () => {
  it('is ready for a current quote with every line ok', () => {
    const view = readyView([bagRow('a', 'ok'), bagRow('b', 'ok')]);
    expect(
      checkoutReadiness({ hydrated: true, lines: LINES, view, fetch: SETTLED }, STRICT)
    ).toEqual({
      kind: 'ready',
      quoteKey: cartQuoteKey(LINES),
      pieces: 3,
      subtotal: 6900,
      priceUpdated: 0,
    });
  });

  it('is hydrating before the store hydrates and empty for an empty bag', () => {
    const view = readyView([bagRow('a', 'ok')]);
    expect(
      checkoutReadiness({ hydrated: false, lines: LINES, view, fetch: SETTLED }, LOOSE)
    ).toEqual({
      kind: 'hydrating',
    });
    expect(
      checkoutReadiness(
        { hydrated: true, lines: [], view: { kind: 'empty' }, fetch: SETTLED },
        LOOSE
      )
    ).toEqual({ kind: 'empty' });
  });

  it('is checking while there is no verdict for the current lines', () => {
    const input = { hydrated: true, lines: LINES, fetch: SETTLED };
    expect(
      checkoutReadiness({ ...input, view: { kind: 'loading', rows: [], localPieces: 3 } }, LOOSE)
    ).toEqual({ kind: 'checking' });
    expect(
      checkoutReadiness({ ...input, view: readyView([bagRow('a', 'ok')], 'stale') }, LOOSE)
    ).toEqual({ kind: 'checking' });
    expect(
      checkoutReadiness(
        { ...input, view: readyView([bagRow('a', 'ok'), bagRow('b', 'pending')]) },
        LOOSE
      )
    ).toEqual({ kind: 'checking' });
  });

  it('a same-key refetch is checking only on the strict (submit) path', () => {
    const input = {
      hydrated: true,
      lines: LINES,
      view: readyView([bagRow('a', 'ok')]),
      fetch: FETCHING,
    };
    expect(checkoutReadiness(input, STRICT)).toEqual({ kind: 'checking' });
    expect(checkoutReadiness(input, LOOSE).kind).toBe('ready');
  });

  it('is blocked by unavailable and limited lines, counting each', () => {
    const view = readyView([
      bagRow('a', 'soldOut'),
      bagRow('b', 'reduced'),
      bagRow('c', 'productUnavailable'),
      bagRow('d', 'ok'),
    ]);
    expect(
      checkoutReadiness({ hydrated: true, lines: LINES, view, fetch: SETTLED }, LOOSE)
    ).toEqual({
      kind: 'blocked',
      unavailable: 2,
      limited: 1,
      blockedKeys: ['a', 'b', 'c'],
    });
  });

  it('a price change alone does not block', () => {
    const view = readyView([bagRow('a', 'ok', [{ kind: 'priceUpdated' }]), bagRow('b', 'ok')]);
    const readiness = checkoutReadiness(
      { hydrated: true, lines: LINES, view, fetch: SETTLED },
      STRICT
    );
    expect(readiness).toMatchObject({ kind: 'ready', priceUpdated: 1 });
  });

  it('reports failures, marking a rejected (400) bag', () => {
    const input = { hydrated: true, lines: LINES, fetch: SETTLED };
    expect(
      checkoutReadiness(
        { ...input, view: { kind: 'failed', localPieces: 3, canRetry: false, canEmpty: true } },
        LOOSE
      )
    ).toEqual({ kind: 'failed', rejected: true });
    expect(
      checkoutReadiness(
        { ...input, view: { kind: 'failed', localPieces: 3, canRetry: true, canEmpty: false } },
        LOOSE
      )
    ).toEqual({ kind: 'failed', rejected: false });
  });
});
