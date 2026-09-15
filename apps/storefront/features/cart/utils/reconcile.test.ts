import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import type { CartQuoteLine, CartQuoteResult } from '../types/cart-quote';
import { applyCanonical, cartLineKey, type CartLine } from './cart-lines';
import {
  cartQuoteKey,
  failureAnnouncementKey,
  reconcileBag,
  type BagLineHint,
  type BagView,
  type CartQuoteFetch,
  type CartSessionMemory,
} from './reconcile';

const A: CartLine = { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 };
const B: CartLine = { slug: 'leather-tote', options: {}, quantity: 1 };
const C: CartLine = { slug: 'cashmere-pullover', options: { size: 'S' }, quantity: 1 };

const PRICES: Record<string, number> = {
  'silk-midi-dress': 2850,
  'leather-tote': 1200,
  'cashmere-pullover': 1900,
};

const SETTLED: CartQuoteFetch = { status: 'settled' };
const EMPTY_SESSION: CartSessionMemory = {
  previousPrices: new Map(),
  priceUpdates: new Map(),
  announcedQuoteKeys: new Set(),
  hints: new Map(),
};

const C_HINT: BagLineHint = {
  name: { text: 'Cashmere Pullover', lang: 'en' },
  imageUrl: 'https://media.example/pullover.jpg',
  unitPrice: 1900,
};

function okLine(line: CartLine, index: number, over: Partial<CartQuoteLine> = {}): CartQuoteLine {
  const unitPrice = over.unitPrice ?? PRICES[line.slug]!;
  const quantity = over.quantity ?? line.quantity;
  return {
    index,
    slug: line.slug,
    status: 'ok',
    product: { slug: line.slug, name: `name:${line.slug}`, nameEn: null, image: null },
    options: Object.entries(line.options).map(([key, value]) => ({ key, label: key, value })),
    unitPrice,
    requestedQuantity: line.quantity,
    quantity,
    maxQuantity: 10,
    lineTotal: unitPrice * quantity,
    ...over,
  };
}

function resultFor(
  lines: readonly CartLine[],
  over: (line: CartLine, index: number) => Partial<CartQuoteLine> = () => ({})
): CartQuoteResult {
  const quoteLines = lines.map((line, index) => okLine(line, index, over(line, index)));
  return {
    key: cartQuoteKey(lines),
    lineKeys: lines.map(cartLineKey),
    quote: {
      lines: quoteLines,
      subtotal: quoteLines.reduce((sum, l) => sum + l.lineTotal, 0),
      itemCount: quoteLines.reduce((sum, l) => sum + l.quantity, 0),
      maxLineQuantity: 10,
    },
  };
}

function ready(view: BagView) {
  if (view.kind !== 'ready') throw new Error(`expected ready, got ${view.kind}`);
  return view;
}

function row(view: BagView, line: CartLine) {
  const rows = view.kind === 'loading' ? view.rows : ready(view).rows;
  const found = rows.find((r) => r.key === cartLineKey(line));
  if (!found) throw new Error('row missing');
  return found;
}

function session(
  prices: Record<string, number> | null,
  announced: string[] = [],
  priceUpdates: Record<string, string> | null = null,
  hints: Record<string, BagLineHint> | null = null
): CartSessionMemory {
  return {
    previousPrices: new Map(Object.entries(prices ?? {})),
    priceUpdates: new Map(Object.entries(priceUpdates ?? {})),
    announcedQuoteKeys: new Set(announced),
    hints: new Map(Object.entries(hints ?? {})),
  };
}

describe('reconcileBag', () => {
  it('all ok: rows newest first, priced, summary current from the quote', () => {
    const lines = [A, B];
    const out = reconcileBag({
      lines,
      result: resultFor(lines),
      fetch: SETTLED,
      session: EMPTY_SESSION,
    });

    const view = ready(out.view);
    expect(view.rows.map((r) => r.key)).toEqual([cartLineKey(B), cartLineKey(A)]);
    expect(row(out.view, A)).toMatchObject({
      status: 'ok',
      unitPrice: 2850,
      displayQuantity: 2,
      lineTotal: 5700,
      notices: [],
    });
    expect(view.summary).toEqual({
      state: 'current',
      subtotal: 6900,
      purchasablePieces: 3,
      excludedPieces: 0,
      localPieces: 3,
    });
    expect(out.correction).toBeNull();
    expect(out.announcement).toBeNull();
    // First quote of the session: remembered, never flagged.
    expect(out.rememberPrices).toEqual({ [cartLineKey(A)]: 2850, [cartLineKey(B)]: 1200 });
  });

  it('stale key: summary keeps the previous figures, marked stale; the changed line keeps its previous total', () => {
    const previous = resultFor([A, B]);
    const lines = [{ ...A, quantity: 3 }, B];
    const out = reconcileBag({
      lines,
      result: previous,
      fetch: { status: 'fetching' },
      session: session({ [cartLineKey(A)]: 2850, [cartLineKey(B)]: 1200 }),
    });

    expect(ready(out.view).summary).toEqual({
      state: 'stale',
      subtotal: 6900,
      purchasablePieces: 3,
      excludedPieces: 0,
      localPieces: 4,
    });
    expect(row(out.view, B)).toMatchObject({ status: 'ok', unitPrice: 1200, lineTotal: 1200 });
    // The previous quote's figure at quantity 2, never a client-side 2850 x 3.
    expect(row(out.view, lines[0]!)).toMatchObject({
      status: 'pending',
      unitPrice: 2850,
      displayQuantity: 3,
      lineTotal: 5700,
      maxQuantity: null,
    });
    expect(out.rememberPrices).toBeNull();
    expect(out.correction).toBeNull();
  });

  it('a line removed while a quote is pending never shows a neighbour price', () => {
    const previous = resultFor([A, B, C]);
    const lines = [A, C];
    const out = reconcileBag({
      lines,
      result: previous,
      fetch: { status: 'fetching' },
      session: EMPTY_SESSION,
    });

    expect(ready(out.view).rows).toHaveLength(2);
    expect(row(out.view, A).unitPrice).toBe(2850);
    expect(row(out.view, C).unitPrice).toBe(1900);
    expect(row(out.view, C).product?.slug).toBe('cashmere-pullover');
  });

  it('a line added while pending with no hint has no price, no product and its stored options', () => {
    const out = reconcileBag({
      lines: [A, C],
      result: resultFor([A]),
      fetch: { status: 'fetching' },
      session: EMPTY_SESSION,
    });
    expect(row(out.view, C)).toMatchObject({
      status: 'pending',
      product: null,
      provisional: null,
      unitPrice: null,
      lineTotal: null,
      displayQuantity: 1,
      knownMaxQuantity: null,
      options: [{ key: 'size', label: 'size', value: 'S' }],
    });
  });

  it('a hinted line with no quote line is provisional: hint name, image and unit price, no total', () => {
    const previous = resultFor([A]);
    const lines = [A, C];
    const out = reconcileBag({
      lines,
      result: previous,
      fetch: { status: 'fetching' },
      session: session(null, [], null, { [cartLineKey(C)]: C_HINT }),
    });
    expect(row(out.view, C)).toMatchObject({
      status: 'pending',
      product: null,
      provisional: C_HINT,
      unitPrice: 1900,
      lineTotal: null,
      maxQuantity: null,
      knownMaxQuantity: null,
      notices: [],
    });
    // The hint never reaches a figure or a count: the summary is the previous quote's.
    expect(ready(out.view).summary).toEqual({
      state: 'stale',
      subtotal: 5700,
      purchasablePieces: 2,
      excludedPieces: 0,
      localPieces: 3,
    });
    expect(out.announcement).toBeNull();
    expect(out.rememberPrices).toBeNull();
  });

  it('quote data wins over a hint as soon as a quote line exists for the key', () => {
    const lines = [A, C];
    const result = resultFor(lines, (line) => (line === C ? { unitPrice: 2000 } : {}));
    const out = reconcileBag({
      lines,
      result,
      fetch: SETTLED,
      session: session(null, [], null, { [cartLineKey(C)]: C_HINT }),
    });
    expect(row(out.view, C)).toMatchObject({
      status: 'ok',
      provisional: null,
      unitPrice: 2000,
      lineTotal: 2000,
    });
    expect(row(out.view, C).product?.name).toBe('name:cashmere-pullover');
    expect(ready(out.view).summary.subtotal).toBe(7700);
  });

  it('a stale summary counts excluded pieces against the lines its quote answered', () => {
    const S: CartLine = { slug: 'silk-slip-dress', options: { size: 'M' }, quantity: 2 };
    const answered = [A, S];
    const previous = resultFor(answered, (line) =>
      line.slug === S.slug ? { status: 'soldOut', quantity: 0, maxQuantity: 0, lineTotal: 0 } : {}
    );
    const out = reconcileBag({
      lines: [{ ...A, quantity: 5 }, S],
      result: previous,
      fetch: { status: 'fetching' },
      session: EMPTY_SESSION,
    });
    expect(ready(out.view).summary).toEqual({
      state: 'stale',
      subtotal: 5700,
      purchasablePieces: 2,
      excludedPieces: 2,
      localPieces: 7,
    });
  });

  it('reduced: shows and totals the allowed quantity, writes nothing, and says so again next quote', () => {
    const lines = [{ ...A, quantity: 4 }];
    const result = resultFor(lines, () => ({ status: 'reduced', quantity: 2, maxQuantity: 2 }));

    const first = reconcileBag({ lines, result, fetch: SETTLED, session: EMPTY_SESSION });
    const r = row(first.view, lines[0]!);
    expect(r).toMatchObject({
      status: 'reduced',
      displayQuantity: 2,
      lineTotal: 5700,
      maxQuantity: 2,
    });
    expect(r.line.quantity).toBe(4);
    expect(r.notices).toEqual([{ kind: 'quantityLimited', count: 2 }]);
    expect(first.correction).toBeNull();
    expect(ready(first.view).summary).toMatchObject({ purchasablePieces: 2, excludedPieces: 2 });

    const again = reconcileBag({
      lines,
      result,
      fetch: SETTLED,
      session: session({ [cartLineKey(A)]: 2850 }, [result.key]),
    });
    expect(row(again.view, lines[0]!).notices).toEqual([{ kind: 'quantityLimited', count: 2 }]);
    expect(again.correction).toBeNull();
  });

  it('one soldOut line of quantity 2 among 5 local pieces: subtotal excludes it, 3 pieces, 2 excluded', () => {
    const S: CartLine = { slug: 'silk-slip-dress', options: { size: 'M' }, quantity: 2 };
    const lines = [{ ...A, quantity: 3 }, S];
    const result = resultFor(lines, (line) =>
      line.slug === S.slug
        ? { status: 'soldOut', unitPrice: 3100, quantity: 0, maxQuantity: 0, lineTotal: 0 }
        : {}
    );

    const out = reconcileBag({ lines, result, fetch: SETTLED, session: EMPTY_SESSION });
    expect(ready(out.view).summary).toEqual({
      state: 'current',
      subtotal: 8550,
      purchasablePieces: 3,
      excludedPieces: 2,
      localPieces: 5,
    });
    expect(row(out.view, S)).toMatchObject({
      status: 'soldOut',
      unitPrice: 3100,
      displayQuantity: 2,
      lineTotal: null,
      notices: [{ kind: 'soldOut' }],
    });
  });

  it('variantUnavailable and productUnavailable are distinct; a null product keeps stored options', () => {
    const lines = [A, C];
    const result = resultFor(lines, (line) =>
      line === A
        ? {
            status: 'variantUnavailable',
            options: [],
            unitPrice: null,
            quantity: 0,
            maxQuantity: 0,
            lineTotal: 0,
          }
        : {
            status: 'productUnavailable',
            product: null,
            options: [],
            unitPrice: null,
            quantity: 0,
            maxQuantity: 0,
            lineTotal: 0,
          }
    );

    const out = reconcileBag({ lines, result, fetch: SETTLED, session: EMPTY_SESSION });
    expect(row(out.view, A)).toMatchObject({
      status: 'variantUnavailable',
      notices: [{ kind: 'variantUnavailable' }],
      lineTotal: null,
    });
    expect(row(out.view, A).product?.name).toBe('name:silk-midi-dress');
    expect(row(out.view, C)).toMatchObject({
      status: 'productUnavailable',
      product: null,
      notices: [{ kind: 'productUnavailable' }],
      options: [{ key: 'size', label: 'size', value: 'S' }],
    });
    expect(ready(out.view).summary).toMatchObject({
      subtotal: 0,
      purchasablePieces: 0,
      excludedPieces: 3,
    });
    // Unavailable lines are never rewritten: their quote options are empty.
    expect(out.correction).toBeNull();
    expect(out.rememberPrices).toBeNull();
  });

  it('price change in session: flagged, remembered, and stays flagged while that quote is shown', () => {
    const lines = [A];
    const result = resultFor(lines, () => ({ unitPrice: 3100 }));
    const memory = session({ [cartLineKey(A)]: 2850 });

    const out = reconcileBag({ lines, result, fetch: SETTLED, session: memory });
    expect(row(out.view, A).notices).toEqual([{ kind: 'priceUpdated' }]);
    expect(out.rememberPrices).toEqual({ [cartLineKey(A)]: 3100 });
    expect(out.priceUpdates).toEqual({ [cartLineKey(A)]: result.key });
    expect(out.announcement).toEqual({
      kind: 'updated',
      markKey: result.key,
      issues: { unavailable: 0, limited: 0, priceUpdated: 1 },
    });

    const remembered = session(out.rememberPrices, [result.key], out.priceUpdates);
    // Prices stay in their own map: nothing but line keys is ever written there.
    expect([...remembered.previousPrices.keys()]).toEqual([cartLineKey(A)]);
    const after = reconcileBag({ lines, result, fetch: SETTLED, session: remembered });
    expect(row(after.view, A).notices).toEqual([{ kind: 'priceUpdated' }]);
    expect(after.rememberPrices).toBeNull();
    expect(after.priceUpdates).toBeNull();
    expect(after.announcement).toBeNull();

    // A later quote at the same price clears the flag.
    const nextLines = [{ ...A, quantity: 3 }];
    const next = reconcileBag({
      lines: nextLines,
      result: resultFor(nextLines, () => ({ unitPrice: 3100 })),
      fetch: SETTLED,
      session: remembered,
    });
    expect(row(next.view, nextLines[0]!).notices).toEqual([]);
  });

  it('first quote of the session never flags a price', () => {
    const lines = [A];
    const out = reconcileBag({
      lines,
      result: resultFor(lines, () => ({ unitPrice: 3100 })),
      fetch: SETTLED,
      session: EMPTY_SESSION,
    });
    expect(row(out.view, A).notices).toEqual([]);
  });

  it('a pending quantity keeps the last quoted limit; an unquoted line has none', () => {
    const result = resultFor([A], () => ({ maxQuantity: 4 }));
    const changed = { ...A, quantity: 3 };
    const out = reconcileBag({
      lines: [changed, B],
      result,
      fetch: { status: 'fetching' },
      session: EMPTY_SESSION,
    });
    expect(row(out.view, changed)).toMatchObject({
      status: 'pending',
      maxQuantity: null,
      knownMaxQuantity: 4,
    });
    expect(row(out.view, B)).toMatchObject({ status: 'pending', knownMaxQuantity: null });
  });

  it('canonical options: one correction, and applying it then re-quoting is a fixed point', () => {
    const stored: CartLine = { slug: 'silk-midi-dress', options: { Size: 'm' }, quantity: 2 };
    const canonical = [{ key: 'size', label: 'Size', value: 'M' }];
    const lines = [stored, B];
    const result = resultFor(lines, (line) => (line === stored ? { options: canonical } : {}));

    const out = reconcileBag({ lines, result, fetch: SETTLED, session: EMPTY_SESSION });
    expect(out.correction).toEqual({
      quoteKey: result.key,
      rewrites: [{ key: cartLineKey(stored), options: { size: 'M' } }],
    });

    let corrected: readonly CartLine[] = lines;
    for (const rewrite of out.correction!.rewrites) {
      corrected = applyCanonical(corrected, rewrite.key, rewrite.options);
    }
    expect(corrected[0]).toEqual({ slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 });

    // Before the re-quote settles, the old result is stale and emits nothing.
    expect(
      reconcileBag({
        lines: corrected,
        result,
        fetch: { status: 'fetching' },
        session: EMPTY_SESSION,
      }).correction
    ).toBeNull();

    const requote = resultFor(corrected, (line) =>
      line.slug === stored.slug ? { options: canonical } : {}
    );
    const settled = reconcileBag({
      lines: corrected,
      result: requote,
      fetch: SETTLED,
      session: EMPTY_SESSION,
    });
    expect(settled.correction).toBeNull();
  });

  it('canonical rewrite merging into an existing line reaches a fixed point too', () => {
    const lower: CartLine = { slug: 'silk-midi-dress', options: { size: 'm' }, quantity: 9 };
    const lines = [A, lower];
    const canonical = [{ key: 'size', label: 'Size', value: 'M' }];
    const result = resultFor(lines, () => ({ options: canonical }));

    const out = reconcileBag({ lines, result, fetch: SETTLED, session: EMPTY_SESSION });
    expect(out.correction?.rewrites).toEqual([{ key: cartLineKey(lower), options: { size: 'M' } }]);

    const merged = applyCanonical(lines, cartLineKey(lower), { size: 'M' });
    expect(merged).toEqual([{ ...A, quantity: 10 }]);
    const settled = reconcileBag({
      lines: merged,
      result: resultFor(merged, () => ({ options: canonical })),
      fetch: SETTLED,
      session: EMPTY_SESSION,
    });
    expect(settled.correction).toBeNull();
  });

  it('announces issues once per quote key; a pending correction defers it', () => {
    const lines = [{ ...A, quantity: 4 }, C];
    const result = resultFor(lines, (line) =>
      line.slug === A.slug
        ? { status: 'reduced', quantity: 2, maxQuantity: 2, lineTotal: 5700 }
        : { status: 'soldOut', quantity: 0, maxQuantity: 0, lineTotal: 0 }
    );

    const first = reconcileBag({ lines, result, fetch: SETTLED, session: EMPTY_SESSION });
    expect(first.announcement).toEqual({
      kind: 'updated',
      markKey: result.key,
      issues: { unavailable: 1, limited: 1, priceUpdated: 0 },
    });

    const remount = reconcileBag({
      lines,
      result,
      fetch: SETTLED,
      session: session(null, [result.key]),
    });
    expect(remount.announcement).toBeNull();

    const needsRewrite = resultFor(lines, (line) =>
      line.slug === A.slug
        ? {
            status: 'reduced',
            quantity: 2,
            maxQuantity: 2,
            options: [{ key: 'size', label: 'Size', value: 'm2' }],
          }
        : {}
    );
    const deferred = reconcileBag({
      lines,
      result: needsRewrite,
      fetch: SETTLED,
      session: EMPTY_SESSION,
    });
    expect(deferred.correction).not.toBeNull();
    expect(deferred.announcement).toBeNull();
  });

  it('empty lines: empty view, nothing else', () => {
    expect(
      reconcileBag({ lines: [], result: resultFor([A]), fetch: SETTLED, session: EMPTY_SESSION })
    ).toEqual({
      view: { kind: 'empty' },
      correction: null,
      announcement: null,
      rememberPrices: null,
      priceUpdates: null,
    });
  });

  it('no usable quote yet: one local row per line, newest first, hints applied', () => {
    const out = reconcileBag({
      lines: [A, B],
      result: undefined,
      fetch: { status: 'fetching' },
      session: session(null, [], null, { [cartLineKey(B)]: C_HINT }),
    });
    if (out.view.kind !== 'loading') throw new Error(`expected loading, got ${out.view.kind}`);
    expect(out.view.localPieces).toBe(3);
    expect(out.view.rows.map((r) => r.key)).toEqual([cartLineKey(B), cartLineKey(A)]);
    expect(row(out.view, A)).toMatchObject({
      status: 'pending',
      product: null,
      provisional: null,
      unitPrice: null,
      lineTotal: null,
      displayQuantity: 2,
      options: [{ key: 'size', label: 'size', value: 'M' }],
    });
    expect(row(out.view, B)).toMatchObject({
      provisional: C_HINT,
      unitPrice: 1900,
      lineTotal: null,
    });
    expect(out.correction).toBeNull();
    expect(out.announcement).toBeNull();
  });

  it.each([
    ['RATE_LIMITED', 429],
    ['TIMEOUT', 0],
    ['NETWORK_ERROR', 0],
    ['SERVICE_UNAVAILABLE', 503],
    ['INVALID_RESPONSE', 200],
  ])('%s: failed with retry, no rows, local pieces, announced once', (code, status) => {
    const lines = [A, B];
    const fetch: CartQuoteFetch = {
      status: 'error',
      error: new ApiError({ status, code, message: '' }),
    };
    const out = reconcileBag({ lines, result: resultFor(lines), fetch, session: EMPTY_SESSION });
    expect(out.view).toEqual({ kind: 'failed', localPieces: 3, canRetry: true, canEmpty: false });
    const markKey = failureAnnouncementKey(cartQuoteKey(lines));
    expect(out.announcement).toEqual({ kind: 'failed', markKey });
    expect(out.correction).toBeNull();
    expect(out.rememberPrices).toBeNull();

    const again = reconcileBag({
      lines,
      result: undefined,
      fetch,
      session: session(null, [markKey]),
    });
    expect(again.announcement).toBeNull();
  });

  it('VALIDATION_ERROR: failed with Empty bag and no retry', () => {
    const out = reconcileBag({
      lines: [A],
      result: undefined,
      fetch: {
        status: 'error',
        error: new ApiError({ status: 400, code: 'VALIDATION_ERROR', message: '' }),
      },
      session: EMPTY_SESSION,
    });
    expect(out.view).toEqual({ kind: 'failed', localPieces: 2, canRetry: false, canEmpty: true });
  });
});
