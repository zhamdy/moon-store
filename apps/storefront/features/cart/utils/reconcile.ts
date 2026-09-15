import { isApiError } from '@/lib/api/errors';
import type { LocalizedText } from '@/features/products/utils/localized-name';
import type {
  CartQuoteLine,
  CartQuoteLineStatus,
  CartQuoteOption,
  CartQuoteProduct,
  CartQuoteResult,
} from '../types/cart-quote';
import { cartLineKey, totalPieces, type CartLine, type CartOptions } from './cart-lines';

/**
 * Pure reconciliation (plan 2026-09-15-001, *Client line states and reconciliation*):
 * stored lines + the latest quote + session memory → what the bag surfaces render, the one
 * store correction, the announcement input and the session-memory update. It never writes;
 * the caller applies `correction`, `rememberPrices` and `announcement.markKey`.
 */

/** The quote identity of a set of lines: each line key with its quantity, in store order. */
export function cartQuoteKey(lines: readonly CartLine[]): string {
  return JSON.stringify(lines.map((line) => [cartLineKey(line), line.quantity]));
}

export type CartQuoteFetch =
  | { status: 'idle' }
  | { status: 'fetching' }
  | { status: 'settled' }
  | { status: 'error'; error: unknown };

export interface CartSessionMemory {
  readonly previousPrices: ReadonlyMap<string, number>;
  /** Line key → the quote key that found its price change (the store's `priceUpdates`). */
  readonly priceUpdates: ReadonlyMap<string, string>;
  readonly announcedQuoteKeys: ReadonlySet<string>;
  /** Line key → what the product page knew at Add to Bag; in memory only, never persisted. */
  readonly hints: ReadonlyMap<string, BagLineHint>;
}

/**
 * The product page's own name, first image and exact unit price, kept for a line no quote
 * has seen yet so the piece just added is never a grey block. Display only: never totalled.
 */
export interface BagLineHint {
  name: LocalizedText;
  imageUrl: string | null;
  unitPrice: number | null;
}

/** `pending`: no verdict for the stored quantity yet (new line, or quantity changed). */
export type BagRowStatus = CartQuoteLineStatus | 'pending';

export type BagNotice =
  | { kind: 'soldOut' }
  | { kind: 'variantUnavailable' }
  | { kind: 'productUnavailable' }
  | { kind: 'quantityLimited'; count: number }
  | { kind: 'priceUpdated' };

export interface BagRow {
  key: string;
  /** The stored intent; `line.quantity` is what a stepper commit starts from. */
  line: CartLine;
  status: BagRowStatus;
  /** Null when the quote has no product for this key (unavailable, or not quoted yet). */
  product: CartQuoteProduct | null;
  /** The Add to Bag hint, only while no quote line exists for this key; status is `pending`. */
  provisional: BagLineHint | null;
  /** Canonical options from the quote when resolved, else the stored spelling (label = key). */
  options: readonly CartQuoteOption[];
  unitPrice: number | null;
  /** `reduced`: the allowed quantity (display only, CD-15); otherwise the stored quantity. */
  displayQuantity: number;
  /** Null until the quote has a verdict for this line at its stored quantity. */
  maxQuantity: number | null;
  /**
   * The latest quoted `maxQuantity` for this key, kept while the verdict is pending: it is
   * `min(stock, 10)` and does not depend on the requested quantity, so + holds there between
   * quotes. Null only when no quote has seen the line.
   */
  knownMaxQuantity: number | null;
  /**
   * Only ever a quoted figure. While `pending` it is the previous quote's total (rendered
   * dimmed and busy); null for excluded lines and for lines no quote has priced.
   */
  lineTotal: number | null;
  notices: readonly BagNotice[];
}

export interface BagSummary {
  /**
   * `current` only when the quote answers exactly the stored lines. `stale` keeps the
   * previous quote's figures on screen, dimmed and busy, until the new quote settles.
   */
  state: 'current' | 'stale';
  /** The quote's subtotal: the current quote's, or the previous one's while stale. */
  subtotal: number;
  /** The quote's `itemCount`. */
  purchasablePieces: number;
  /** Pieces the quote it came from could not sell (sold out, unavailable, limited). */
  excludedPieces: number;
  /** Σ stored quantities (CD-18). */
  localPieces: number;
}

export type BagView =
  | { kind: 'empty' }
  /** No quote yet: rows carry only what is local (options, quantity, any Add to Bag hint). */
  | { kind: 'loading'; rows: readonly BagRow[]; localPieces: number }
  | {
      kind: 'failed';
      localPieces: number;
      /** False for a 400: retrying the same body cannot succeed. */
      canRetry: boolean;
      /** A 400 means client and server limits drifted; clearing is the way out. */
      canEmpty: boolean;
    }
  | { kind: 'ready'; rows: readonly BagRow[]; summary: BagSummary };

export interface CanonicalCorrection {
  quoteKey: string;
  /** Apply in order with `applyCanonical(key, options)`. */
  rewrites: readonly { key: string; options: CartOptions }[];
}

export interface BagIssueCounts {
  unavailable: number;
  limited: number;
  priceUpdated: number;
}

export type BagAnnouncement =
  | { kind: 'updated'; markKey: string; issues: BagIssueCounts }
  | { kind: 'failed'; markKey: string };

export interface ReconcileInput {
  lines: readonly CartLine[];
  result: CartQuoteResult | undefined;
  fetch: CartQuoteFetch;
  session: CartSessionMemory;
}

export interface ReconcileOutput {
  view: BagView;
  correction: CanonicalCorrection | null;
  announcement: BagAnnouncement | null;
  /** Pass to `rememberPrices`; null when nothing is new. */
  rememberPrices: Record<string, number> | null;
  /**
   * Pass to `markPriceUpdates`; null when nothing is new. Overwriting `previousPrices` alone
   * would make the notice vanish on the next render, so a change is pinned to the quote that
   * found it and stays visible for as long as that quote is on screen.
   */
  priceUpdates: Record<string, string> | null;
}

export function failureAnnouncementKey(quoteKey: string): string {
  return `failed:${quoteKey}`;
}

const UNAVAILABLE: ReadonlySet<BagRowStatus> = new Set<BagRowStatus>([
  'soldOut',
  'variantUnavailable',
  'productUnavailable',
]);

function canonicalOptions(options: readonly CartQuoteOption[]): CartOptions {
  return Object.fromEntries(options.map((option) => [option.key, option.value]));
}

function storedOptions(line: CartLine): CartQuoteOption[] {
  return Object.entries(line.options).map(([key, value]) => ({ key, label: key, value }));
}

function statusNotice(status: BagRowStatus, quoteLine: CartQuoteLine): BagNotice | null {
  switch (status) {
    case 'soldOut':
    case 'variantUnavailable':
    case 'productUnavailable':
      return { kind: status };
    case 'reduced':
      return { kind: 'quantityLimited', count: quoteLine.quantity };
    default:
      return null;
  }
}

function buildRow(
  line: CartLine,
  key: string,
  quoteLine: CartQuoteLine | undefined,
  priceUpdated: boolean,
  hint: BagLineHint | undefined
): BagRow {
  if (quoteLine === undefined) {
    return {
      key,
      line,
      status: 'pending',
      product: null,
      provisional: hint ?? null,
      options: storedOptions(line),
      unitPrice: hint?.unitPrice ?? null,
      displayQuantity: line.quantity,
      maxQuantity: null,
      knownMaxQuantity: null,
      lineTotal: null,
      notices: [],
    };
  }

  const atStoredQuantity = quoteLine.requestedQuantity === line.quantity;
  // Sold out and unavailable do not depend on quantity; ok/reduced do, so a changed quantity
  // waits for its own quote instead of showing the old verdict.
  const status: BagRowStatus =
    UNAVAILABLE.has(quoteLine.status) || atStoredQuantity ? quoteLine.status : 'pending';
  // Pending keeps the previous verdict's figure (only ok/reduced lines ever go pending).
  const priced = quoteLine.status === 'ok' || quoteLine.status === 'reduced';

  const notices: BagNotice[] = [];
  const notice = statusNotice(status, quoteLine);
  if (notice) notices.push(notice);
  if (priceUpdated && quoteLine.unitPrice !== null) notices.push({ kind: 'priceUpdated' });

  return {
    key,
    line,
    status,
    product: quoteLine.product,
    provisional: null,
    options: quoteLine.options.length > 0 ? quoteLine.options : storedOptions(line),
    unitPrice: quoteLine.unitPrice,
    displayQuantity: status === 'reduced' ? quoteLine.quantity : line.quantity,
    maxQuantity: status === 'pending' ? null : quoteLine.maxQuantity,
    knownMaxQuantity: quoteLine.maxQuantity,
    lineTotal: priced ? quoteLine.lineTotal : null,
    notices,
  };
}

function failure(error: unknown, localPieces: number): BagView {
  const rejected = isApiError(error) && error.code === 'VALIDATION_ERROR';
  return { kind: 'failed', localPieces, canRetry: !rejected, canEmpty: rejected };
}

export function reconcileBag({ lines, result, fetch, session }: ReconcileInput): ReconcileOutput {
  const none = { correction: null, announcement: null, rememberPrices: null, priceUpdates: null };
  if (lines.length === 0) return { view: { kind: 'empty' }, ...none };

  const localPieces = totalPieces(lines);
  const currentKey = cartQuoteKey(lines);

  if (fetch.status === 'error') {
    const markKey = failureAnnouncementKey(currentKey);
    return {
      ...none,
      view: failure(fetch.error, localPieces),
      announcement: session.announcedQuoteKeys.has(markKey) ? null : { kind: 'failed', markKey },
    };
  }

  if (result === undefined) {
    const rows = [...lines].reverse().map((line) => {
      const key = cartLineKey(line);
      return buildRow(line, key, undefined, false, session.hints.get(key));
    });
    return { view: { kind: 'loading', rows, localPieces }, ...none };
  }

  const current = result.key === currentKey;
  const quoteLines = new Map<string, CartQuoteLine>();
  result.lineKeys.forEach((lineKey, index) => {
    const quoteLine = result.quote.lines[index];
    if (quoteLine) quoteLines.set(lineKey, quoteLine);
  });

  const prices: Record<string, number> = {};
  const priceUpdates: Record<string, string> = {};
  const rewrites: { key: string; options: CartOptions }[] = [];
  const issues: BagIssueCounts = { unavailable: 0, limited: 0, priceUpdated: 0 };

  // Newest first: the store appends new lines.
  const rows = [...lines].reverse().map((line) => {
    const key = cartLineKey(line);
    const quoteLine = quoteLines.get(key);

    let priceUpdated = quoteLine !== undefined && session.priceUpdates.get(key) === result.key;

    if (current && quoteLine && quoteLine.unitPrice !== null) {
      const previous = session.previousPrices.get(key);
      if (previous === undefined) {
        prices[key] = quoteLine.unitPrice;
      } else if (previous !== quoteLine.unitPrice) {
        priceUpdated = true;
        prices[key] = quoteLine.unitPrice;
        priceUpdates[key] = result.key;
      }
    }

    if (current && quoteLine && quoteLine.options.length > 0) {
      const options = canonicalOptions(quoteLine.options);
      if (cartLineKey({ slug: line.slug, options }) !== key) rewrites.push({ key, options });
    }

    const row = buildRow(line, key, quoteLine, priceUpdated, session.hints.get(key));
    if (UNAVAILABLE.has(row.status)) issues.unavailable += 1;
    if (row.status === 'reduced') issues.limited += 1;
    if (row.notices.some((notice) => notice.kind === 'priceUpdated')) issues.priceUpdated += 1;
    return row;
  });

  const { subtotal, itemCount } = result.quote;
  // Excluded pieces are counted against the lines the quote answered, so a stale quote's
  // figures stay internally consistent while they remain on screen.
  const quotedPieces = current
    ? localPieces
    : result.quote.lines.reduce((sum, quoteLine) => sum + quoteLine.requestedQuantity, 0);
  const summary: BagSummary = {
    state: current ? 'current' : 'stale',
    subtotal,
    purchasablePieces: itemCount,
    excludedPieces: quotedPieces - itemCount,
    localPieces,
  };

  const correction = rewrites.length > 0 ? { quoteKey: result.key, rewrites } : null;
  const hasIssues = issues.unavailable + issues.limited + issues.priceUpdated > 0;
  // A quote about to be corrected re-quotes at once with the same issues; announce that one.
  const announcement: BagAnnouncement | null =
    current && !correction && hasIssues && !session.announcedQuoteKeys.has(result.key)
      ? { kind: 'updated', markKey: result.key, issues }
      : null;

  return {
    view: { kind: 'ready', rows, summary },
    correction,
    announcement,
    rememberPrices: Object.keys(prices).length > 0 ? prices : null,
    priceUpdates: Object.keys(priceUpdates).length > 0 ? priceUpdates : null,
  };
}
