import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { success } from '../../src/http/responses';
import { mapPublicError } from '../../src/http/errors';
import { createListQuerySchema, paginationMeta } from '../../src/http/pagination';
import { endpointManifest } from '../../src/http/endpointManifest';
import { routeTable } from '../../src/router';
import { requestLogger } from '../../src/observability/requestLogging';
import logger from '../../lib/logger';
import errorHandler from '../../middleware/errorHandler';
import { requireRole, verifyToken } from '../../middleware/auth';
import { errorResponse } from '../../src/http/errors';

describe('HTTP contract foundations', () => {
  it('constructs body-bearing success responses with only data and optional meta', () => {
    expect(success({ id: 1 })).toEqual({ data: { id: 1 } });
    expect(success([1], { pagination: paginationMeta(2, 25, 60) })).toEqual({
      data: [1],
      meta: {
        pagination: {
          page: 2,
          pageSize: 25,
          totalItems: 60,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      },
    });
  });

  it('maps every nested Zod issue in order without echoing rejected values', () => {
    const schema = z.object({ profile: z.object({ email: z.string().email() }), age: z.number() });
    const result = schema.safeParse({ profile: { email: 'secret@example' }, age: 'forty' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const mapped = mapPublicError(result.error);
    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe('VALIDATION_ERROR');
    expect(mapped.body.error.details).toEqual([
      { field: 'profile.email', code: 'invalid_string', message: 'Invalid email' },
      { field: 'age', code: 'invalid_type', message: 'Expected number, received string' },
    ]);
    expect(JSON.stringify(mapped.body)).not.toContain('secret@example');
  });

  it('uses validation templates that do not echo rejected enum values', () => {
    const parsed = z
      .object({ role: z.enum(['Admin', 'Cashier']) })
      .safeParse({ role: 'super-secret-role' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const mapped = mapPublicError(parsed.error);
    expect(JSON.stringify(mapped.body)).not.toContain('super-secret-role');
  });

  it.each(['production', 'development', 'test'])('sanitizes internal errors in %s', (nodeEnv) => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = nodeEnv;
    const internal = new Error(
      'SELECT password FROM users; postgres://admin:secret@db/private token=abc john@example.com C:\\private\\app.ts'
    );
    internal.stack = `stack ${internal.message}`;
    const mapped = mapPublicError(internal);
    process.env.NODE_ENV = previous;

    expect(mapped.status).toBe(500);
    expect(mapped.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(JSON.stringify(mapped.diagnostic)).not.toMatch(
      /SELECT|postgres:|secret|abc|john@|private/i
    );
  });

  it('strictly parses common list fields and lets resources allowlist sort fields', () => {
    const schema = createListQuerySchema(['name', 'createdAt'] as const);
    expect(schema.parse({})).toEqual({ page: 1, pageSize: 25, sortOrder: 'asc' });
    expect(schema.parse({ page: '2', pageSize: '50', sortBy: 'name', sortOrder: 'desc' })).toEqual({
      page: 2,
      pageSize: 50,
      sortBy: 'name',
      sortOrder: 'desc',
    });
    expect(() => schema.parse({ page: '1x' })).toThrow();
    expect(() => schema.parse({ pageSize: '20' })).toThrow();
    expect(() => schema.parse({ sortBy: 'price' })).toThrow();
    expect(() => schema.parse({ unknown: 'value' })).toThrow();
  });

  it('classifies every mounted API router with explicit authorization', () => {
    expect(Object.keys(endpointManifest).sort()).toEqual(routeTable.map(([path]) => path).sort());
    for (const entry of Object.values(endpointManifest)) {
      expect(entry.classifications.length).toBeGreaterThan(0);
      expect(entry.authorization.kind).toMatch(/^(public|authenticated)$/);
      expect(entry.authorization).toHaveProperty('roles');
      expect(entry.authorization).toHaveProperty('predicate');
    }
  });

  it('covers every mounted verb and path exactly once through its manifest group', () => {
    type RouteLayer = {
      route?: { path: string; methods: Record<string, boolean> };
    };
    const endpoints = routeTable.flatMap(([mount, router]) =>
      ((router as unknown as { stack: RouteLayer[] }).stack ?? []).flatMap((layer) => {
        if (!layer.route) return [];
        return Object.entries(layer.route.methods)
          .filter(([, enabled]) => enabled)
          .map(([method]) => ({
            method: method.toUpperCase(),
            path: `${mount}${layer.route?.path}`,
          }));
      })
    );
    const identities = endpoints.map(({ method, path }) => `${method} ${path}`);

    expect(endpoints.length).toBeGreaterThan(150);
    expect(new Set(identities).size).toBe(identities.length);
    for (const endpoint of endpoints) {
      const mount = Object.keys(endpointManifest).find(
        (candidate) => endpoint.path === candidate || endpoint.path.startsWith(`${candidate}/`)
      );
      expect(mount, `${endpoint.method} ${endpoint.path}`).toBeDefined();
      const classifications = endpointManifest[mount!].classifications;
      expect(classifications.length, `${endpoint.method} ${endpoint.path}`).toBeGreaterThan(0);
      if (endpoint.method === 'GET') {
        expect(classifications.some((kind) => ['P', 'B', 'S', 'E'].includes(kind))).toBe(true);
      } else {
        expect(classifications.some((kind) => ['M', 'E'].includes(kind))).toBe(true);
      }
    }
  });

  it('logs only path and allowlisted query-key names, never query values', () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const response = new EventEmitter() as EventEmitter & { statusCode: number };
    response.statusCode = 200;
    requestLogger(
      {
        method: 'GET',
        path: '/api/v1/products',
        originalUrl: '/api/v1/products?search=john@example.com&token=secret&page=2&unknown=private',
        query: { search: 'john@example.com', token: 'secret', page: '2', unknown: 'private' },
      } as never,
      response as never,
      vi.fn()
    );
    response.emit('finish');

    expect(info).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(info.mock.calls[0]);
    expect(serialized).toContain('/api/v1/products');
    expect(serialized).toContain('page');
    expect(serialized).not.toMatch(/john|example|secret|private|token|unknown/i);
    info.mockRestore();
  });

  it('uses indistinguishable auth failures and the declared forbidden shape', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    verifyToken({ headers: {} } as never, { status } as never, vi.fn());
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(errorResponse('UNAUTHORIZED'));

    json.mockClear();
    status.mockClear();
    requireRole('Admin')(
      { user: { id: 1, email: 'cashier@moon.com', name: 'Cashier', role: 'Cashier' } } as never,
      { status } as never,
      vi.fn()
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(errorResponse('FORBIDDEN'));
  });

  it('declares rate-limit and unknown-route errors while 204 remains bodyless', () => {
    expect(errorResponse('RATE_LIMITED')).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests' },
    });
    expect(errorResponse('NOT_FOUND')).toEqual({
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
    const end = vi.fn();
    const json = vi.fn();
    const response = { status: vi.fn(() => ({ end, json })) };
    response.status(204).end();
    expect(end).toHaveBeenCalledOnce();
    expect(json).not.toHaveBeenCalled();
  });

  it('logs only sanitized diagnostics for uncaught errors', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    errorHandler(
      new Error('postgres://admin:secret@db SELECT token john@example.com'),
      {} as never,
      { status } as never,
      vi.fn()
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(errorResponse('INTERNAL_ERROR'));
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/postgres|secret|SELECT|token|john@/i);
    error.mockRestore();
  });
});
