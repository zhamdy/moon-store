/**
 * Mirrors apps/server/src/http/errors.ts's PublicErrorCode. Duplicated rather than
 * imported — the storefront never imports server source — plus the three client-only
 * codes for failures the server never produces. Kept as a string fallback (not a
 * closed union) so a new server code widens what a caller can read, not what the
 * type system rejects.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | (string & {});

export interface ApiErrorDetail {
  field: string;
  code: string;
  message: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface ApiErrorOptions {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetail[];
  cause?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: ApiErrorDetail[];

  constructor({ status, code, message, details, cause }: ApiErrorOptions) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
