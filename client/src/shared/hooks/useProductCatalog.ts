import { useInfiniteQuery, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Product } from '../types';
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

export function mergeProductsById<T extends { id: number }>(...groups: readonly T[][]): T[] {
  const seen = new Set<number>();
  return groups.flat().filter((product) => !seen.has(product.id) && !!seen.add(product.id));
}

interface ProductSearchOptions {
  search?: string;
  categoryId?: number | null;
  enabled?: boolean;
  pageSize?: 10 | 25 | 50 | 100;
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
  const normalizedSearch = search?.trim() || undefined;
  const query = useInfiniteQuery({
    queryKey: [
      'products',
      { search: normalizedSearch, categoryId: categoryId || undefined, pageSize },
    ],
    initialPageParam: 1,
    enabled,
    staleTime,
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
  const pageRows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const hydratedRows = lookups.flatMap((lookup) => lookup.data?.data ?? []);

  return {
    products: mergeProductsById(hydratedRows, pageRows),
    searchProducts: pageRows,
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
