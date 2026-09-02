/**
 * The `http_request` line and the metrics it feeds.
 *
 * This line is the metrics transport for request rate, latency, error rate and the
 * HTTP-vs-business-failure split, so its field set is a contract: an aggregator's queries
 * break silently when a field is renamed or a value's cardinality explodes. It is also
 * the highest-volume log in the system, which makes it the one most likely to leak — so
 * the negative assertions (no query values, no body, no headers, no email) carry as much
 * weight as the positive ones.
 */
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import logger from '../../lib/logger';
import { runWithContext } from '../../src/observability/correlation';
import {
  errorClassifier,
  normalizeRoutePath,
  requestLogger,
} from '../../src/observability/requestLogging';
import { resetMetrics, snapshot } from '../../src/observability/metrics';
import { PublicError } from '../../src/http/errors';

interface Captured {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  meta: Record<string, unknown>;
}

let captured: Captured[] = [];

beforeEach(() => {
  captured = [];
  resetMetrics();
  for (const level of ['debug', 'info', 'warn', 'error'] as const) {
    vi.spyOn(logger, level).mockImplementation((message, meta) => {
      captured.push({ level, message, meta: (meta ?? {}) as Record<string, unknown> });
    });
  }
});

afterEach(() => vi.restoreAllMocks());

interface FinishOptions {
  method?: string;
  baseUrl?: string;
  path?: string;
  query?: Record<string, unknown>;
  status?: number;
  user?: { id: number; role: string; email?: string; name?: string };
  requestId?: string;
  error?: unknown;
}

/** Drives the middleware through a request that finishes with the given status. */
function finish(options: FinishOptions = {}): Captured {
  const res = new EventEmitter() as EventEmitter & Response;
  (res as unknown as { statusCode: number }).statusCode = options.status ?? 200;

  const req = {
    method: options.method ?? 'GET',
    baseUrl: options.baseUrl ?? '',
    path: options.path ?? '/',
    query: options.query ?? {},
    ...(options.user ? { user: options.user } : {}),
  } as unknown as Request;

  runWithContext({ requestId: options.requestId ?? 'req-0001' }, () => {
    requestLogger(req, res, () => undefined);
    if (options.error !== undefined) {
      errorClassifier(options.error, req, res, () => undefined);
    }
    res.emit('finish');
  });

  const line = captured.at(-1);
  if (!line) throw new Error('no log line emitted');
  return line;
}

describe('the http_request line', () => {
  it('carries the correlation id, route, status, duration and actor', () => {
    const line = finish({
      method: 'POST',
      baseUrl: '/api/v1/sales',
      path: '/',
      status: 201,
      user: { id: 42, role: 'Cashier' },
    });

    expect(line.level).toBe('info');
    expect(line.meta).toMatchObject({
      event: 'http_request',
      request_id: 'req-0001',
      method: 'POST',
      path: '/api/v1/sales/',
      status: 201,
      outcome: 'success',
      user_id: 42,
      user_role: 'Cashier',
    });
    expect(line.meta.duration_ms).toBeTypeOf('number');
  });

  it('logs no actor for an unauthenticated request', () => {
    const line = finish({ baseUrl: '/api/v1/auth', path: '/login', method: 'POST', status: 401 });
    expect(line.meta).not.toHaveProperty('user_id');
    expect(line.meta).not.toHaveProperty('user_role');
  });

  it('never logs the actor\'s email or name, which are personal data', () => {
    const line = finish({
      user: { id: 42, role: 'Cashier', email: 'sarah@moon.com', name: 'Sarah' },
    });
    expect(JSON.stringify(line.meta)).not.toContain('sarah@moon.com');
    expect(JSON.stringify(line.meta)).not.toContain('Sarah');
  });

  it('logs allow-listed query key names and never a query value', () => {
    const line = finish({
      baseUrl: '/api/v1/customers',
      path: '/',
      query: { page: '2', search: 'Fatima +971500000000', secretFilter: 'x' },
    });

    expect(line.meta.query_keys).toEqual(['page']);
    expect(JSON.stringify(line.meta)).not.toContain('Fatima');
    expect(JSON.stringify(line.meta)).not.toContain('971500000000');
  });

  it('escalates the level with the status class', () => {
    expect(finish({ status: 200 }).level).toBe('info');
    expect(finish({ status: 404 }).level).toBe('warn');
    expect(finish({ status: 500 }).level).toBe('error');
  });

  it('demotes health probes to debug so 8,640 lines a day do not bury the signal', () => {
    expect(finish({ path: '/api/health/live' }).level).toBe('debug');
    expect(finish({ path: '/api/health/ready' }).level).toBe('debug');
    // A failing probe is still loud.
    expect(finish({ path: '/api/health', status: 503 }).level).toBe('error');
  });
});

describe('outcome classification', () => {
  it('separates business validation failures from HTTP failures', () => {
    expect(finish({ status: 200 }).meta.outcome).toBe('success');
    expect(finish({ status: 400 }).meta.outcome).toBe('business_rule');
    expect(finish({ status: 409 }).meta.outcome).toBe('business_rule');
    expect(finish({ status: 401 }).meta.outcome).toBe('client_error');
    expect(finish({ status: 403 }).meta.outcome).toBe('client_error');
    expect(finish({ status: 404 }).meta.outcome).toBe('client_error');
    expect(finish({ status: 429 }).meta.outcome).toBe('client_error');
    expect(finish({ status: 500 }).meta.outcome).toBe('server_error');
  });

  it('records the public error code when the error boundary saw one', () => {
    const line = finish({
      method: 'POST',
      baseUrl: '/api/v1/sales',
      path: '/',
      status: 409,
      error: new PublicError('CONFLICT'),
    });
    expect(line.meta.error_code).toBe('CONFLICT');
  });

  it('feeds the metrics registry, keeping the four classes apart', () => {
    finish({ status: 200 });
    finish({ status: 200 });
    finish({ status: 400, baseUrl: '/api/v1/sales', path: '/', method: 'POST' });
    finish({ status: 401 });
    finish({ status: 500 });

    const metrics = snapshot();
    expect(metrics.requests_total).toBe(5);
    expect(metrics.requests_by_outcome).toEqual({
      success: 2,
      business_rule: 1,
      client_error: 1,
      server_error: 1,
    });
    expect(Object.keys(metrics.business_failures)).toEqual(['POST /api/v1/sales/:400']);
  });
});

describe('route normalization', () => {
  it.each([
    ['/api/v1/products/482', '/api/v1/products/:id'],
    ['/api/v1/sales/9/items/3', '/api/v1/sales/:id/items/:id'],
    ['/api/v1/products/8f14e45f-ceea-467a-9c3a-1c2f1a0b0000', '/api/v1/products/:id'],
    ['/api/v1/products/barcode/6291041500213', '/api/v1/products/barcode/:id'],
    ['/api/v1/products', '/api/v1/products'],
    ['/api/health/ready', '/api/health/ready'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeRoutePath(input)).toBe(expected);
  });

  it('keeps identifiers out of the logged path entirely', () => {
    const line = finish({ baseUrl: '/api/v1/customers', path: '/8821', method: 'GET' });
    expect(line.meta.path).toBe('/api/v1/customers/:id');
    expect(JSON.stringify(line.meta)).not.toContain('8821');
  });
});
