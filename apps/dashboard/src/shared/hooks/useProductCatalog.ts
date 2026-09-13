import { useInfiniteQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Product } from '../types';
import type { TransportResult } from '../lib/transport/types';
import { useTransport } from '../lib/transport';

export function canonicalProductIds(ids: readonly number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))].sort((a, b) => a - b);
}

export function chunkProductIds(ids: readonly number[], size = 100): number[][] {
  const canonical = canonicalProductIds(ids);
  return Array.from({ length: Math.ceil(canonical.length / size) }, (_, index) =>
    canonical.slice(index * size, (index + 1) * size)
  );
}

/** Page size the catalogue query accepts; every key is scoped by it. */
export type ProductPageSize = 10 | 25 | 50 | 100;

interface ProductCatalogKeyParts {
  search?: string;
  categoryId?: number | null;
  pageSize?: ProductPageSize;
}

/**
 * The one place the catalogue query key is built. Both the query and the
 * offline fallback that reads its cache go through here, so a narrowed read
 * and the unnarrowed catalogue it falls back to can never drift apart.
 */
export function productCatalogQueryKey({
  search,
  categoryId,
  pageSize = 25,
}: ProductCatalogKeyParts = {}) {
  return [
    'products',
    { search: search?.trim() || undefined, categoryId: categoryId || undefined, pageSize },
  ] as const;
}

/**
 * The server's own filter, applied in the client (`server/src/modules/inventory/
 * products/repository.ts`: name/sku/barcode ILIKE, category equality, active only).
 * Used only to narrow an already-fetched catalogue when the narrowed fetch cannot
 * be made -- it is a fallback for a dead link, never a substitute for the query.
 */
export function filterCachedProducts(
  rows: readonly Product[],
  { search, categoryId }: { search?: string; categoryId?: number | null }
): Product[] {
  const needle = search?.trim().toLowerCase();
  return rows.filter((product) => {
    if (product.status !== 'active') return false;
    if (categoryId && product.category_id !== categoryId) return false;
    if (!needle) return true;
    return [product.name, product.sku, product.barcode].some((field) =>
      field?.toLowerCase().includes(needle)
    );
  });
}

export function mergeProductsById<T extends { id: number }>(...groups: readonly T[][]): T[] {
  const seen = new Set<number>();
  return groups.flat().filter((product) => !seen.has(product.id) && !!seen.add(product.id));
}

interface ProductSearchOptions {
  search?: string;
  categoryId?: number | null;
  enabled?: boolean;
  pageSize?: ProductPageSize;
  selectedIds?: readonly number[];
  staleTime?: number;
}

export function useProductCatalog({
  search,
  categoryId,
  enabled = true,
  pageSize = 25,
  selectedIds = [],
  staleTime = 30_000,
}: ProductSearchOptions = {}) {
  const transport = useTransport();
  const queryClient = useQueryClient();
  const normalizedSearch = search?.trim() || undefined;
  const query = useInfiniteQuery({
    queryKey: productCatalogQueryKey({ search: normalizedSearch, categoryId, pageSize }),
    initialPageParam: 1,
    enabled,
    staleTime,
    /**
     * Longer than the app-wide 15 minutes because the unnarrowed catalogue has no
     * observer while a search is active, and it is what `cachedFallback` below
     * reads when that search cannot reach the server. Collect it and a till that
     * loses its link mid-shift has nothing left to fall back to.
     */
    gcTime: 30 * 60_000,
    queryFn: ({ pageParam }) =>
      transport.request<Product[]>({
        method: 'GET',
        path: 'products',
        params: {
          page: pageParam,
          pageSize,
          search: normalizedSearch,
          categoryId: categoryId || undefined,
        },
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta?.pagination?.hasNextPage ? lastPage.meta.pagination.page + 1 : undefined,
  });
  const chunks = useMemo(() => chunkProductIds(selectedIds), [selectedIds]);
  const lookups = useQueries({
    queries: chunks.map((ids) => ({
      queryKey: ['products', 'lookup', ids],
      queryFn: () =>
        transport.request<Product[]>({
          method: 'GET',
          path: 'products/lookup',
          params: { ids: ids.join(',') },
        }),
      enabled,
      staleTime: 5 * 60_000,
    })),
  });
  const pageRows = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data]
  );

  /**
   * #114: a narrowed read (a search, a category) is a key React Query has never
   * seen, so offline it has no previous data and the grid renders nothing -- while
   * the whole catalogue sits in the cache one key away. When the narrowed fetch
   * fails with nothing to show, narrow the cached catalogue here instead.
   *
   * Only when the read cannot produce data, and only when it came back empty-handed:
   * while the link is up the server's answer stays authoritative, `staleTime: 0` and
   * all. The rows are as fresh as the last successful catalogue fetch, which is why
   * callers are told about it (`isServingCachedCatalogue`) rather than being handed
   * rows that look live.
   *
   * "Cannot produce data" is two states, not one. A rejected fetch is the obvious
   * one; the other is `fetchStatus === 'paused'`, which is where queries land when
   * `navigator.onLine` is false, because queries keep React Query's default
   * `networkMode: 'online'` (mutations do not -- see `queryClient.ts`). A paused
   * query never errors and never settles, so keying only on `isError` would leave
   * the till blank in exactly the case this exists for.
   */
  const isNarrowed = !!normalizedSearch || !!categoryId;
  const isUnreachable = query.isError || query.fetchStatus === 'paused';
  const cachedFallback = useMemo(() => {
    if (!enabled || !isNarrowed || !isUnreachable || query.data !== undefined) return undefined;
    const cached = queryClient.getQueryData<InfiniteData<TransportResult<Product[]>>>(
      productCatalogQueryKey({ pageSize })
    );
    if (!cached) return undefined;
    return filterCachedProducts(
      cached.pages.flatMap((page) => page.data),
      { search: normalizedSearch, categoryId }
    );
    // `getQueryData` is not reactive, but the only things that turn this on are
    // the query's own error and fetchStatus, both of which re-render.
  }, [
    enabled,
    isNarrowed,
    isUnreachable,
    query.data,
    queryClient,
    pageSize,
    normalizedSearch,
    categoryId,
  ]);

  const rows = cachedFallback ?? pageRows;
  const hydratedRows = lookups.flatMap((lookup) => lookup.data?.data ?? []);

  return {
    products: mergeProductsById(hydratedRows, rows),
    searchProducts: rows,
    /** True while `searchProducts` is a locally narrowed copy of an older catalogue. */
    isServingCachedCatalogue: cachedFallback !== undefined,
    /** The read cannot reach the server right now: it rejected, or it is paused offline. */
    isUnreachable,
    hydratedProducts: hydratedRows,
    isLoading: query.isLoading || lookups.some((lookup) => lookup.isLoading),
    isFetching: query.isFetching || lookups.some((lookup) => lookup.isFetching),
    error: query.error || lookups.find((lookup) => lookup.error)?.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: () => Promise.all([query.refetch(), ...lookups.map((lookup) => lookup.refetch())]),
  };
}
