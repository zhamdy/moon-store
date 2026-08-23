import { ZodError } from 'zod';

export type PublicErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ValidationDetail {
  field: string;
  code: string;
  message: string;
}

export interface ErrorBody {
  error: { code: PublicErrorCode; message: string; details?: ValidationDetail[] };
}

const defaults: Record<PublicErrorCode, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 400, message: 'Request validation failed' },
  UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  FORBIDDEN: { status: 403, message: 'Insufficient permissions' },
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  CONFLICT: { status: 409, message: 'Request conflicts with current state' },
  RATE_LIMITED: { status: 429, message: 'Too many requests' },
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
};

export class PublicError extends Error {
  constructor(
    public readonly code: PublicErrorCode,
    message = defaults[code].message,
    public readonly details?: ValidationDetail[]
  ) {
    super(message);
    this.name = 'PublicError';
  }
}

function bounded(value: string, max: number): string {
  return value.replace(/[\r\n\t]/g, ' ').slice(0, max);
}

function validationMessage(code: string, message: string): string {
  switch (code) {
    case 'invalid_type':
    case 'invalid_string':
      return bounded(message, 300);
    case 'too_small':
      return 'Value is too small';
    case 'too_big':
      return 'Value is too large';
    case 'unrecognized_keys':
      return 'Unknown field';
    case 'invalid_enum_value':
    case 'invalid_literal':
      return 'Invalid option';
    default:
      return 'Invalid value';
  }
}

function zodDetails(error: ZodError): ValidationDetail[] {
  return error.issues.slice(0, 50).map((issue) => ({
    field: bounded(issue.path.map(String).join('.'), 200),
    code: bounded(issue.code, 50),
    message: validationMessage(issue.code, issue.message),
  }));
}

export function errorResponse(
  code: PublicErrorCode,
  message?: string,
  details?: ValidationDetail[]
): ErrorBody {
  const error = {
    code,
    message: bounded(message ?? defaults[code].message, 300),
    ...(details ? { details } : {}),
  };
  return { error };
}

export function mapPublicError(error: unknown): {
  status: number;
  body: ErrorBody;
  diagnostic: Record<string, unknown>;
} {
  if (error instanceof ZodError) {
    const details = zodDetails(error);
    return {
      status: 400,
      body: errorResponse('VALIDATION_ERROR', undefined, details),
      diagnostic: { errorType: 'ZodError', issueCodes: details.map((detail) => detail.code) },
    };
  }

  if (error instanceof PublicError) {
    const definition = defaults[error.code];
    return {
      status: definition.status,
      body: errorResponse(error.code, error.message, error.details),
      diagnostic: { errorType: 'PublicError', code: error.code, status: definition.status },
    };
  }

  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : 500;
  const code =
    statusCode === 401
      ? 'UNAUTHORIZED'
      : statusCode === 403
        ? 'FORBIDDEN'
        : statusCode === 404
          ? 'NOT_FOUND'
          : statusCode === 409
            ? 'CONFLICT'
            : statusCode === 429
              ? 'RATE_LIMITED'
              : 'INTERNAL_ERROR';
  const definition = defaults[code];
  return {
    status: definition.status,
    body: errorResponse(code),
    diagnostic: {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      code,
      status: definition.status,
    },
  };
}
