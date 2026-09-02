# Backend observability & health semantics

What this service emits, what an operator can probe, and what is worth waking someone for.
Implementation lives in `server/src/observability/`.

## Health endpoints

| Endpoint | Touches the database? | Meaning of a failure | What an orchestrator should do |
| --- | --- | --- | --- |
| `GET /api/health/live` | No | The process cannot serve at all | Restart the process |
| `GET /api/health/ready` | Yes, under a 2s timeout | This instance cannot safely serve *right now* | Stop routing to it; do **not** restart |
| `GET /api/health` | Yes | Legacy alias for readiness | Kept for the E2E harness and the deploy health check |

The split is the whole point. A failing liveness probe gets the process killed, so a
liveness check that touches the database turns a thirty-second database blip into a
rolling restart of every healthy instance — each dropping in-flight requests and a warm
pool, all reconnecting at once into the database that was already struggling. Liveness
therefore answers from the event loop and touches nothing.

Readiness is the one that checks dependencies, because a failed readiness probe means
"route elsewhere" and clears with no intervention when the dependency returns. Its
database check runs under a hard 2s timeout: a dependency that stops answering *without*
refusing connections would otherwise hang the probe until the prober's own timeout, so
the instance would neither pass nor fail — it would simply stop reporting.

Liveness keeps returning `200` during graceful shutdown (`shutting_down: true` in the
body). The process is winding down deliberately; a failing liveness probe there would
have the orchestrator `SIGKILL` the drain it is waiting for.

All three paths are exempt from the global rate limiter. The list is
`src/observability/probePaths.ts`, read by both the route registration and
`isRateLimitExempt` — **any new probe path must be added there**, or the probes start
spending the shop's request budget and monitoring reports an outage that monitoring
caused (see *Rate-limit bucketing* in `CLAUDE.md`, and #71).

### Shutdown behaviour

On `SIGTERM`/`SIGINT`, in order:

1. Readiness flips to `503 not_ready` (`reason: shutting_down`) — the load balancer stops
   sending new work while the socket is still open. This gap is the drain.
2. The scheduler stops claiming jobs; the metrics reporter emits one final snapshot.
3. `server.close()` waits for in-flight requests, then the pool is closed.
4. A 10s watchdog forces `exit(1)` if connections do not close.

Liveness stays green throughout.

## Correlation IDs

Every request is assigned a UUID and it is returned on the `X-Request-Id` response
header. Every log line the request produces carries it as `request_id`, including lines
emitted deep inside a service or repository — propagation is via `AsyncLocalStorage`, so
no call site threads a context argument.

**An inbound ID is recorded, never adopted.** This API is reached directly by tills and by
a public storefront, so a caller-chosen ID is an attacker-chosen primary key for the log
store: it can collide with another request's ID, be reused across thousands of requests to
make that traffic unsearchable, or carry newlines and kilobytes into every line. A
well-formed inbound `X-Request-Id` / `X-Correlation-Id` (8–128 chars of
`[A-Za-z0-9_.:-]`) is logged as `client_request_id`, so a join with an upstream trace is
still possible — but the field operators search by is one this process minted.

## Log lines

Production logs are one JSON object per line. Two events matter to monitoring:

### `http_request` — one per finished request

| Field | Notes |
| --- | --- |
| `request_id`, `client_request_id` | Correlation, as above |
| `method`, `path` | `path` is normalized: numeric, UUID and barcode-shaped segments become `:id` |
| `status`, `outcome`, `error_code` | See the outcome classes below |
| `duration_ms` | Server-side handling time |
| `user_id`, `user_role` | Actor, when authenticated |
| `query_keys` | Allow-listed query key *names* only — never values |

Health probes log at `debug` unless they fail; they are still counted in the metrics.

### `service_metrics` — a periodic snapshot

Emitted every `METRICS_LOG_INTERVAL_MS` (default 60000; `0` disables). Carries
`uptime_s`, `requests_total`, `requests_by_outcome`, a latency histogram
(`latency_ms.buckets.le_*`, `over_5000`, `avg`, `max`), `db_pool`
(`total`/`idle`/`waiting`) and `business_failures`. Counters are cumulative since process
start, which is what an aggregator's `rate()` expects; `uptime_s` in the same line is how
a reader tells a restart from a gap.

### Outcome classes

`outcome` is what makes HTTP failures and business validation failures distinguishable:

| Class | Statuses | Reading |
| --- | --- | --- |
| `success` | 2xx/3xx | — |
| `business_rule` | 400, 409, 422 | The domain said no. **Normal traffic** — a shop scanning an out-of-stock item produces these all day. Alerting on them as errors trains operators to ignore the alert. |
| `client_error` | 401, 403, 404, 405, 415, 429 | The caller was wrong or refused. A spike is an auth or client-version problem. |
| `server_error` | 5xx | The server's fault. The class worth paging on. |

## Metrics transport

**The log stream is the metrics transport. There is no `/metrics` endpoint.**

A Prometheus-style scrape endpoint (`prom-client` + `GET /metrics`) was considered and
rejected. It is not the metric shape that costs, it is the component: a scrape endpoint is
only a metrics system once somebody runs a Prometheus or an agent, keeps it reachable from
the API's network, and maintains a second retention and alerting stack beside the log
pipeline that already exists — and nobody has agreed to run that. Meanwhile the endpoint
is not free while it waits for one: it is a new unauthenticated surface whose body
enumerates every route and internal failure mode of the system. Same reasoning as #46
using a PostgreSQL claim row rather than introducing Redis.

Every signal #45 names is derivable from the two log events above. If a scrape endpoint is
later agreed to, `metrics.snapshot()` is already the registry — exposing one is a
formatter, not a redesign.

## Redaction

Two layers, and the first is the structural one:

1. **Nothing logs a request body, a header, a cookie, or a query value.** The request line
   logs allow-listed query *key names*; the auth module logs a 12-character digest prefix
   and never token material (#74); actor metadata is the user's id and role, never their
   email or name. An allow-list cannot leak a field nobody anticipated.
2. **Everything reaching `logger` is scrubbed** (`src/observability/redaction.ts`), in both
   directions: a *key* naming a secret is replaced whatever it holds, and a *value* shaped
   like a credential is replaced whatever it is called — JWTs, `Bearer`/`Basic` headers,
   connection strings with credentials, email addresses, E.164 phone numbers, full
   SHA-256 digests. Depth, array length and string length are bounded so one bad call
   cannot flood the aggregator.

Never logged: passwords and hashes, access/refresh tokens and any JWT, `Authorization`
headers, cookies, session identifiers, API keys, connection strings, card/PIN/OTP
material, and customer personal data (phone, email, address, name).

Key matching is on tokenized words rather than substrings, so `company` does not become
sensitive because it contains `pan`. Pinned by `tests/observability/redaction.test.ts`,
including the negative cases — a scrubber that eats stack traces is one people work around
by not logging.

## Alertable conditions

| Condition | Signal | Severity | Why |
| --- | --- | --- | --- |
| Readiness failing on all instances > 1 min | `GET /api/health/ready` 503 | Page | No instance can serve; the shop is down |
| Readiness failing on one instance > 5 min | Same, per instance | Ticket | Capacity loss; the LB has already routed around it |
| Liveness failing | `GET /api/health/live` non-200 | Page | The process cannot serve at all — a restart is the fix |
| `uptime_s` repeatedly resetting | `service_metrics` | Page | Crash loop; liveness alone will look healthy between restarts |
| `server_error` rate > 1% of requests over 5 min | `http_request` `outcome` | Page | Genuine server faults, distinct from a shop hitting business rules |
| `client_error` spike, mostly 401 | `http_request` `outcome`, `status` | Ticket | Token/refresh regression or a stale client build |
| Sustained 429s | `http_request` `status=429` | Ticket | A ceiling is too low for a busy shop, or one till is looping |
| `db_pool.waiting > 0` sustained > 1 min | `service_metrics` | Page | Every checkout is queueing for a connection, not for a query |
| `latency_ms.over_5000` rising | `service_metrics` | Ticket | Cashiers are waiting; usually the leading indicator of pool exhaustion |
| A `business_failures` label jumping order of magnitude | `service_metrics` | Ticket | A domain rule started rejecting traffic it used to accept — usually a bad config or price/promotion change |
| `Refresh token reuse detected` | log message (auth) | Page | Possible session theft; the family is already revoked |
| No `service_metrics` line for 3 intervals | Absence of the event | Ticket | The instance is wedged or its logs are not shipping |

Deliberately **not** alertable: `business_rule` outcomes on their own. They are the sound
of a shop working.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `METRICS_LOG_INTERVAL_MS` | `60000` | Snapshot cadence. `0` disables; sub-second values are raised to 1s. Invalid values fall back to the default. |
