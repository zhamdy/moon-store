/**
 * The metrics registry and its transport.
 *
 * The transport decision — the structured log stream rather than a Prometheus-style
 * `/metrics` endpoint — is argued in `src/observability/metrics.ts`. What it means for
 * tests is that the *snapshot line* is the deliverable: it has to carry the two signals no
 * per-request line can (pool saturation, business-failure counts), be emitted on a
 * schedule an aggregator can rate(), and never hold the process open at shutdown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger from '../../lib/logger';
import {
  DEFAULT_METRICS_INTERVAL_MS,
  classifyOutcome,
  emitSnapshot,
  recordBusinessFailure,
  recordRequest,
  resetMetrics,
  resolveMetricsInterval,
  snapshot,
  startMetricsReporter,
} from '../../src/observability/metrics';
import { closePool, setPool, poolStats } from '../../src/database/pool';
import { createPgMemPool } from '../support/pgMem';

beforeEach(() => resetMetrics());
afterEach(async () => {
  vi.restoreAllMocks();
  await closePool().catch(() => undefined);
});

describe('outcome classification', () => {
  it.each([
    [200, 'success'],
    [204, 'success'],
    [302, 'success'],
    [400, 'business_rule'],
    [409, 'business_rule'],
    [422, 'business_rule'],
    [401, 'client_error'],
    [403, 'client_error'],
    [404, 'client_error'],
    [429, 'client_error'],
    [500, 'server_error'],
    [503, 'server_error'],
  ])('classifies %i as %s', (status, expected) => {
    expect(classifyOutcome(status)).toBe(expected);
  });
});

describe('the snapshot', () => {
  it('accumulates counts, latency and a histogram an aggregator can take percentiles from', () => {
    recordRequest('success', 3);
    recordRequest('success', 40);
    recordRequest('server_error', 9000);

    const metrics = snapshot();
    expect(metrics.requests_total).toBe(3);
    expect(metrics.requests_by_outcome.success).toBe(2);
    expect(metrics.requests_by_outcome.server_error).toBe(1);
    expect(metrics.latency_ms.max).toBe(9000);
    expect(metrics.latency_ms.avg).toBe(Math.round((3 + 40 + 9000) / 3));
    expect(metrics.latency_ms.buckets.le_5).toBe(1);
    expect(metrics.latency_ms.buckets.le_50).toBe(1);
    expect(metrics.latency_ms.over_5000).toBe(1);
  });

  it('counts critical business failures by low-cardinality label', () => {
    recordBusinessFailure('checkout.insufficient_stock');
    recordBusinessFailure('checkout.insufficient_stock');
    recordBusinessFailure('refund.window_expired');

    expect(snapshot().business_failures).toEqual({
      'checkout.insufficient_stock': 2,
      'refund.window_expired': 1,
    });
  });

  it('bounds the label set so a stray identifier degrades the labels, not the process', () => {
    for (let i = 0; i < 500; i += 1) recordBusinessFailure(`sale.${i}`);
    expect(Object.keys(snapshot().business_failures).length).toBeLessThanOrEqual(200);
  });

  // Ordered before the pool is installed: `poolStats` must not lazily create one, since
  // it is read by the metrics reporter and the readiness probe.
  it('does not open a pool just to be observed', () => {
    expect(poolStats()).toBeNull();
    expect(snapshot().db_pool).toBeNull();
  });

  it('reports database pool saturation, which no per-request line can carry', () => {
    setPool(createPgMemPool());
    expect(snapshot().db_pool).toMatchObject({
      total: expect.any(Number),
      idle: expect.any(Number),
      waiting: expect.any(Number),
    });
  });
});

describe('the reporter', () => {
  it('emits a service_metrics line on its interval and once more on stop', () => {
    vi.useFakeTimers();
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    try {
      const reporter = startMetricsReporter(1000);
      vi.advanceTimersByTime(2500);
      expect(info).toHaveBeenCalledTimes(2);
      reporter.stop();
      expect(info).toHaveBeenCalledTimes(3);
      vi.advanceTimersByTime(5000);
      expect(info).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tags the line so an aggregator can select it', () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    emitSnapshot();
    expect(info.mock.calls[0][1]).toMatchObject({ event: 'service_metrics' });
  });

  it('can be switched off entirely', () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const reporter = startMetricsReporter(0);
    reporter.stop();
    // Only the "disabled" boot line; no snapshots.
    expect(info).toHaveBeenCalledTimes(1);
  });
});

describe('METRICS_LOG_INTERVAL_MS', () => {
  it('defaults when unset', () => {
    expect(resolveMetricsInterval(undefined)).toBe(DEFAULT_METRICS_INTERVAL_MS);
  });

  it('falls back to the default on anything that is not a non-negative integer', () => {
    for (const raw of ['', 'soon', '-1', '1.5', '1O']) {
      expect(resolveMetricsInterval(raw)).toBe(DEFAULT_METRICS_INTERVAL_MS);
    }
  });

  it('honours an explicit value, treats 0 as off, and raises a log flood to 1s', () => {
    expect(resolveMetricsInterval('15000')).toBe(15000);
    expect(resolveMetricsInterval('0')).toBe(0);
    expect(resolveMetricsInterval('50')).toBe(1000);
  });
});
