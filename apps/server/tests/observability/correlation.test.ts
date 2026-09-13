/**
 * Correlation ids — the acceptance criterion is "a request can be traced through logs
 * using one correlation id", which has three parts: the id exists, the client is told
 * what it is, and *every* log line the request produces carries it, including lines
 * emitted deep inside a service with no access to `req`.
 *
 * The trust decision is pinned here too: an inbound id is recorded, never adopted. A
 * caller that could choose its own id could collide with another request's, or reuse one
 * across thousands of requests to make its traffic unsearchable.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  correlationMiddleware,
  currentContext,
  type RequestContext,
  runWithContext,
  sanitizeInboundRequestId,
} from '../../src/observability/correlation';
import logger from '../../lib/logger';

afterEach(() => vi.restoreAllMocks());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function run(headers: Record<string, string> = {}): {
  setHeader: ReturnType<typeof vi.fn>;
  context: RequestContext | undefined;
} {
  const setHeader = vi.fn();
  let context: RequestContext | undefined;
  const next: NextFunction = () => {
    context = currentContext();
  };
  correlationMiddleware(
    { headers } as unknown as Request,
    { setHeader } as unknown as Response,
    next
  );
  return { setHeader, context };
}

describe('correlation middleware', () => {
  it('generates a UUID per request and returns it on the response header', () => {
    const first = run();
    const second = run();

    expect(first.context?.requestId).toMatch(UUID);
    expect(second.context?.requestId).toMatch(UUID);
    expect(first.context?.requestId).not.toBe(second.context?.requestId);
    expect(first.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, first.context?.requestId);
  });

  it('never adopts a client-supplied id, so a caller cannot choose or collide with one', () => {
    const forged = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const { context, setHeader } = run({ 'x-request-id': forged });

    expect(context?.requestId).not.toBe(forged);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, context?.requestId);
  });

  it('records a well-formed inbound id separately, so the join is still possible', () => {
    const upstream = 'edge-7f3a2b19c4d5';
    expect(run({ 'x-request-id': upstream }).context?.clientRequestId).toBe(upstream);
    expect(run({ 'x-correlation-id': upstream }).context?.clientRequestId).toBe(upstream);
  });

  it('drops a malformed inbound id rather than logging caller-controlled junk', () => {
    expect(run({ 'x-request-id': 'a\nb' }).context?.clientRequestId).toBeUndefined();
  });
});

describe('inbound id sanitization', () => {
  it('accepts a well-formed upstream id for recording alongside our own', () => {
    expect(sanitizeInboundRequestId('  trace-abc.123:9  ')).toBe('trace-abc.123:9');
  });

  it.each([
    ['too short', 'abc'],
    ['newline injection', 'abcdefgh\n{"level":"error"}'],
    ['json breakout', 'abcdefgh","evil":"1'],
    ['oversized', 'a'.repeat(200)],
    ['not a string', 42],
    ['missing', undefined],
  ])('drops an id that is %s', (_label, value) => {
    expect(sanitizeInboundRequestId(value)).toBeUndefined();
  });
});

describe('propagation into the logger', () => {
  it('stamps request_id onto a line emitted with no access to the request', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    runWithContext({ requestId: 'req-under-test-0001' }, () => {
      // Stands in for a repository or service line far from the HTTP boundary.
      logger.info('stock deducted', { productId: 7 });
    });

    expect(spy.mock.calls[0][0]).toContain('req-under-test-0001');
  });

  it('emits no request_id outside a request, rather than inventing one', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logger.info('scheduler tick');
    expect(spy.mock.calls[0][0]).not.toContain('request_id');
  });

  it('lets an explicit request_id win, so a line can name another request', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    runWithContext({ requestId: 'ambient' }, () => {
      logger.info('abandoned in-flight request', { request_id: 'explicit' });
    });
    const line = spy.mock.calls[0][0] as string;
    expect(line).toContain('explicit');
    expect(line).not.toContain('ambient');
  });
});
