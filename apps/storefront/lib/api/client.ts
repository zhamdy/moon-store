import { API_PREFIX } from './endpoints';
import { ApiError, type ApiErrorDetail } from './errors';

const DEV_FALLBACK = 'http://localhost:3001';

function isServer(): boolean {
  return typeof window === 'undefined';
}

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Resolves at call time, not module load: `API_URL` is server-only and read at
 * runtime so one build can be promoted across environments; `NEXT_PUBLIC_API_URL`
 * is inlined into the browser bundle at build time. A production server with no
 * `API_URL` throws — an app that doesn't know where its API is shouldn't silently
 * call itself. A production browser with no `NEXT_PUBLIC_API_URL` degrades to
 * same-origin with a loud console error instead, mirroring
 * apps/dashboard/src/shared/lib/apiBase.ts: taking the page down over a bad base
 * URL is worse than a request that fails visibly.
 */
export function resolveApiBaseUrl(): string {
  if (isServer()) {
    const configured = process.env.API_URL;
    if (configured) return stripTrailingSlashes(configured);

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'API_URL was not set. Server-side requests read it at runtime — set it in the ' +
          'deploy environment.'
      );
    }

    return DEV_FALLBACK;
  }

  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return stripTrailingSlashes(configured);

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[config] NEXT_PUBLIC_API_URL was not set when this bundle was built, so the app ' +
        'does not know where its API is. Set it in the deploy environment and rebuild — ' +
        'it is inlined at build time and cannot be changed after the fact. Falling back ' +
        'to this origin, which will not serve the API.'
    );
    return '';
  }

  return DEV_FALLBACK;
}

interface SuccessBody<T> {
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorBody {
  error: { code: string; message: string; details?: ApiErrorDetail[] };
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

function isSuccessBody<T>(value: unknown): value is SuccessBody<T> {
  return typeof value === 'object' && value !== null && 'data' in value;
}

export interface ApiFetchOptions {
  method?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
}

export interface ApiFetchResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<ApiFetchResult<T>> {
  const base = resolveApiBaseUrl();
  const url = `${base}${API_PREFIX}${path}`;

  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body,
      credentials: options.credentials ?? 'omit',
      signal: options.signal,
      cache: options.cache,
      next: options.next,
    });
  } catch (cause) {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'The network request failed.',
      cause,
    });
  }

  if (response.status === 204) {
    return { data: undefined as T };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: 'The response body was not valid JSON.',
    });
  }

  if (!response.ok) {
    if (isErrorBody(payload)) {
      throw new ApiError({
        status: response.status,
        code: payload.error.code,
        message: payload.error.message,
        details: payload.error.details,
      });
    }
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: 'The error response did not match the expected shape.',
    });
  }

  if (!isSuccessBody<T>(payload)) {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: 'The response was missing a data field.',
    });
  }

  return { data: payload.data, meta: payload.meta };
}
