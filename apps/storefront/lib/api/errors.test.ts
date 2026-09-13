import { describe, expect, it } from 'vitest';
import { ApiError, isApiError } from './errors';

describe('ApiError', () => {
  it('carries status, code, message, details and cause', () => {
    const details = [{ field: 'email', code: 'invalid_string', message: 'Invalid email' }];
    const cause = new Error('boom');
    const error = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details,
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Request validation failed');
    expect(error.details).toBe(details);
    expect(error.cause).toBe(cause);
  });

  it('defaults details and cause to undefined', () => {
    const error = new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'Boom' });

    expect(error.details).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });
});

describe('isApiError', () => {
  it('returns true for a thrown ApiError', () => {
    expect(isApiError(new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }))).toBe(
      true
    );
  });

  it('returns false for a plain Error', () => {
    expect(isApiError(new Error('x'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError('error')).toBe(false);
  });
});
