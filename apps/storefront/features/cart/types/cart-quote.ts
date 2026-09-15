/**
 * `POST /api/v1/catalog/cart/quote` response DTOs, as the API sends them (plan
 * 2026-09-15-001, *Quote contract*). Modelled on the wire shape, never on server types.
 */

export type CartQuoteLineStatus =
  | 'ok'
  | 'reduced'
  | 'soldOut'
  | 'variantUnavailable'
  | 'productUnavailable';

export interface CartQuoteProduct {
  slug: string;
  name: string;
  nameEn: string | null;
  image: { url: string } | null;
}

/** A canonical option spelling, with the server's label. */
export interface CartQuoteOption {
  key: string;
  label: string;
  value: string;
}

export interface CartQuoteLine {
  /** The request position. */
  index: number;
  /** As requested. */
  slug: string;
  status: CartQuoteLineStatus;
  /** Null only for `productUnavailable`. */
  product: CartQuoteProduct | null;
  /** Canonical spellings; empty for a no-variant product or an unresolved variant. */
  options: CartQuoteOption[];
  /** The effective price; null when the product or variant is unavailable. */
  unitPrice: number | null;
  requestedQuantity: number;
  /** The allowed quantity; 0 when not purchasable. */
  quantity: number;
  /** `min(stock, 10)`; 0 when not purchasable. */
  maxQuantity: number;
  /** `unitPrice × quantity`, rounded to 2 decimals; 0 when not purchasable. */
  lineTotal: number;
}

export interface CartQuote {
  lines: CartQuoteLine[];
  subtotal: number;
  /** Σ allowed quantity: the purchasable pieces. */
  itemCount: number;
  maxLineQuantity: number;
}

/** A settled quote with the request it answered, so joins go by line key, never position. */
export interface CartQuoteResult {
  /** `cartQuoteKey` of the requested lines. */
  key: string;
  /** `cartLineKey` of each requested line, in request order. */
  lineKeys: readonly string[];
  quote: CartQuote;
}
