/**
 * The transport seam: the one place that knows how to reach the server.
 *
 * Everything above this line (the `resource` module, and through it every page)
 * deals in rows and errors. Everything below it deals in HTTP. Callers never
 * see the response envelope, the API path prefix, or an AxiosError.
 */

export type TransportMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface TransportRequest {
  method: TransportMethod;
  /** Resource-relative path, e.g. `expenses` or `expenses/3/payouts`. No prefix. */
  path: string;
  params?: Record<string, unknown>;
  body?: unknown;
  /**
   * What the server sends back. A few endpoints stream a file rather than an
   * envelope — a database backup, an export — and those yield the `Blob`
   * itself. Encoding is the transport's business either way, so callers do not
   * reach past it to `fetch` and lose the token-refresh retry.
   */
  responseType?: 'json' | 'blob';
}

export interface TransportResult<T> {
  data: T;
  /** Pagination and aggregate figures the server returns alongside a list. */
  meta?: Record<string, unknown>;
}

export interface Transport {
  request<T>(req: TransportRequest): Promise<TransportResult<T>>;
}

/**
 * The single error shape every transport normalizes failures into, so callers
 * never branch on whether a failure came from HTTP, the network, or a fake.
 */
export class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
