import { useCallback, useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';

export function useListRouteState() {
  const navigate = useNavigate();
  const search = (useSearch({ strict: false }) as Record<string, unknown>) || {};

  const page = typeof search.page === 'number' ? search.page : 1;
  const pageSize = typeof search.pageSize === 'number' ? search.pageSize : 25;
  const update = useCallback(
    (changes: Record<string, unknown>, replace = false) => {
      navigate({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        search: (previous: any) => ({ ...(previous || {}), ...changes }),
        replace,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    },
    [navigate]
  );

  return { search, page, pageSize, update };
}

export function useLastPageRecovery(
  page: number,
  totalItems: number | undefined,
  totalPages: number | undefined,
  update: (changes: Record<string, unknown>, replace?: boolean) => unknown
) {
  useEffect(() => {
    if (totalItems === undefined || totalPages === undefined) return;
    const lastPage = totalItems === 0 ? 1 : Math.max(1, totalPages);
    if (page > lastPage) void update({ page: lastPage }, true);
  }, [page, totalItems, totalPages, update]);
}
