import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { shouldRetryQuery } from './get-query-client';

function apiError(status: number, code: string) {
  return new ApiError({ status, code, message: code });
}

describe('shouldRetryQuery', () => {
  it.each([
    ['NETWORK_ERROR', apiError(0, 'NETWORK_ERROR')],
    ['TIMEOUT', apiError(0, 'TIMEOUT')],
    ['a 500', apiError(500, 'INTERNAL_ERROR')],
    ['a 503', apiError(503, 'SERVICE_UNAVAILABLE')],
    ['a non-ApiError', new Error('boom')],
  ])('retries %s while under the limit', (_, error) => {
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(true);
  });

  it.each([
    ['a 400', apiError(400, 'VALIDATION_ERROR')],
    ['a 401', apiError(401, 'UNAUTHORIZED')],
    ['a 404', apiError(404, 'NOT_FOUND')],
    ['a 429', apiError(429, 'RATE_LIMITED')],
    ['INVALID_RESPONSE on a 502', apiError(502, 'INVALID_RESPONSE')],
    ['INVALID_RESPONSE on a 200', apiError(200, 'INVALID_RESPONSE')],
  ])('does not retry %s', (_, error) => {
    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it('stops after two retries, even for a retryable error', () => {
    expect(shouldRetryQuery(2, apiError(0, 'NETWORK_ERROR'))).toBe(false);
    expect(shouldRetryQuery(2, new Error('boom'))).toBe(false);
  });
});
