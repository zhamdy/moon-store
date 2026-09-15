import {
  createLoader,
  createParser,
  createSerializer,
  parseAsStringLiteral,
  type inferParserType,
} from 'nuqs/server';
import { toAsciiDigits } from '@/lib/utils/ascii-digits';

// `nuqs/server` carries no 'use client' directive, so this module is importable from
// Server Components (loader, serializer) and from the controls island (parsers for
// useQueryStates) alike. Keep it free of server-only and client-only imports.

export const CATALOG_SORTS = ['newest', 'price-asc', 'price-desc', 'curated'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** Matches the API's page bound (KD-4); anything above parses to page 1. */
export const CATALOG_MAX_PAGE = 500;
/** Price bounds are whole EGP in steps of 50 (KD-4, KD-11). */
export const CATALOG_PRICE_STEP = 50;
/**
 * The API's price ceiling, twin of `CATALOG_PRICE_MAX` in
 * `apps/server/src/modules/commerce/catalog/schemas.ts`. A bound above it is a 400 there,
 * which would loop the error boundary's retry while the value stays in the URL, so the
 * parser drops it (KD-11). Checked both as typed and after snapping: `min=10000001` is
 * dropped even though it would snap down to the ceiling, and a max that snaps up past it
 * is dropped too.
 */
export const CATALOG_PRICE_MAX = 10_000_000;

export type CatalogRoute =
  | { kind: 'all' }
  | { kind: 'category'; slug: string }
  | { kind: 'collection'; slug: string }
  | { kind: 'new' };

// Thousands separators and grouping spaces: comma, Arabic thousands separator,
// Arabic comma, space, no-break space, narrow no-break space.
const GROUPING = /[,\u066c\u060c \u00a0\u202f]/g;

/** Digits normalised to ASCII and grouping removed; `null` unless a plain integer remains. */
export function normalizeDigits(raw: string): string | null {
  const ascii = toAsciiDigits(raw.trim()).replace(GROUPING, '');
  // Nine digits keeps every value a safe integer and far above any real price.
  return /^\d{1,9}$/.test(ascii) ? ascii : null;
}

const parseAsPage = createParser<number>({
  parse: (raw) => {
    const digits = normalizeDigits(raw);
    if (digits === null) return null;
    const page = Number(digits);
    return page >= 1 && page <= CATALOG_MAX_PAGE ? page : null;
  },
  serialize: String,
});

function createPriceParser(snap: (value: number) => number) {
  return createParser<number>({
    parse: (raw) => {
      const digits = normalizeDigits(raw);
      if (digits === null) return null;
      const typed = Number(digits);
      const snapped = snap(typed);
      return Math.max(typed, snapped) <= CATALOG_PRICE_MAX ? snapped : null;
    },
    serialize: String,
  });
}

/**
 * The one parser map. Sort has no parser-level default because the default depends
 * on the route (`curated` on a collection, `newest` elsewhere): `null` means "the
 * route default", and `normalizeCatalogParams` never leaves the route default spelled
 * out. Page defaults to 1 and clears from the URL on default.
 */
export const catalogParsers = {
  sort: parseAsStringLiteral(CATALOG_SORTS),
  stock: parseAsStringLiteral(['in'] as const),
  min: createPriceParser((n) => Math.floor(n / CATALOG_PRICE_STEP) * CATALOG_PRICE_STEP),
  max: createPriceParser((n) => Math.ceil(n / CATALOG_PRICE_STEP) * CATALOG_PRICE_STEP),
  page: parseAsPage.withDefault(1),
};

export type CatalogParams = inferParserType<typeof catalogParsers>;

export const DEFAULT_CATALOG_PARAMS: CatalogParams = {
  sort: null,
  stock: null,
  min: null,
  max: null,
  page: 1,
};

export function defaultSortFor(route: CatalogRoute): CatalogSort {
  return route.kind === 'collection' ? 'curated' : 'newest';
}

/**
 * Route-aware normalisation the parsers cannot do on their own: `curated` outside a
 * collection and a spelled-out route default both become `null`, a zero `min` (which
 * filters nothing) is dropped, and `min > max` is swapped.
 */
export function normalizeCatalogParams(params: CatalogParams, route: CatalogRoute): CatalogParams {
  let sort = params.sort;
  if (sort === 'curated' && route.kind !== 'collection') sort = null;
  if (sort === defaultSortFor(route)) sort = null;

  let min = params.min === 0 ? null : params.min;
  let max = params.max;
  if (min !== null && max !== null && min > max) {
    [min, max] = [max, min];
    if (min === 0) min = null;
  }

  return { sort, stock: params.stock, min, max, page: params.page };
}

type SearchParamsRecord = Record<string, string | string[] | undefined>;
export type CatalogSearchParamsInput = SearchParamsRecord | URLSearchParams | string;

const nuqsLoader = createLoader(catalogParsers);

function toSearchParams(input: CatalogSearchParamsInput): URLSearchParams {
  if (typeof input === 'string' || input instanceof URLSearchParams) {
    return new URLSearchParams(input);
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, item);
  }
  return search;
}

// nuqs reads only the first occurrence of a repeated key; a repeated param instead
// resolves to its first *valid* value, so `?sort=best&sort=price-asc` still sorts.
function firstValidValues(search: URLSearchParams): URLSearchParams {
  const picked = new URLSearchParams();
  for (const [key, parser] of Object.entries(catalogParsers)) {
    const valid = search.getAll(key).find((value) => {
      try {
        return parser.parse(value) !== null;
      } catch {
        return false;
      }
    });
    if (valid !== undefined) picked.set(key, valid);
  }
  return picked;
}

function loadSync(input: CatalogSearchParamsInput, route: CatalogRoute): CatalogParams {
  return normalizeCatalogParams(nuqsLoader(firstValidValues(toSearchParams(input))), route);
}

/**
 * Parse a page's `searchParams` (Next's Promise, or a plain object, `URLSearchParams`
 * or query string). Never throws: malformed values fall back to defaults (R13).
 */
export function loadCatalogParams(
  input: CatalogSearchParamsInput,
  route: CatalogRoute
): CatalogParams;
export function loadCatalogParams(
  input: Promise<CatalogSearchParamsInput>,
  route: CatalogRoute
): Promise<CatalogParams>;
export function loadCatalogParams(
  input: CatalogSearchParamsInput | Promise<CatalogSearchParamsInput>,
  route: CatalogRoute
): CatalogParams | Promise<CatalogParams> {
  if (input instanceof Promise) return input.then((resolved) => loadSync(resolved, route));
  return loadSync(input, route);
}

/** Apply a change; anything other than a page-only change resets to page 1 (KD-11). */
export function nextCatalogParams(
  current: CatalogParams,
  patch: Partial<CatalogParams>
): CatalogParams {
  const touchesOtherThanPage = (Object.keys(patch) as (keyof CatalogParams)[]).some(
    (key) => key !== 'page' && patch[key] !== current[key]
  );
  return {
    ...current,
    ...patch,
    page: touchesOtherThanPage ? 1 : (patch.page ?? current.page),
  };
}

const nuqsSerializer = createSerializer(catalogParsers, { clearOnDefault: true });

/** `?sort=...&page=2`, or `''` when every value is its default. */
export function serializeCatalogParams(
  params: Partial<CatalogParams>,
  route: CatalogRoute
): string {
  const normalized = normalizeCatalogParams({ ...DEFAULT_CATALOG_PARAMS, ...params }, route);
  return nuqsSerializer(normalized);
}

/** The storefront's listing query; `lib/api` maps it to the API grammar (KD-4). */
export type CatalogProductQuery = {
  scope: CatalogRoute;
  sort: CatalogSort;
  inStock: boolean;
  priceMin: number | null;
  priceMax: number | null;
  page: number;
};

export function toProductQuery(params: CatalogParams, route: CatalogRoute): CatalogProductQuery {
  const normalized = normalizeCatalogParams(params, route);
  return {
    scope: route,
    sort: normalized.sort ?? defaultSortFor(route),
    inStock: normalized.stock === 'in',
    priceMin: normalized.min,
    priceMax: normalized.max,
    page: normalized.page,
  };
}

/** True when the URL narrows or reorders the listing: such pages are `noindex` (R19). */
export function hasNonDefaultRefinements(
  params: Pick<CatalogParams, 'sort' | 'stock' | 'min' | 'max'>
): boolean {
  return (
    params.sort !== null || params.stock !== null || params.min !== null || params.max !== null
  );
}
