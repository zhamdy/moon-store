import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { t } from '../i18n/index';
import { useTransport, type TransportMethod, type TransportRequest } from './transport/index';

/** A record being saved. An `id` means update; its absence means create. */
export type Draft = Record<string, unknown> & { id?: number | null };

export interface WriteOptions {
  /** Runs after the write lands, e.g. to close a dialog. */
  onDone?: () => void;
  /** Toasted on success. Omit for a silent write. */
  message?: string;
  /** Toasted on failure when the server offers no message of its own. */
  fallbackMessage?: string;
}

export interface ActionOptions extends WriteOptions {
  /** The verb this sub-action is served by. Defaults to POST. */
  method?: TransportMethod;
}

/**
 * What every write does once it settles: refresh this resource's reads, tell
 * the caller, and say something. Pages get all three without wiring any of it.
 */
function useWrite<Args>(
  key: readonly unknown[],
  toRequest: (args: Args) => TransportRequest,
  { onDone, message, fallbackMessage }: WriteOptions
) {
  const transport = useTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: Args) => transport.request(toRequest(args)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      if (message) toast.success(message);
      onDone?.();
    },
    onError: (error: Error) => {
      // Empty when the failure was the transport's own (a dropped connection,
      // a timeout). Callers get to phrase those; axios's wording never shows.
      toast.error(error.message || fallbackMessage || t('common.error'));
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
      const query = useQuery({
        queryKey: [name, 'list', params ?? {}] as const,
        queryFn: () => transport.request<Row[]>({ method: 'GET', path: name, params }),
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
    useRead<R>(segment: string, params?: Record<string, unknown>, enabled = true) {
      const transport = useTransport();
      const query = useQuery({
        queryKey: [name, 'read', segment, params ?? {}] as const,
        queryFn: () => transport.request<R>({ method: 'GET', path: `${name}/${segment}`, params }),
        enabled,
      });

      return { ...query, data: query.data?.data };
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

      return { ...mutation, save: mutation.mutate, isSaving: mutation.isPending };
    },

    useRemove(options: WriteOptions = {}) {
      const mutation = useWrite<number>(
        all,
        (id) => ({ method: 'DELETE', path: `${name}/${id}` }),
        options
      );

      return { ...mutation, remove: mutation.mutate, isRemoving: mutation.isPending };
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

      return { ...mutation, run: mutation.mutate, isRunning: mutation.isPending };
    },
  };
}
