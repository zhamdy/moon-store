/**
 * Correlation IDs.
 *
 * Every request gets exactly one id, and it is *generated here* — never adopted from the
 * caller.
 *
 * The trust argument: this API is reached directly by tills, by a public storefront, and
 * by anything else that can open a socket. An adopted `X-Request-Id` is an
 * attacker-chosen primary key for the log store. It lets a caller (a) collide with
 * another request's id, so a support investigation reads two unrelated requests as one
 * causal chain, (b) reuse one id across thousands of requests to make its own traffic
 * unsearchable, and (c) inject newlines or several kilobytes into every log line the
 * request produces. None of those need any privilege. The upstream benefit — a shared id
 * across a service boundary — does not apply: nothing in this deployment sits in front of
 * the API generating ids, and if something does later, its id can be *recorded* without
 * being *trusted*.
 *
 * So: the server's own id is authoritative and is what the response header carries; an
 * inbound id, if it passes a strict format check, is logged alongside it as
 * `client_request_id`. Both halves of the join are then available, and the field an
 * operator searches by is one this process minted.
 *
 * Propagation is via `AsyncLocalStorage`, so `logger` can stamp the id onto *every* line
 * a request produces — including deep inside a repository — without any call site
 * threading a context argument. That is what makes "trace a request through the logs by
 * one id" true rather than aspirational.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Header the id is returned on, and the one an upstream id is read from. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Also accepted as an inbound hint; many proxies emit this spelling instead. */
export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

export interface RequestContext {
  /** This server's id for the request. Authoritative; always present. */
  requestId: string;
  /** A well-formed id the caller sent, recorded but never trusted. */
  clientRequestId?: string;
  /** Public error code, when the request failed through the error boundary. */
  errorCode?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * A caller-supplied id is accepted into the logs only if it is short, single-line, and
 * made of characters that cannot break a JSON log line or a log query: this is the
 * bound on (c) above. Anything else is dropped silently — a malformed hint is not worth
 * a log line of its own, which would itself be caller-triggered noise.
 */
const INBOUND_ID = /^[A-Za-z0-9_.:-]{8,128}$/;

export function sanitizeInboundRequestId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return INBOUND_ID.test(trimmed) ? trimmed : undefined;
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Runs `fn` inside a fresh context. Used by the middleware and by tests. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Assigns the request its id, echoes it to the client, and runs the rest of the chain
 * inside the context so every downstream log line carries it.
 *
 * Mounted before the rate limiter in `server/index.ts`: a `429` is precisely the response
 * a shop will call support about, and it is worthless without an id to look up.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const context: RequestContext = {
    requestId: randomUUID(),
    clientRequestId:
      sanitizeInboundRequestId(req.headers[REQUEST_ID_HEADER.toLowerCase()]) ??
      sanitizeInboundRequestId(req.headers[CORRELATION_ID_HEADER.toLowerCase()]),
  };
  res.setHeader(REQUEST_ID_HEADER, context.requestId);
  runWithContext(context, next);
}
