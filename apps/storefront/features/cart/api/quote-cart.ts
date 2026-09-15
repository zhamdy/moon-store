import { apiFetch } from '@/lib/api/client';
import { CATALOG_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/errors';
import type {
  CartQuote,
  CartQuoteLine,
  CartQuoteLineStatus,
  CartQuoteOption,
  CartQuoteProduct,
} from '../types/cart-quote';
import type { CartLine } from '../utils/cart-lines';

/**
 * The quote client. A **browser** module (CD-4): no `server-only`, no catalog server token,
 * no credentials. Validated by hand rather than with Zod, which would be new eager weight.
 */

export type CartQuoteRequestBody = {
  lines: { slug: string; options: Record<string, string>; quantity: number }[];
};

/** Only `slug`, `options` and `quantity` leave the browser; the API rejects any other key. */
export function buildCartQuoteBody(lines: readonly CartLine[]): CartQuoteRequestBody {
  return {
    lines: lines.map((line) => ({
      slug: line.slug,
      options: { ...line.options },
      quantity: line.quantity,
    })),
  };
}

const STATUSES: ReadonlySet<string> = new Set<CartQuoteLineStatus>([
  'ok',
  'reduced',
  'soldOut',
  'variantUnavailable',
  'productUnavailable',
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function invalid(message: string): ApiError {
  return new ApiError({ status: 200, code: 'INVALID_RESPONSE', message });
}

function isOption(value: unknown): value is CartQuoteOption {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.label === 'string' &&
    typeof value.value === 'string'
  );
}

function isProduct(value: unknown): value is CartQuoteProduct {
  if (!isRecord(value)) return false;
  const { image } = value;
  return (
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    (value.nameEn === null || typeof value.nameEn === 'string') &&
    (image === null || (isRecord(image) && typeof image.url === 'string'))
  );
}

function parseLine(value: unknown, index: number, requested: CartLine): CartQuoteLine {
  const at = `quote line ${index}`;
  if (!isRecord(value)) throw invalid(`The ${at} was not an object.`);
  if (value.index !== index) throw invalid(`The ${at} carried index ${String(value.index)}.`);
  if (value.slug !== requested.slug) throw invalid(`The ${at} named a different slug.`);
  if (typeof value.status !== 'string' || !STATUSES.has(value.status)) {
    throw invalid(`The ${at} had an unknown status.`);
  }
  const status = value.status as CartQuoteLineStatus;
  const unavailable = status === 'variantUnavailable' || status === 'productUnavailable';

  if (!(value.product === null || isProduct(value.product))) {
    throw invalid(`The ${at} had a malformed product.`);
  }
  if (value.product === null && status !== 'productUnavailable') {
    throw invalid(`The ${at} had no product for status ${status}.`);
  }
  if (!Array.isArray(value.options) || !value.options.every(isOption)) {
    throw invalid(`The ${at} had malformed options.`);
  }
  // A resolved line must be priced; only an unavailable one may carry null.
  if (!(isFiniteNumber(value.unitPrice) || (unavailable && value.unitPrice === null))) {
    throw invalid(`The ${at} had a non-numeric unitPrice.`);
  }
  for (const field of ['requestedQuantity', 'quantity', 'maxQuantity'] as const) {
    if (!isCount(value[field])) throw invalid(`The ${at} had a non-integer ${field}.`);
  }
  if (!isFiniteNumber(value.lineTotal)) throw invalid(`The ${at} had a non-numeric lineTotal.`);

  return {
    index,
    slug: value.slug,
    status,
    product: value.product,
    options: value.options,
    unitPrice: value.unitPrice as number | null,
    requestedQuantity: value.requestedQuantity as number,
    quantity: value.quantity as number,
    maxQuantity: value.maxQuantity as number,
    lineTotal: value.lineTotal,
  };
}

/**
 * Checks the whole response against the request it answers. Anything missing or ill-typed,
 * an unknown status, or lines that do not correspond one-to-one with the request throws
 * `INVALID_RESPONSE`: a wrong price must fail, not render.
 */
export function parseCartQuote(data: unknown, requested: readonly CartLine[]): CartQuote {
  if (!isRecord(data)) throw invalid('The cart quote was not an object.');
  if (!Array.isArray(data.lines)) throw invalid('The cart quote was missing lines.');
  if (data.lines.length !== requested.length) {
    throw invalid('The cart quote line count did not match the request.');
  }
  if (!isFiniteNumber(data.subtotal)) throw invalid('The cart quote had a non-numeric subtotal.');
  if (!isCount(data.itemCount)) throw invalid('The cart quote had a non-integer itemCount.');
  if (!isCount(data.maxLineQuantity)) {
    throw invalid('The cart quote had a non-integer maxLineQuantity.');
  }

  return {
    lines: data.lines.map((line, index) => parseLine(line, index, requested[index]!)),
    subtotal: data.subtotal,
    itemCount: data.itemCount,
    maxLineQuantity: data.maxLineQuantity,
  };
}

export async function quoteCart(
  lines: readonly CartLine[],
  { signal }: { signal?: AbortSignal } = {}
): Promise<CartQuote> {
  const { data } = await apiFetch<unknown>(CATALOG_ENDPOINTS.cartQuote, {
    method: 'POST',
    body: buildCartQuoteBody(lines),
    credentials: 'omit',
    signal,
  });
  return parseCartQuote(data, lines);
}
