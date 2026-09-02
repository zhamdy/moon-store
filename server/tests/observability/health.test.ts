/**
 * Liveness / readiness split.
 *
 * The two criteria from #45 that this file exists to prove:
 *
 *   - "Liveness does not fail solely because a dependency is temporarily unavailable."
 *   - "Readiness fails when the server cannot safely serve traffic."
 *
 * The readiness failure is exercised against a *genuinely* unavailable database — a real
 * `pg.Pool` pointed at a port nothing is listening on — rather than a mock that throws.
 * A mock proves the `catch` branch runs; it does not prove that a real driver failure
 * takes that branch, nor that the probe answers promptly instead of hanging until the
 * prober gives up, which is the failure mode that actually hurts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import express from 'express';
import request from 'node:http';
import { setPool, closePool } from '../../src/database/pool';
import {
  READINESS_TIMEOUT_MS,
  beginShutdown,
  checkDatabase,
  evaluateReadiness,
  legacyHealthHandler,
  livenessHandler,
  readinessHandler,
  resetShutdownState,
} from '../../src/observability/health';
import { HEALTH_PATHS } from '../../src/observability/probePaths';
import { createPgMemPool } from '../support/pgMem';

/** A pool that cannot connect: nothing listens on this port on the loopback interface. */
function deadPool(): Pool {
  return new Pool({
    host: '127.0.0.1',
    port: 59_999,
    database: 'nonexistent',
    user: 'nobody',
    connectionTimeoutMillis: 500,
  });
}

interface FakeResponse {
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeResponse;
  json: (body: unknown) => FakeResponse;
}

function fakeResponse(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

let live: Pool | undefined;

beforeEach(() => {
  resetShutdownState();
});

afterEach(async () => {
  resetShutdownState();
  vi.restoreAllMocks();
  if (live) {
    await live.end().catch(() => undefined);
    live = undefined;
  }
  await closePool().catch(() => undefined);
});

describe('with a healthy database', () => {
  beforeEach(() => {
    setPool(createPgMemPool());
  });

  it('reports ready', async () => {
    const result = await evaluateReadiness();
    expect(result.ready).toBe(true);
    expect(result.checks.database.status).toBe('ok');
  });

  it('answers the legacy /api/health in its original envelope', async () => {
    const res = fakeResponse();
    await legacyHealthHandler({} as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: 'ok' } });
    expect((res.body as { data: { timestamp: string } }).data.timestamp).toBeTypeOf('string');
  });
});

describe('with a genuinely unavailable database', () => {
  beforeEach(() => {
    live = deadPool();
    // Swallow the pool's own idle-client error events; the connection failure is the
    // subject of the test, not an unhandled rejection.
    live.on('error', () => undefined);
    setPool(live);
  });

  it('fails readiness with a dependency reason and a 503', async () => {
    const res = fakeResponse();
    await readinessHandler({} as never, res as never);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ status: 'not_ready', reason: 'dependency_unavailable' });
    expect((res.body as { checks: { database: { status: string } } }).checks.database.status).toBe(
      'failed'
    );
  });

  it('answers promptly rather than hanging until the prober times out', async () => {
    const started = Date.now();
    const check = await checkDatabase();
    expect(check.status).toBe('failed');
    expect(Date.now() - started).toBeLessThan(READINESS_TIMEOUT_MS + 1500);
  });

  it('keeps liveness passing — a database blip must not get the process killed', () => {
    const res = fakeResponse();
    livenessHandler({} as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'alive' });
  });

  it('keeps the legacy endpoint on its original 503 contract', async () => {
    const res = fakeResponse();
    await legacyHealthHandler({} as never, res as never);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ success: false, error: 'Database unreachable' });
  });
});

describe('during graceful shutdown', () => {
  beforeEach(() => {
    setPool(createPgMemPool());
    beginShutdown();
  });

  it('fails readiness so the load balancer drains before the socket closes', async () => {
    const res = fakeResponse();
    await readinessHandler({} as never, res as never);
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ status: 'not_ready', reason: 'shutting_down' });
  });

  it('keeps liveness passing so the orchestrator does not SIGKILL the drain', () => {
    const res = fakeResponse();
    livenessHandler({} as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'alive', shutting_down: true });
  });
});

describe('probe routing', () => {
  it('serves every declared probe path', async () => {
    setPool(createPgMemPool());
    const app = express();
    app.get('/api/health/live', livenessHandler);
    app.get('/api/health/ready', readinessHandler);
    app.get('/api/health', legacyHealthHandler);

    const server = await new Promise<import('node:http').Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address() as import('node:net').AddressInfo;

    try {
      for (const path of HEALTH_PATHS) {
        const status = await new Promise<number>((resolve, reject) => {
          request
            .get({ host: '127.0.0.1', port, path }, (res) => {
              res.resume();
              resolve(res.statusCode ?? 0);
            })
            .on('error', reject);
        });
        expect(status, `${path} should be served`).toBe(200);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
