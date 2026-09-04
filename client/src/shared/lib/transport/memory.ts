import { isValidIdempotencyKey } from './idempotency';
import {
  ApiError,
  type Transport,
  type TransportRequest,
  type TransportResult,
  type ValidationDetail,
} from './types';

type Row = Record<string, unknown>;

/** Seed data, keyed by resource name. Plain objects of any declared shape. */
export type Collections = Record<string, readonly object[]>;

export interface MemoryTransport extends Transport {
  /** Current contents of a collection, for asserting on writes the UI made. */
  peek(name: string): Row[];
  /**
   * Every request received, in order. Params are recorded rather than applied:
   * filtering and pagination are the server's job, so a fake that invented its
   * own version of them would let tests pass against behaviour HTTP would not
   * reproduce. Assert on what was asked for instead.
   */
  calls(): TransportRequest[];
  /**
   * Idempotency keys seen so far, in order, for the requests that carried one.
   * Recorded separately from `calls()` so a test can assert on stability
   * across a retry without reconstructing which call was which.
   */
  idempotencyKeys(): string[];
  /**
   * Make a request fail, to exercise how callers handle errors. `code`/
   * `details` let a test simulate a structured server error such as the
   * sales endpoint's `SPLIT_PAYMENT_MISMATCH` validation detail.
   *
   * Without `matchPath`, the very NEXT request of any kind fails -- fine
   * when a test controls every request precisely. With `matchPath`, only a
   * request to that exact path is failed; anything else (a background
   * settings/customer read a component issues incidentally) passes through
   * untouched and the pending failure keeps waiting for its match. Prefer
   * `matchPath` whenever the component under test can plausibly issue more
   * than one request before the one under test.
   */
  /**
   * Fail the next matching request. `status: null` is the failure a real transport
   * produces when no response arrives at all -- an offline till, a captive portal, a
   * server that is down -- which `classifyMutationError` reads as `offline`/`network`
   * and the checkout reads as "queue this sale". A fake that could only express a
   * status code could not reproduce the one case the offline queue exists for.
   */
  failNext(
    message: string,
    status?: number | null,
    code?: string,
    details?: ValidationDetail[],
    matchPath?: string
  ): void;
}

interface MemoryOptions {
  /** Extra figures returned alongside a list, e.g. `{ total_amount: 6200 }`. */
  meta?: Record<string, Record<string, unknown>>;
  /** Canned responses for named sub-paths, keyed by full path, e.g. `expenses/pnl`. */
  reads?: Record<string, unknown>;
}

/**
 * An in-memory stand-in for the real server, satisfying the same Transport
 * interface. Lets pages and the `resource` module be driven in tests without
 * stubbing axios or standing up a request mocking layer.
 */
export function createMemoryTransport(
  collections: Collections = {},
  options: MemoryOptions = {}
): MemoryTransport {
  const store: Record<string, Row[]> = Object.fromEntries(
    Object.entries(collections).map(([name, rows]) => [
      name,
      rows.map((row) => ({ ...row }) as Row),
    ])
  );

  const nextId = (rows: Row[]): number =>
    rows.reduce((highest, row) => Math.max(highest, Number(row.id) || 0), 0) + 1;

  const collection = (name: string): Row[] => {
    if (!store[name]) store[name] = [];
    return store[name];
  };

  let pendingFailure: { error: ApiError; matchPath?: string } | null = null;
  const received: TransportRequest[] = [];

  return {
    peek: (name) => collection(name).map((row) => ({ ...row })),

    calls: () => received.map((call) => ({ ...call })),

    idempotencyKeys: () =>
      received.map((call) => call.idempotencyKey).filter((key): key is string => key !== undefined),

    failNext: (message, status = 400, code, details, matchPath) => {
      pendingFailure = { error: new ApiError(message, status, code, details), matchPath };
    },

    async request<T>(req: TransportRequest): Promise<TransportResult<T>> {
      received.push(req);
      const { method, path, body, idempotencyKey } = req;

      // The server rejects a malformed key with a 400 before doing any work.
      // Reproducing that here means a test exercising the offline/retry paths
      // fails on a key the real endpoint would refuse, rather than passing
      // against a fake that accepts anything.
      if (idempotencyKey !== undefined && !isValidIdempotencyKey(idempotencyKey)) {
        throw new ApiError('Invalid Idempotency-Key', 400, 'VALIDATION_ERROR');
      }

      if (pendingFailure && (!pendingFailure.matchPath || pendingFailure.matchPath === path)) {
        const failure = pendingFailure.error;
        pendingFailure = null;
        throw failure;
      }

      if (method === 'GET' && options.reads && path in options.reads) {
        return { data: options.reads[path] as T };
      }

      const [name, id, action] = path.split('/');
      const rows = collection(name);

      if (method === 'GET' && id === undefined) {
        return { data: rows.map((row) => ({ ...row })) as T, meta: options.meta?.[name] };
      }

      if (method === 'POST' && id === undefined) {
        const created = { ...(body as Row), id: nextId(rows) };
        rows.push(created);
        return { data: { ...created } as T };
      }

      const index = rows.findIndex((row) => String(row.id) === id);
      if (id !== undefined && index === -1) {
        throw new ApiError(`No ${name} with id ${id}`, 404);
      }

      if (method === 'GET') {
        return { data: { ...rows[index] } as T };
      }

      if (method === 'POST' && action) {
        rows[index] = { ...rows[index], ...(body as Row) };
        return { data: { ...rows[index] } as T };
      }

      if (method === 'PUT') {
        rows[index] = { ...rows[index], ...(body as Row) };
        return { data: { ...rows[index] } as T };
      }

      if (method === 'DELETE') {
        rows.splice(index, 1);
        return { data: undefined as T };
      }

      throw new ApiError(`Unsupported request in memory transport: ${method} ${path}`, null);
    },
  };
}
