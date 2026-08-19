import { ApiError, type Transport, type TransportRequest, type TransportResult } from './types';

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
  /** Make the next request fail, to exercise how callers handle errors. */
  failNext(message: string, status?: number): void;
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

  let pendingFailure: ApiError | null = null;
  const received: TransportRequest[] = [];

  return {
    peek: (name) => collection(name).map((row) => ({ ...row })),

    calls: () => received.map((call) => ({ ...call })),

    failNext: (message, status = 400) => {
      pendingFailure = new ApiError(message, status);
    },

    async request<T>(req: TransportRequest): Promise<TransportResult<T>> {
      received.push(req);
      const { method, path, body } = req;

      if (pendingFailure) {
        const failure = pendingFailure;
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
        const [removed] = rows.splice(index, 1);
        return { data: { ...removed } as T };
      }

      throw new ApiError(`Unsupported request in memory transport: ${method} ${path}`, null);
    },
  };
}
