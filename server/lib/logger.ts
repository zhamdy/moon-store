/**
 * The process logger.
 *
 * Two things happen to every line that passes through here, and both are deliberately
 * unavoidable by call sites:
 *
 *   - **Correlation.** If the line is emitted while a request is in flight, it is stamped
 *     with that request's `request_id` from `AsyncLocalStorage`. No call site threads a
 *     context argument, which is what makes "trace a request through the logs by one id"
 *     true for repository and service lines and not only for the HTTP boundary.
 *
 *   - **Redaction.** Metadata and message both pass through `redactMeta`/`scrubString`.
 *     This is the second layer — the first is that nothing logs bodies, headers or query
 *     values in the first place — and it exists for the day a future caller passes
 *     `{ user }` or an `Authorization` header into a log line by accident.
 */
import { currentRequestId } from '../src/observability/correlation';
import { redactMeta, scrubString } from '../src/observability/redaction';

const isProduction = process.env.NODE_ENV === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel = isProduction ? LEVELS.info : LEVELS.debug;

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  if (isProduction) {
    return JSON.stringify({ level, msg: message, time: new Date().toISOString(), ...meta });
  }
  const prefix = `[${level.toUpperCase()}]`;
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${prefix} ${message}${metaStr}`;
}

/**
 * An explicit `request_id` in the metadata wins: a line about *another* request — the
 * shutdown sweep reporting which request it abandoned, say — must be able to name it.
 */
function withCorrelation(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  const requestId = currentRequestId();
  if (!requestId) return meta ?? {};
  return { request_id: requestId, ...(meta ?? {}) };
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < minLevel) return;
  const safeMeta = redactMeta(withCorrelation(meta));
  const formatted = formatMessage(level, scrubString(message), safeMeta);
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
};

export default logger;
