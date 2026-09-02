import { describe, it, expect, beforeEach } from 'vitest';
import { ApiError } from './transport/types';
import {
  classifyMutationError,
  hasDetailCode,
  messageKeyFor,
  type MutationErrorKind,
} from './mutationError';
import { useSettingsStore } from '../store/settingsStore';
import en from '../i18n/en.json';
import ar from '../i18n/ar.json';

const ALL_KINDS: MutationErrorKind[] = [
  'validation',
  'conflict',
  'unauthorized',
  'forbidden',
  'notFound',
  'rateLimited',
  'offline',
  'network',
  'server',
  'unknown',
];

const messages = en as Record<string, string>;

// The app defaults to Arabic; pin a locale so the assertions below read as
// English rather than as whatever the last test left behind.
beforeEach(() => {
  useSettingsStore.setState({ locale: 'en' });
});

describe('classifyMutationError', () => {
  it.each([
    ['VALIDATION_ERROR', 400, 'validation', 'fix'],
    ['CONFLICT', 409, 'conflict', 'review'],
    ['UNAUTHORIZED', 401, 'unauthorized', 'signIn'],
    ['FORBIDDEN', 403, 'forbidden', 'none'],
    ['NOT_FOUND', 404, 'notFound', 'review'],
    ['RATE_LIMITED', 429, 'rateLimited', 'wait'],
  ] as const)('maps %s to the %s kind with a %s recovery', (code, status, kind, recovery) => {
    const failure = classifyMutationError(new ApiError('boom', status, code), true);

    expect(failure.kind).toBe(kind);
    expect(failure.recovery).toBe(recovery);
  });

  it('treats a 5xx as a retryable server failure whatever code rides on it', () => {
    const failure = classifyMutationError(new ApiError('Internal server error', 500), true);

    expect(failure.kind).toBe('server');
    expect(failure.retryable).toBe(true);
  });

  it('separates a request that never reached the server into offline vs network', () => {
    expect(classifyMutationError(new ApiError('', null), false).kind).toBe('offline');
    expect(classifyMutationError(new ApiError('', null), true).kind).toBe('network');
  });

  it('falls back to the HTTP status when the body carries no code', () => {
    expect(classifyMutationError(new ApiError('', 409), true).kind).toBe('conflict');
    expect(classifyMutationError(new ApiError('', 408), true).kind).toBe('network');
    expect(classifyMutationError(new ApiError('', 418), true).kind).toBe('unknown');
  });

  it('shows the server wording for a rejection the server phrased for a user', () => {
    const failure = classifyMutationError(
      new ApiError('Insufficient stock for product ID 7', 400, 'VALIDATION_ERROR'),
      true
    );

    expect(failure.message).toBe('Insufficient stock for product ID 7');
  });

  it('never shows the server wording for an authentication, rate-limit or 5xx failure', () => {
    const cases: [ApiError, MutationErrorKind][] = [
      [new ApiError('Invalid refresh token', 401, 'UNAUTHORIZED'), 'unauthorized'],
      [new ApiError('Too many requests', 429, 'RATE_LIMITED'), 'rateLimited'],
      [new ApiError('pg: relation "sales" does not exist', 500), 'server'],
    ];

    for (const [error, kind] of cases) {
      const failure = classifyMutationError(error, true);
      expect(failure.message).toBe(messages[messageKeyFor(kind)]);
      expect(failure.message).not.toBe(error.message);
    }
  });

  it('falls back to its own wording when the transport blanked the message', () => {
    // transport/http.ts deliberately drops axios's "Network Error".
    const failure = classifyMutationError(new ApiError('', null), true);

    expect(failure.message).toBe(messages['mutationError.network']);
  });

  it('pins validation details to the fields that caused them', () => {
    const failure = classifyMutationError(
      new ApiError('Request validation failed', 400, 'VALIDATION_ERROR', [
        { field: 'price', code: 'too_small', message: 'Value is too small' },
        { field: 'sku', code: 'invalid_type', message: 'Expected string' },
      ]),
      true
    );

    expect(failure.fieldErrors).toEqual({
      price: 'Value is too small',
      sku: 'Expected string',
    });
  });

  it('keeps the first message for a field reported twice', () => {
    const failure = classifyMutationError(
      new ApiError('nope', 400, 'VALIDATION_ERROR', [
        { field: 'price', code: 'too_small', message: 'outermost' },
        { field: 'price', code: 'invalid_type', message: 'innermost' },
      ]),
      true
    );

    expect(failure.fieldErrors.price).toBe('outermost');
  });

  it('leaves a detail with no field out of fieldErrors so it stays in the headline', () => {
    const failure = classifyMutationError(
      new ApiError('Payments do not balance', 400, 'VALIDATION_ERROR', [
        { field: '', code: 'SPLIT_PAYMENT_MISMATCH', message: 'Payments do not balance' },
      ]),
      true
    );

    expect(failure.fieldErrors).toEqual({});
    expect(failure.message).toBe('Payments do not balance');
    expect(hasDetailCode(failure, 'SPLIT_PAYMENT_MISMATCH')).toBe(true);
  });

  it('never attaches field errors to a non-validation failure', () => {
    const failure = classifyMutationError(
      new ApiError('conflict', 409, 'CONFLICT', [
        { field: 'code', code: 'IDEMPOTENCY_KEY_REUSED', message: 'reused' },
      ]),
      true
    );

    expect(failure.fieldErrors).toEqual({});
    // ...but the detail is still readable by a caller that knows the code.
    expect(hasDetailCode(failure, 'IDEMPOTENCY_KEY_REUSED')).toBe(true);
  });

  it('never leaks the message of a throw that did not come from the server', () => {
    const failure = classifyMutationError(new TypeError('cannot read property of undefined'));

    expect(failure.kind).toBe('unknown');
    expect(failure.message).toBe(messages['mutationError.unknown']);
    expect(failure.message).not.toContain('undefined');
  });

  it('classifies a non-Error throw rather than crashing on it', () => {
    expect(classifyMutationError('nope').kind).toBe('unknown');
    expect(classifyMutationError(null).kind).toBe('unknown');
  });
});

describe('the message for every kind', () => {
  it.each(ALL_KINDS)('is translated in both locales for %s', (kind) => {
    const key = messageKeyFor(kind);
    expect((en as Record<string, string>)[key]).toBeTruthy();
    expect((ar as Record<string, string>)[key]).toBeTruthy();
  });
});
