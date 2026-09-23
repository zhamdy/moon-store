/**
 * Validates what the Manage Variants dialog holds, as text, before a request is built.
 *
 * The dialog coerced instead of parsing: `Number(stock) || 0` turned "abc" into a
 * perfectly valid request creating the variant with **stock 0**, and the operator was
 * never told their entry had been discarded — silent data loss on the column that governs
 * sale for a variant product (MED-12). A bad price fared no better: `Number("abc")` is
 * NaN, and `JSON.stringify` writes NaN as `null`, which the server reads as "inherit the
 * product price".
 *
 * The rules mirror the server's `variantSchema`, so the dialog refuses what the API would
 * refuse and says which field — rather than sending it and showing a generic toast with
 * nothing highlighted, which is a worse error experience than every other surface in this
 * feature.
 */
export interface VariantDraft {
  sku: string;
  barcode: string;
  /** Blank means "inherit the product price": the NULL override seam the catalog reads. */
  price: string;
  costPrice: string;
  stock: string;
  attributes: { key: string; value: string }[];
}

export type VariantField = 'sku' | 'price' | 'costPrice' | 'stock' | 'attributes';

export interface VariantDraftResult {
  errors: Partial<Record<VariantField, string>>;
  /** The request body, present only when there are no errors. */
  body?: {
    sku: string;
    barcode: string | null;
    price: number | null;
    cost_price: number;
    stock: number;
    attributes: Record<string, string>;
  };
}

/** `''` is absent. Anything else must parse exactly, so "12abc" is a refusal, not 12. */
function parseNumber(raw: string): number | null | 'invalid' {
  const text = raw.trim();
  if (text === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(text)) return 'invalid';
  const value = Number(text);
  return Number.isFinite(value) ? value : 'invalid';
}

export function validateVariantDraft(
  draft: VariantDraft,
  messages: Record<
    'skuRequired' | 'pricePositive' | 'costNonNegative' | 'stockInteger' | 'attributesRequired',
    string
  >
): VariantDraftResult {
  const errors: Partial<Record<VariantField, string>> = {};

  if (draft.sku.trim() === '') errors.sku = messages.skuRequired;

  const price = parseNumber(draft.price);
  // `.positive()` on the server, and migration 019 now forbids a stored zero outright:
  // a variant price is either absent (inherit) or a real price.
  if (price === 'invalid' || (price !== null && price <= 0)) errors.price = messages.pricePositive;

  const costPrice = parseNumber(draft.costPrice);
  if (costPrice === 'invalid' || (costPrice !== null && costPrice < 0)) {
    errors.costPrice = messages.costNonNegative;
  }

  const stock = parseNumber(draft.stock);
  if (stock === 'invalid' || stock === null || !Number.isInteger(stock) || stock < 0) {
    errors.stock = messages.stockInteger;
  }

  const attributes: Record<string, string> = {};
  for (const attr of draft.attributes) {
    if (attr.key.trim() && attr.value.trim()) attributes[attr.key.trim()] = attr.value.trim();
  }
  if (Object.keys(attributes).length === 0) errors.attributes = messages.attributesRequired;

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors: {},
    body: {
      sku: draft.sku.trim(),
      barcode: draft.barcode.trim() || null,
      price: price as number | null,
      cost_price: (costPrice as number | null) ?? 0,
      stock: stock as number,
      attributes,
    },
  };
}
