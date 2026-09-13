import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useTransport,
  type TransportMethod,
  type TransportRequest,
  type TransportResult,
} from './transport/index';
import type { MutationFailure } from './mutationError';
import { useGuardedMutation } from './useGuardedMutation';
import { normalizeQueryParams } from './queryClient';

/** A record being saved. An `id` means update; its absence means create. */
export type Draft = Record<string, unknown> & { id?: number | null };

export interface WriteOptions {
  /** Runs after the write lands, e.g. to close a dialog. */
  onDone?: () => void;
  /** Toasted on success. Omit for a silent write. */
  message?: string;
  /** Toasted on failure when the server offers no message of its own. */
  fallbackMessage?: string;
  /**
   * Sees the classified failure before the toast. Return `true` when the page
   * has presented it another way (field errors on the form, an inline notice)
   * and the toast should be suppressed.
   */
  onFailure?: (failure: MutationFailure) => boolean | void;
}

export interface ActionOptions extends WriteOptions {
  /** The verb this sub-action is served by. Defaults to POST. */
  method?: TransportMethod;
}

/**
 * What every write does once it settles: refresh this resource's reads, tell
 * the caller, and say something. Pages get all three without wiring any of it.
 *
 * Every write also inherits the app's mutation contract from
 * `useGuardedMutation`: a second submit while one is in flight is dropped, and
 * the failure is classified into a kind and a recovery rather than being
 * flattened to whatever string the throw happened to carry. That is why this
 * indirection exists rather than each page wiring `useMutation` itself — a
 * page that forgets to disable its button no longer double-writes.
 */
function useWrite<Args>(
  key: readonly unknown[],
  toRequest: (args: Args) => TransportRequest,
  { onDone, message, fallbackMessage, onFailure }: WriteOptions
) {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useGuardedMutation<Args, TransportResult<unknown>>({
    mutationFn: (args: Args) => transport.request(toRequest(args)),
    successMessage: message,
    fallbackMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      onDone?.();
    },
    onFailure: (failure) => {
      // A conflict means the world moved under the request, and `mutationError` already
      // names the recovery for it: *review* — refresh what it depended on, then let the
      // user look before resubmitting. Refreshing here rather than at each call site is
      // the same reasoning as invalidating on success: what to invalidate is this
      // module's knowledge, and a page that forgets it strands the user resubmitting a
      // request that cannot start succeeding (an optimistic-concurrency token the page
      // never re-reads is refused forever). Nothing auto-retries; this only makes the
      // screen honest about what is now there.
      if (failure.kind === 'conflict') {
        queryClient.invalidateQueries({ queryKey: key });
      }
      return onFailure?.(failure);
    },
  });
}

/**
 * A resource is one server collection, exposed to pages as a small set of hooks.
 *
 * Callers name the collection once and get reads and writes back. They never
 * construct a URL, unwrap a response envelope, learn the error shape, or decide
 * what to invalidate — that knowledge lives here, once, instead of at every
 * call site.
 *
 * `Meta` types the aggregate figures the server sends beside a list, so pages
 * read them without casting.
 */
export function resource<Row, Meta = Record<string, unknown>>(name: string) {
  const all = [name] as const;

  return {
    useList(params?: Record<string, unknown>) {
      const transport = useTransport();
      const normalizedParams = normalizeQueryParams(params);
      const query = useQuery({
        queryKey: [name, 'list', normalizedParams] as const,
        queryFn: () =>
          transport.request<Row[]>({ method: 'GET', path: name, params: normalizedParams }),
        placeholderData: keepPreviousData,
      });

      return {
        ...query,
        data: query.data?.data,
        meta: query.data?.meta as Meta | undefined,
      };
    },

    useOne(id: number | null | undefined) {
      const transport = useTransport();
      const query = useQuery({
        queryKey: [name, 'one', id] as const,
        queryFn: () => transport.request<Row>({ method: 'GET', path: `${name}/${id}` }),
        enabled: id !== null && id !== undefined,
      });

      return { ...query, data: query.data?.data };
    },

    /**
     * A named read hanging off the collection rather than a record, e.g.
     * `useRead('pnl')` for `expenses/pnl`. Returns whatever that endpoint
     * yields, which is rarely the resource's own row type.
     */
    useRead<R, ReadMeta = Record<string, unknown>>(
      segment: string,
      params?: Record<string, unknown>,
      enabled = true
    ) {
      const transport = useTransport();
      const normalizedParams = normalizeQueryParams(params);
      const query = useQuery({
        queryKey: [name, 'read', segment, normalizedParams] as const,
        queryFn: () =>
          transport.request<R>({
            method: 'GET',
            path: `${name}/${segment}`,
            params: normalizedParams,
          }),
        enabled,
      });

      return {
        ...query,
        data: query.data?.data,
        meta: query.data?.meta as ReadMeta | undefined,
      };
    },

    useSave(options: WriteOptions = {}) {
      const mutation = useWrite<Draft>(
        all,
        ({ id, ...values }) =>
          id
            ? { method: 'PUT', path: `${name}/${id}`, body: values }
            : { method: 'POST', path: name, body: values },
        options
      );

      return { ...mutation, save: mutation.submit, isSaving: mutation.isPending };
    },

    useRemove(options: WriteOptions = {}) {
      const mutation = useWrite<number>(
        all,
        (id) => ({ method: 'DELETE', path: `${name}/${id}` }),
        options
      );

      return { ...mutation, remove: mutation.submit, isRemoving: mutation.isPending };
    },

    /**
     * A named sub-action on one record, e.g. `useAction('status', { method: 'PUT' })`
     * for `vendors/7/status`. The record is named per call rather than bound
     * here, so one hook serves every row in a list.
     *
     * The verb is part of the action: the same page can carry a PUT status
     * change beside a POST payout, and the server decides which is which.
     */
    useAction(action: string, { method = 'POST', ...options }: ActionOptions = {}) {
      const mutation = useWrite<{ id: number; body?: unknown }>(
        all,
        ({ id, body }) => ({ method, path: `${name}/${id}/${action}`, body }),
        options
      );

      return { ...mutation, run: mutation.submit, isRunning: mutation.isPending };
    },
  };
}
