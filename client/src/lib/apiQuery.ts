import { useQuery } from '@tanstack/react-query';
import { useTransport } from './transport';

/**
 * A read that does not belong to a resource collection.
 *
 * Roughly fifteen percent of the API is not CRUD — analytics aggregates, AI
 * endpoints, report generation, export payloads. Those go through the same
 * transport as `resource`, so they get the envelope unwrapped and errors
 * normalized on the same terms, without `resource` growing a capability to
 * serve them. Widening `resource` until it covered these is exactly how a
 * small interface becomes a large one.
 */
export interface ApiQueryOptions {
  /** Hold the read until the tab or filter it belongs to is actually showing. */
  enabled?: boolean;
  /** How long the answer stays fresh, for reads too expensive to repeat. */
  staleTime?: number;
}

export function useApiQuery<T>(
  key: readonly unknown[],
  path: string,
  params?: Record<string, unknown>,
  { enabled = true, staleTime }: ApiQueryOptions = {}
) {
  const transport = useTransport();
  const query = useQuery({
    queryKey: key,
    queryFn: () => transport.request<T>({ method: 'GET', path, params }),
    enabled,
    staleTime,
  });

  return { ...query, data: query.data?.data, meta: query.data?.meta };
}
