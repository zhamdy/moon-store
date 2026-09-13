import { describe, it, expect } from 'vitest';
import { ApiError } from './transport/types';
import { classifyFailure, FAILURE_REASON } from './offlineRetry';
import { RETRY_CEILING_MS } from './offlineRetry';

describe('classifyFailure - retryable', () => {
  it('treats a network failure as retryable', () => {
    // The exact shape http.ts produces when axios never reached the server:
    // no status, and the message deliberately blanked.
    expect(classifyFailure(new ApiError('', null))).toEqual({
      retryable: true,
      reason: FAILURE_REASON.network,
    });
  });

  it.each([500, 502, 503, 504])('treats a %i as retryable', (status) => {
    expect(classifyFailure(new ApiError('', status))).toEqual({
      retryable: true,
      reason: FAILURE_REASON.serverError,
    });
  });

  it('treats a 408 timeout as retryable', () => {
    expect(classifyFailure(new ApiError('', 408))).toMatchObject({ retryable: true });
  });

  it('treats a 429 as retryable, but not before the backoff ceiling', () => {
    // Retrying a rate limiter on the 1s base step is how a till earns a
    // longer ban, so this failure alone carries its own floor.
    expect(classifyFailure(new ApiError('', 429))).toEqual({
      retryable: true,
      reason: FAILURE_REASON.rateLimited,
      minDelayMs: RETRY_CEILING_MS,
    });
  });

  it('treats a 401 as retryable, since the transport may refresh the token', () => {
    expect(classifyFailure(new ApiError('', 401))).toMatchObject({ retryable: true });
  });

  it('treats an unresolved idempotency claim as retryable', () => {
    // The server's own message says "Please retry" -- nothing conflicts, a
    // concurrent twin just held the claim past the lock timeout.
    const error = new ApiError('still being processed', 409, 'CONFLICT', [
      { field: 'Idempotency-Key', code: 'IDEMPOTENCY_UNRESOLVED', message: 'Please retry.' },
    ]);
    expect(classifyFailure(error)).toEqual({
      retryable: true,
      reason: FAILURE_REASON.idempotencyUnresolved,
    });
  });
});

describe('classifyFailure - terminal', () => {
  it('parks a reused idempotency key', () => {
    // Same key, different payload. A replay is guaranteed to fail identically;
    // getting this backwards against IDEMPOTENCY_UNRESOLVED spins forever.
    const error = new ApiError('already used', 409, 'CONFLICT', [
      { field: 'Idempotency-Key', code: 'IDEMPOTENCY_KEY_REUSED', message: 'already used' },
    ]);
    expect(classifyFailure(error)).toEqual({
      retryable: false,
      reason: FAILURE_REASON.idempotencyKeyReused,
    });
  });

  it('parks a split-payment mismatch and names it as such', () => {
    const error = new ApiError('Split payment mismatch', 400, 'VALIDATION_ERROR', [
      { field: 'payments', code: 'SPLIT_PAYMENT_MISMATCH', message: 'stale split' },
    ]);
    expect(classifyFailure(error)).toEqual({
      retryable: false,
      reason: FAILURE_REASON.splitMismatch,
    });
  });

  it.each([400, 403, 404, 422])('parks a plain %i', (status) => {
    expect(classifyFailure(new ApiError('', status))).toEqual({
      retryable: false,
      reason: FAILURE_REASON.rejected,
    });
  });

  it('parks a 409 carrying no details, since the conflict is unknown', () => {
    expect(classifyFailure(new ApiError('', 409, 'CONFLICT'))).toEqual({
      retryable: false,
      reason: FAILURE_REASON.rejected,
    });
  });

  it.each([
    ['a plain Error', new Error('boom')],
    ['a thrown string', 'boom'],
    ['undefined', undefined],
  ])('parks %s, so a bug in the replay surfaces instead of retrying forever', (_label, thrown) => {
    expect(classifyFailure(thrown)).toEqual({
      retryable: false,
      reason: FAILURE_REASON.unexpected,
    });
  });
});
