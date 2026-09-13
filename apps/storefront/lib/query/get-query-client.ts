import { QueryClient, isServer } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';

const MAX_QUERY_RETRIES = 2;

/**
 * Retries only failures a second attempt could plausibly fix: no response at all
 * (network, timeout) or a 5xx. A 4xx is a verdict on the request, and an
 * INVALID_RESPONSE means the server answered with something this client can't read —
 * repeating either just delays the error the user will see anyway.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  if (!isApiError(error)) return true;
  if (error.code === 'INVALID_RESPONSE') return false;
  return error.status === 0 || error.status >= 500;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: shouldRetryQuery,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client. Sharing one across requests would
    // leak one visitor's cached data into another's.
    return makeQueryClient();
  }

  // Browser: reuse a module-level singleton so navigation doesn't reset the cache.
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
