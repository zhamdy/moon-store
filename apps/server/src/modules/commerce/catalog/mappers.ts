/**
 * Row -> public DTO (KD-2, KD-3).
 *
 * Each mapper names every key it emits, so a column a repository starts selecting cannot
 * reach a response on its own. Numbers are converted here: node-postgres returns NUMERIC
 * and COUNT-derived values as strings, pg-mem returns numbers, and the DTO is a number on
 * both.
 */
import {
  CATALOG_DETAIL_IMAGE_COUNT,
  CATALOG_LIST_IMAGE_COUNT,
  MAX_LINE_QUANTITY,
} from './constants';
import type {
  CartQuoteDto,
  CartQuoteLineDto,
  CartQuoteLineStatus,
  CartQuoteOptionDto,
  CartQuoteRequestLine,
  CatalogQuoteProductRow,
  CatalogCategoryDto,
  CatalogCategoryRow,
  CatalogCollectionDto,
  CatalogCollectionRow,
  CatalogContextDto,
  CatalogImageDto,
  CatalogOptionDto,
  CatalogProductCollectionRow,
  CatalogProductDetailDto,
  CatalogProductDetailRow,
  CatalogProductDto,
  CatalogProductRow,
  CatalogVariantDto,
  CatalogVariantRow,
} from './types';

const HTTP_URL = /^https?:\/\//i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * A stored image URL made absolute on `origin`.
 *
 * `origin` comes from configuration (`resolveMediaPublicOrigin`), never from the request's
 * Host or X-Forwarded-Host: these responses are publicly cached, so a forged host would
 * poison the cache for every shopper. Absolute http(s) URLs (an object store's) pass
 * through untouched. Anything else that carries a scheme, or is protocol-relative, is
 * dropped rather than handed to a browser.
 */
export function absoluteMediaUrl(stored: string | null | undefined, origin: string): string | null {
  if (typeof stored !== 'string') return null;
  const value = stored.trim();
  if (!value) return null;
  if (HTTP_URL.test(value)) return value;
  if (ANY_SCHEME.test(value) || value.startsWith('//') || value.startsWith('\\')) return null;
  return new URL(value.startsWith('/') ? value : `/${value}`, `${origin}/`).href;
}

function toNumber(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** `[primary, ...gallery by position]`, nulls and unusable URLs removed, capped. */
export function productImages(
  primary: string | null,
  galleryInOrder: readonly string[],
  origin: string,
  cap: number
): CatalogImageDto[] {
  const images: CatalogImageDto[] = [];
  for (const candidate of [primary, ...galleryInOrder]) {
    if (images.length >= cap) break;
    const url = absoluteMediaUrl(candidate, origin);
    if (url) images.push({ url });
  }
  return images;
}

/**
 * A listing item. `derived` is the row's options and variants, derived by the same
 * `deriveVariantOptions` the detail uses, so a card's Quick Add and the product page can
 * never disagree on what is choosable or in stock; `{ options: [], variants: [] }` for a
 * product with no variants. Stock quantities stay internal: a variant carries `inStock`
 * alone, exactly as on the detail (PD-3).
 */
export function toCatalogProductDto(
  row: CatalogProductRow,
  galleryInOrder: readonly string[],
  derived: Pick<DerivedVariants, 'options' | 'variants'>,
  origin: string
): CatalogProductDto {
  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en ?? null,
    description: row.description ?? null,
    descriptionEn: row.description_en ?? null,
    price: toNumber(row.price),
    images: productImages(row.image_url, galleryInOrder, origin, CATALOG_LIST_IMAGE_COUNT),
    isNew: row.is_new === true,
    inStock: row.in_stock === true,
    options: derived.options,
    variants: derived.variants,
  };
}

export function toCatalogCategoryDto(row: CatalogCategoryRow): CatalogCategoryDto {
  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en ?? null,
    description: row.description ?? null,
    descriptionEn: row.description_en ?? null,
    productCount: toNumber(row.product_count),
  };
}

export function toCatalogCollectionDto(
  row: CatalogCollectionRow,
  origin: string
): CatalogCollectionDto {
  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en ?? null,
    description: row.description ?? null,
    descriptionEn: row.description_en ?? null,
    season: row.season ?? null,
    year: row.year === null || row.year === undefined ? null : toNumber(row.year),
    imageUrl: absoluteMediaUrl(row.image_url, origin),
    isFeatured: row.is_featured === true || Number(row.is_featured) === 1,
    productCount: toNumber(row.product_count),
  };
}

interface ParsedVariant {
  row: CatalogVariantRow;
  /** In attribute order: normalized key, first spelling of the key, trimmed value. */
  entries: { key: string; label: string; value: string }[];
  signature: string;
}

/**
 * Attribute normalizers, shared by variant derivation and cart quote matching (plan
 * 2026-09-15-001, CD-5) so a bag line and the product page can never disagree on what
 * "the same option" means. NFC so a composed and a decomposed spelling compare equal.
 */
export function normalizeAttributeLabel(raw: string): string {
  return raw.trim().normalize('NFC');
}

/** A key as matched: trimmed, NFC, lower-cased (`Size` and `size` are one key). */
export function normalizeAttributeKey(raw: string): string {
  return normalizeAttributeLabel(raw).toLowerCase();
}

/** A value as shown: trimmed, NFC. Values match case-insensitively, see `combinationKey`. */
export function normalizeAttributeValue(raw: string): string {
  return raw.trim().normalize('NFC');
}

/** One variant's identity: normalized keys with lower-cased values, in key order. */
function combinationKey(entries: readonly (readonly [string, string])[]): string {
  return JSON.stringify(
    entries
      .map(([key, value]) => [key, value.toLowerCase()])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );
}

/** `attributes` with trimmed, lower-cased keys, or null when any part is unusable. */
function parseAttributes(row: CatalogVariantRow): ParsedVariant | null {
  let raw: unknown;
  try {
    raw = JSON.parse(row.attributes ?? '');
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const entries: ParsedVariant['entries'] = [];
  const seen = new Set<string>();
  for (const [originalKey, originalValue] of Object.entries(raw)) {
    if (typeof originalValue !== 'string') return null;
    const label = normalizeAttributeLabel(originalKey);
    const value = normalizeAttributeValue(originalValue);
    const key = label.toLowerCase();
    if (!key || !value || seen.has(key)) return null;
    seen.add(key);
    entries.push({ key, label, value });
  }
  if (entries.length === 0) return null;
  return { row, entries, signature: JSON.stringify([...seen].sort()) };
}

export interface DerivedVariants {
  options: CatalogOptionDto[];
  variants: CatalogVariantDto[];
  /** Variant row ids left out, for the caller to log. Never part of a response. */
  droppedVariantIds: number[];
}

/** A listed variant as the quote needs it. Internal: `stock` must never reach a response. */
export interface UsableVariant {
  combination: string;
  /** Canonical key -> shown value, exactly the DTO variant's `options`. */
  selected: Record<string, string>;
  price: number;
  stock: number;
}

export interface DerivedVariantsWithStock extends DerivedVariants {
  /** One entry per `variants` entry, in the same order. */
  usable: UsableVariant[];
}

/**
 * Options and purchasable variants from free-form variant attributes (plan 2026-09-14-003,
 * *Variant and availability model*). Pure.
 *
 * `rows` must be in id order: creation order is display order, and a canonical key set tie
 * goes to the lowest id's set. A variant whose attributes do not parse, or whose key set is
 * not the canonical one, is dropped. So is a variant repeating an earlier variant's
 * combination (values compare case-insensitively): a public variant is identified by its
 * option values alone (PD-3), so two with the same values could not be told apart.
 */
export function deriveVariantOptions(
  rows: readonly CatalogVariantRow[],
  productPrice: string | number
): DerivedVariants {
  const { options, variants, droppedVariantIds } = deriveVariantsWithStock(rows, productPrice);
  return { options, variants, droppedVariantIds };
}

/**
 * `deriveVariantOptions` plus each listed variant's stock and match key, for the cart quote
 * (CD-5). The same derivation, not a copy: the quote's price, availability and dropped
 * variants are exactly the product page's.
 */
export function deriveVariantsWithStock(
  rows: readonly CatalogVariantRow[],
  productPrice: string | number
): DerivedVariantsWithStock {
  const parsed: ParsedVariant[] = [];
  const droppedVariantIds: number[] = [];
  const signatureCounts = new Map<string, number>();

  for (const row of rows) {
    const variant = parseAttributes(row);
    if (variant === null) {
      droppedVariantIds.push(row.id);
      continue;
    }
    parsed.push(variant);
    signatureCounts.set(variant.signature, (signatureCounts.get(variant.signature) ?? 0) + 1);
  }

  let canonical: string | null = null;
  for (const variant of parsed) {
    const count = signatureCounts.get(variant.signature) ?? 0;
    if (canonical === null || count > (signatureCounts.get(canonical) ?? 0)) {
      canonical = variant.signature;
    }
  }

  type OptionBuilder = CatalogOptionDto & { shownByNormalized: Map<string, string> };
  const options: OptionBuilder[] = [];
  const optionByKey = new Map<string, OptionBuilder>();
  const variants: CatalogVariantDto[] = [];
  const usable: UsableVariant[] = [];
  const combinations = new Set<string>();

  for (const variant of parsed) {
    if (variant.signature !== canonical) {
      droppedVariantIds.push(variant.row.id);
      continue;
    }
    const normalized = variant.entries.map((entry) => entry.value.toLowerCase());
    const combination = combinationKey(variant.entries.map((entry) => [entry.key, entry.value]));
    if (combinations.has(combination)) {
      droppedVariantIds.push(variant.row.id);
      continue;
    }
    combinations.add(combination);

    const selected: Record<string, string> = {};
    variant.entries.forEach((entry, i) => {
      let option = optionByKey.get(entry.key);
      if (!option) {
        option = { key: entry.key, label: entry.label, values: [], shownByNormalized: new Map() };
        optionByKey.set(entry.key, option);
        options.push(option);
      }
      let shown = option.shownByNormalized.get(normalized[i]);
      if (shown === undefined) {
        shown = entry.value;
        option.shownByNormalized.set(normalized[i], shown);
        option.values.push(shown);
      }
      selected[entry.key] = shown;
    });

    const price = toNumber(variant.row.price ?? productPrice);
    const stock = toNumber(variant.row.stock);
    variants.push({ options: selected, price, inStock: stock > 0 });
    usable.push({ combination, selected, price, stock });
  }

  return {
    options: options.map(({ key, label, values }) => ({ key, label, values })),
    variants,
    droppedVariantIds: droppedVariantIds.sort((a, b) => a - b),
    usable,
  };
}

export function rowHasVariants(row: {
  has_variants: string | number | boolean | null | undefined;
}): boolean {
  return row.has_variants === true || Number(row.has_variants) === 1;
}

export function toCatalogProductDetailDto(
  row: CatalogProductDetailRow,
  galleryInOrder: readonly string[],
  derived: Pick<DerivedVariants, 'options' | 'variants'>,
  collections: readonly CatalogProductCollectionRow[],
  origin: string
): CatalogProductDetailDto {
  // `has_variants` is the authority: variant rows can outlive a cleared flag briefly.
  const hasVariants = rowHasVariants(row);
  const options = hasVariants ? derived.options : [];
  const variants = hasVariants ? derived.variants : [];
  const category: CatalogContextDto | null =
    row.category_slug === null || row.category_name === null
      ? null
      : { slug: row.category_slug, name: row.category_name, nameEn: row.category_name_en ?? null };

  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en ?? null,
    description: row.description ?? null,
    descriptionEn: row.description_en ?? null,
    material: row.material ?? null,
    materialEn: row.material_en ?? null,
    care: row.care ?? null,
    careEn: row.care_en ?? null,
    fit: row.fit ?? null,
    fitEn: row.fit_en ?? null,
    price: toNumber(row.price),
    isNew: row.is_new === true,
    inStock: hasVariants ? variants.some((v) => v.inStock) : toNumber(row.stock) > 0,
    images: productImages(row.image_url, galleryInOrder, origin, CATALOG_DETAIL_IMAGE_COUNT),
    category,
    collections: collections.map((c) => ({
      slug: c.slug,
      name: c.name,
      nameEn: c.name_en ?? null,
    })),
    options,
    variants,
  };
}

/** What the quote knows about one named public product. */
export interface QuoteProductContext {
  row: CatalogQuoteProductRow;
  hasVariants: boolean;
  options: CatalogOptionDto[];
  usable: UsableVariant[];
}

/** Money in the response: two decimals, so `1399.5 * 3` never ships as `4198.499999`. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The requested options' identity under the derivation's own normalization, or null when
 * the request cannot name one variant (a blank or repeated normalized key or value).
 */
export function requestedCombination(options: Readonly<Record<string, string>>): string | null {
  const entries: [string, string][] = [];
  const seen = new Set<string>();
  for (const [rawKey, rawValue] of Object.entries(options)) {
    if (typeof rawValue !== 'string') return null;
    const key = normalizeAttributeKey(rawKey);
    const value = normalizeAttributeValue(rawValue);
    if (!key || !value || seen.has(key)) return null;
    seen.add(key);
    entries.push([key, value]);
  }
  return combinationKey(entries);
}

function unavailableLine(
  line: CartQuoteRequestLine,
  index: number,
  status: Extract<CartQuoteLineStatus, 'variantUnavailable' | 'productUnavailable'>,
  product: CartQuoteLineDto['product']
): CartQuoteLineDto {
  return {
    index,
    slug: line.slug,
    status,
    product,
    options: [],
    unitPrice: null,
    requestedQuantity: line.quantity,
    quantity: 0,
    maxQuantity: 0,
    lineTotal: 0,
  };
}

/**
 * One quote line (plan 2026-09-15-001, *Quote contract*). Evaluated on its own against
 * `min(stock, MAX_LINE_QUANTITY)`: lines naming the same variant never share an allocation
 * (CD-7), so no response can reveal stock above the cap. Names every key it emits; `stock`
 * appears only as `maxQuantity`.
 */
export function toCartQuoteLineDto(
  line: CartQuoteRequestLine,
  index: number,
  product: QuoteProductContext | undefined,
  origin: string
): CartQuoteLineDto {
  if (product === undefined) return unavailableLine(line, index, 'productUnavailable', null);

  const url = absoluteMediaUrl(product.row.image_url, origin);
  const productDto = {
    slug: product.row.slug,
    name: product.row.name,
    nameEn: product.row.name_en ?? null,
    image: url ? { url } : null,
  };

  let unitPrice: number;
  let stock: number;
  let options: CartQuoteOptionDto[];

  if (!product.hasVariants) {
    if (Object.keys(line.options).length > 0) {
      return unavailableLine(line, index, 'variantUnavailable', productDto);
    }
    unitPrice = toNumber(product.row.price);
    stock = toNumber(product.row.stock);
    options = [];
  } else {
    const combination = requestedCombination(line.options);
    const variant =
      combination === null
        ? undefined
        : product.usable.find((candidate) => candidate.combination === combination);
    if (variant === undefined) {
      return unavailableLine(line, index, 'variantUnavailable', productDto);
    }
    unitPrice = variant.price;
    stock = variant.stock;
    options = product.options.map((option) => ({
      key: option.key,
      label: option.label,
      value: variant.selected[option.key],
    }));
  }

  const available = Math.max(0, Math.floor(stock));
  const maxQuantity = Math.min(available, MAX_LINE_QUANTITY);
  const quantity = Math.min(line.quantity, maxQuantity);
  const status: CartQuoteLineStatus =
    maxQuantity === 0 ? 'soldOut' : quantity < line.quantity ? 'reduced' : 'ok';

  return {
    index,
    slug: line.slug,
    status,
    product: productDto,
    options,
    unitPrice,
    requestedQuantity: line.quantity,
    quantity,
    maxQuantity,
    lineTotal: roundMoney(unitPrice * quantity),
  };
}

export function toCartQuoteDto(lines: CartQuoteLineDto[]): CartQuoteDto {
  return {
    lines,
    subtotal: roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    maxLineQuantity: MAX_LINE_QUANTITY,
  };
}
