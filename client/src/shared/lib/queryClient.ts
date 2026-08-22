import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './transport/types';

export function normalizeQueryParams(
  params: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!params) return {};
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  return !(
    error instanceof ApiError &&
    error.status !== null &&
    error.status >= 400 &&
    error.status < 500
  );
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
  },
});
