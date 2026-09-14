import 'server-only';
import type { CatalogProductQuery } from '@/features/catalog/search-params';
import { CATALOG_LIST_TIMEOUT_MS, CATALOG_REVALIDATE, catalogFetch } from '@/lib/api/catalog';
import { CATALOG_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/errors';
import type {
  CatalogPagination,
  CatalogPriceRange,
  CatalogProduct,
  CatalogProductPage,
} from '../types/catalog-product';

/**
 * Maps the storefront query to the API grammar (KD-4). Values that filter nothing are
 * omitted, so equivalent listings share one data-cache entry. `sort` is always sent:
 * `toProductQuery` has already resolved the route default, and an explicit value keeps
 * the cache key independent of the API's own default.
 */
export function buildCatalogProductsPath(query: CatalogProductQuery): string {
  const search = new URLSearchParams();
  const { scope } = query;
  if (scope.kind === 'category') search.set('category', scope.slug);
  else if (scope.kind === 'collection') search.set('collection', scope.slug);
  else if (scope.kind === 'new') search.set('new', 'true');

  search.set('sort', query.sort);
  if (query.inStock) search.set('inStock', 'true');
  if (query.priceMin !== null) search.set('priceMin', String(query.priceMin));
  if (query.priceMax !== null) search.set('priceMax', String(query.priceMax));
  if (query.page !== 1) search.set('page', String(query.page));

  return `${CATALOG_ENDPOINTS.products}?${search.toString()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPagination(value: unknown): value is CatalogPagination {
  if (!isRecord(value)) return false;
  return (
    ['page', 'pageSize', 'totalItems', 'totalPages'].every(
      (key) => typeof value[key] === 'number'
    ) &&
    typeof value.hasNextPage === 'boolean' &&
    typeof value.hasPreviousPage === 'boolean'
  );
}

function isPriceBound(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isPriceRange(value: unknown): value is CatalogPriceRange {
  return isRecord(value) && isPriceBound(value.min) && isPriceBound(value.max);
}

function invalid(message: string): ApiError {
  return new ApiError({ status: 200, code: 'INVALID_RESPONSE', message });
}

// Pagination drives page links and the empty state, so a malformed meta would render a
// wrong page rather than fail. It is checked here instead of trusted.
export async function listCatalogProducts(query: CatalogProductQuery): Promise<CatalogProductPage> {
  const { data, meta } = await catalogFetch<CatalogProduct[]>(
    buildCatalogProductsPath(query),
    CATALOG_REVALIDATE.list,
    { timeoutMs: CATALOG_LIST_TIMEOUT_MS }
  );

  if (!Array.isArray(data)) throw invalid('The catalog product list was not an array.');
  if (!isPagination(meta?.pagination)) {
    throw invalid('The catalog product list was missing a valid meta.pagination.');
  }
  if (!isPriceRange(meta.priceRange)) {
    throw invalid('The catalog product list was missing a valid meta.priceRange.');
  }

  return { items: data, pagination: meta.pagination, priceRange: meta.priceRange };
}
