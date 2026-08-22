import { describe, expect, it } from 'vitest';
import { ApiError } from './transport/types';
import { shouldRetryQuery } from './queryClient';

describe('query retry policy', () => {
  it.each([400, 401, 403, 404])('does not retry HTTP %s', (status) => {
    expect(shouldRetryQuery(0, new ApiError('request failed', status))).toBe(false);
  });

  it('allows one retry for network and 5xx failures', () => {
    expect(shouldRetryQuery(0, new ApiError('', null))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError('', 500))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError('', 500))).toBe(false);
  });
});
