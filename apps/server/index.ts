import 'dotenv/config';
import { createApp } from './src/app';
import { beginShutdown } from './src/observability/health';
import { resolveMetricsInterval, startMetricsReporter } from './src/observability/metrics';
import logger from './lib/logger';
import { closePool } from './src/database/pool';
import { startScheduler } from './src/scheduler';

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = createApp();
const PORT: number = Number(process.env.PORT) || 3001;

/**
 * Background maintenance. Every instance ticks, but each job runs at most once per
 * interval across the whole fleet — the claim lives in `scheduled_jobs`, not in this
 * process. See `src/scheduler/index.ts`.
 *
 * Deliberately started here, not inside `createApp()`: instantiating the app for a test
 * must not start a real timer or claim a real advisory lock.
 */
const scheduler = startScheduler();

/**
 * Periodic `service_metrics` line: pool saturation and business-failure counts, the two
 * signals no per-request line can carry. The log stream is this service's metrics
 * transport — see `src/observability/metrics.ts` for why there is no `/metrics` endpoint.
 */
const metricsReporter = startMetricsReporter(
  resolveMetricsInterval(process.env.METRICS_LOG_INTERVAL_MS)
);

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
});

const server = app.listen(PORT, () => {
  logger.info(`MOON Fashion API running on port ${PORT}`);
});

// Graceful shutdown
function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down gracefully`);
  /*
   * Readiness goes false first, before anything stops. The window between "this instance
   * stops advertising itself" and "this instance stops listening" is the drain: without
   * it the load balancer is still routing new checkouts at a socket that is closing, and
   * a cashier sees a connection reset instead of a retry against another instance.
   * Liveness deliberately keeps passing — the process is winding down on purpose, and a
   * failing liveness probe here would have the orchestrator SIGKILL the drain.
   */
  beginShutdown();
  scheduler.stop();
  metricsReporter.stop();
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await closePool();
      logger.info('Database connection closed');
    } catch (err: any) {
      logger.error('Error closing database pool', { error: err.message });
    }
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
