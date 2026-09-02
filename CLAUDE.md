## Quick Start

```bash
# Terminal 1 — Server (port 3001)
cd server && npm run migrate && npm run seed && npm run dev

# Terminal 2 — Client (port 5173)
cd client && npm run dev
```

## Default Logins

| Email          | Password    | Role     |
| -------------- | ----------- | -------- |
| admin@moon.com | admin123    | Admin    |
| sarah@moon.com | cashier123  | Cashier  |
| james@moon.com | delivery123 | Delivery |

## Key Patterns

`client/src/` is three layers: `app/` (composition root — routing, shell, session wiring),
`features/` (nine domain slices), `shared/` (cross-cutting code, feature-agnostic). Full model,
dependency rules and diagrams: `docs/ARCHITECTURE.md`.

### The nine slices (`client/src/features/<slice>/`)

| Slice | Purpose |
|---|---|
| `auth` | Login, session/auth store, route guard |
| `pos` | Point of sale, register, shifts, cart, held carts |
| `inventory` | Products, stock, categories, bundles, pricing |
| `sales` | Sales history, promotions, gift cards, layaway |
| `customers` | Customer records, feedback, segments |
| `purchasing` | Distributors, vendors, expenses, purchase orders |
| `fulfillment` | Deliveries, online orders, storefront |
| `analytics` | Dashboard, reports, exports, AI insights |
| `admin` | Users, settings, audit log, backup, branches |

### Where does a file go? (R5 placement checklist)

1. Used by two or more slices? → `shared/`.
2. Is it the app shell or composition root? → `app/`.
3. Otherwise → the one slice that uses it.
4. Another slice needs it? → export it from that slice's `index.ts`. Never import deeper
   (`@/features/other-slice/pages/...` is a lint error).
5. Colocate the test beside the unit.

Full checklist detail, the global string-coupling contract (persist keys, shared React Query keys,
duplicated Sidebar route strings, global i18n files), and slice split/merge criteria:
`docs/CONVENTIONS.md`.

## Testing

```bash
cd server && npm test          # pg-mem suites; real-PostgreSQL suites report as skipped
cd client && npm test
```

### Real-PostgreSQL suites

Concurrency and idempotency invariants (guarded relative writes, `FOR UPDATE`, unique-claim
races) cannot be proven on pg-mem — they need two genuinely concurrent connections. Those
suites use `describeWithPostgres` from `server/tests/support/realPostgres.ts` and run only
when `TEST_DATABASE_URL` is set. Without it they **skip loudly**; they never pass silently.

```bash
# Option A — a PostgreSQL you already run locally: point at a throwaway database
createdb moon_store_test
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/moon_store_test npm test

# Option B — a disposable container (port 5433, so it clears a local 5432)
docker compose -f docker-compose.test.yml up -d
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/moon_store_test npm test
```

Each test file gets its own schema, migrated through the real migration runner and dropped
on teardown, so files cannot contaminate each other. The target database only needs `CREATE`
privileges. CI (`.github/workflows/ci.yml`) always sets `TEST_DATABASE_URL` and fails the
build if these suites were skipped.

### End-to-end suite (`e2e/`)

Playwright driving the real client production build against the real server and a real
PostgreSQL database — the wire between the two halves the unit suites already cover.
Chromium only. Full detail in `e2e/README.md`.

```bash
npm ci --prefix e2e && npx --prefix e2e playwright install --with-deps chromium
npm run build --prefix client                 # deliberately its own step, not webServer
cd e2e && E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/moon_store_e2e npm test
```

> **This suite deletes every row in 77 tables and restarts their sequences.** Point it at a
> disposable database only. `E2E_DATABASE_URL` has **no default** and the run aborts without
> it; a second guard aborts if the running API is not on that same database, which is what
> makes `reuseExistingServer` safe when a dev server is already on port 3001.

Two new production-facing knobs, both defaulting to today's values so an unset server
behaves exactly as before:

| Variable | Default | Meaning |
| --- | --- | --- |
| `RATE_LIMIT_MAX` | `200` | Global ceiling per 15 min. |
| `AUTH_RATE_LIMIT_MAX` | `10` | Ceiling on `/auth/login` and `/auth/refresh`. |

They are deliberately separate: one variable raising both would let a config written to
unblock a test run silently relax the credential brute-force ceiling. A value that is not a
positive integer falls back to the default, and any override is warned about at boot.

The suite is Chromium-only and split into three projects: a `setup` project that logs in
through the real form, a `fullyParallel` `pos-parallel` project, and a serial
`pos-settings` project that is the **only** place permitted to write
`PUT /api/v1/settings` — tax and loyalty are global rows, so a write from a parallel
worker changes the totals every other worker is asserting on.

`@smoke` is the pull-request gate, budgeted under three minutes; the full sharded suite
runs on `main`. See `e2e/README.md` for ownership, the flake policy, and the findings the
suite has already produced, and `docs/CONVENTIONS.md` → *E2E test conventions* before
adding specs.

## Rate-limit bucketing

The global limiter is keyed on the **authenticated user**, not on the IP. Several tills
behind one shop router share one address, so an IP-keyed budget is a per-shop budget and
one busy till can push a colleague into a `RATE_LIMITED` mid-checkout. The limiter runs
ahead of `verifyToken`, so the identity comes from verifying the bearer token's signature
inside the key generator — verifying, never decoding: an unverified token would let a
caller choose its own bucket. Unauthenticated requests keep the IP bucket, and
`GET /api/health` is exempt so an uptime probe cannot be starved by, or starve, the tills.

`authLimiter` on `/auth/login` and `/auth/refresh` deliberately stays IP-keyed: a
credential-guessing attacker is unauthenticated by definition, so there is no verified
user to key on.

| Variable | Default | Meaning |
| --- | --- | --- |
| `TRUST_PROXY` | unset (off) | How far to trust `X-Forwarded-For` when deriving `req.ip`. |

Accepts a hop count (`1`), a comma list of addresses/CIDRs/`loopback`-style presets, or
`true`. Unset reproduces Express's default exactly. Prefer a hop count: `true` trusts the
whole client-supplied chain, which lets a client pick its own IP bucket — it is accepted
but warned about at boot, as is a value that could not be parsed.

## Offline queue

The queue in `localStorage` is replayed by `client/src/shared/hooks/useOffline.ts`. A failed
replay backs off, and a rejection the server will repeat parks for a cashier rather than
retrying forever — see the **Offline queue replay contract** in `docs/CONVENTIONS.md`
before changing the hook or its store.

> **The checkout path does not currently reach that queue.** `queryClient` sets no
> `networkMode`, so React Query's default pauses a mutation fired while `navigator.onLine`
> is false rather than failing it. No request goes out, `onError` never runs, and
> `CartPanel`'s offline fallback — the only writer to `moon-offline-queue`— is unreachable.
> The sale resumes and completes on reconnect if the tab stays open, but does not survive a
> reload. Measured in `e2e/specs/offline.spec.ts`; the machinery above is sound, what is
> missing is the path into it.

## Idempotency compatibility window

Retry-prone mutations (`POST /api/v1/sales` and the other wrapped endpoints) accept an
`Idempotency-Key` request header. A repeated key returns the original outcome
byte-identically with `Idempotent-Replay: true`; the same key with a different payload,
endpoint, or user returns `409` with the code `IDEMPOTENCY_KEY_REUSED`. Keys live 24h and
identify a *committed outcome* — a failed mutation releases its key, so a corrected retry
under the same key runs normally.

| Variable | Default | Meaning |
| --- | --- | --- |
| `IDEMPOTENCY_REQUIRED` | `false` | While false, a request with no key behaves exactly as it did before idempotency existed. Set to `true` to require the header. |

**Rollout order is server first, then client** — neither half breaks the other at any
point in between, because the header is optional on both sides for the whole window.

**Flip criterion, not a date:** set `IDEMPOTENCY_REQUIRED=true` only once every deployed
till is confirmed to be sending the header. The observable is that
`SELECT COUNT(*) FROM idempotency_keys WHERE created_at > NOW() - INTERVAL '1 day'`
matches the day's sale count. Flipping is a config change, not a deploy, so it is
reversible in seconds.

## Scheduled jobs

Background maintenance runs through `server/src/scheduler`, not through a `setInterval`
per process. Every instance still ticks on its own timer, but a tick only *offers* to run:
`runScheduledJob` takes a session-level advisory lock (so two runs cannot overlap) and then
claims the interval in the `scheduled_jobs` table with one conditional upsert (so a second
instance waking a second later does not repeat the work). Horizontal scaling therefore does
not multiply the work.

There is deliberately no job framework and no Redis. PostgreSQL is already required and
already provides both primitives; an external scheduler would be a component to run,
monitor and fail over for what is a single `DELETE`.

Every job reports an outcome, which is written to `scheduled_jobs.last_detail` and logged.
To see what the fleet has been doing:

```sql
SELECT name, last_started_at, last_finished_at, last_status, last_detail,
       run_count, failure_count
  FROM scheduled_jobs;
```

| Job | Cadence | Outcome |
| --- | --- | --- |
| `reservation-cleanup` | 5 min | `{ deleted }` — expired stock reservations removed |
| `orphaned-media-cleanup` | 24 h | `{ scanned, deleted, skippedRecent, failed }` |

Jobs must be idempotent: a failed run is retried on the next interval, and both jobs are
keyed on the current state of the world rather than on a cursor, so a retry that finds
nothing to do reports `0` rather than failing.

**A claim is written before the work, so a process killed mid-run leaves the row in
`running`.** Another instance takes that claim over once it is older than the job's
`staleAfterMs` (default 10 min) — safe because the takeover is only ever reached with the
advisory lock free, and a run that is genuinely in progress holds it. The lock, not the
row, is the authority on "is someone running this"; the row only decides "has this been
done recently enough". A takeover is logged, and means a previous run died without
recording anything.

Adding a job means adding a `ScheduledJob` to `src/scheduler/jobs.ts` with a **new, never
reused** `lockId` — during a rolling deploy two ids for the same job means two concurrent
runs.

## Media storage

Uploaded images go through the `StorageDriver` abstraction in `server/src/storage`, never
straight to disk. The controller mints a key, hands the driver a buffer, and stores the URL
the driver returns; nothing above the interface knows where the bytes live.

`local` (filesystem) is the only bundled driver and the default. Its defaults reproduce the
previous behaviour exactly — objects under `server/uploads`, URLs of the form
`/uploads/products/<name>` — so **every image URL already in the database keeps working
untouched**. For a deployment it is durable only when `MEDIA_LOCAL_ROOT` points at storage
that outlives the container and is shared by every instance (a mounted volume or NFS).
Where that is not available, add a driver implementing `StorageDriver` and a case in
`createStorageDriver`; no provider SDK or credential belongs in the callers, and none is
hardcoded anywhere in this repo.

| Variable | Default | Meaning |
| --- | --- | --- |
| `MEDIA_STORAGE_DRIVER` | `local` | Which driver to resolve. |
| `MEDIA_LOCAL_ROOT` | `server/uploads` | Root directory for the `local` driver. |
| `MEDIA_PUBLIC_BASE_URL` | `/uploads` | Prefix `publicUrl` puts in front of a key. |
| `MEDIA_ORPHAN_MIN_AGE_HOURS` | `24` | Grace period before the sweep may delete an unreferenced object. |

**Local development:** nothing to configure. `npm run dev` with no media variables set
writes to `server/uploads` and serves `/uploads` exactly as before.

**Moving to a shared or remote store:** copy the existing `server/uploads` tree into the
new store preserving keys, then point the config at it. Old rows hold relative
`/uploads/...` URLs and keep resolving through the `/uploads` mount, so the copy can happen
before or after the config change. Only set `MEDIA_PUBLIC_BASE_URL` to an absolute base
once the objects are actually reachable there; new rows will then hold absolute URLs while
old ones stay relative, and both remain valid.

**Lifecycle.** Validation and authorization run before anything is written (Admin only,
2 MB, JPEG/PNG/WebP, magic bytes must agree with the extension), the object is written
before the row that references it, and the replaced object is released only after the row
stops pointing at it. Each step's failure mode is a temporary orphan, never a broken image.
The daily `orphaned-media-cleanup` job is the backstop for orphans no request path could
clean up; it reads every `image_url` in the database first and aborts rather than delete
anything if that read fails **or if any URL that belongs to this store cannot be resolved
to a key** — an unresolvable reference is missing information, and a deletion routine must
never read missing information as "unreferenced" — and it never touches an object younger than
`MEDIA_ORPHAN_MIN_AGE_HOURS`. **A new table with an image URL column must be added to the
reference query in `src/scheduler/mediaSweep.ts`** — the sweep deletes what that query does
not return.

## Refresh token rotation

Refresh tokens are stored as a SHA-256 digest, never in plaintext, and each login opens a
`family_id` that every rotation of that session stays inside. A refresh token is usable
**once**: `POST /api/v1/auth/refresh` invalidates the presented token, issues a successor
in the same family, and returns it as a new `refreshToken` cookie. The response body is
unchanged, and the cookie stays httpOnly, so no client change was needed.

SHA-256 rather than bcrypt because a refresh token is a signed JWT with a random `jti`,
not a human-chosen password: there is no dictionary for a work factor to slow down, while
bcrypt would add ~100ms to every refresh and, being salted, turn lookup from an index probe
into a full scan.

A successor **never extends the session**: it inherits the family's original `expires_at`,
so a session still ends `JWT_REFRESH_TTL_DAYS` after the login that created it.

Presenting an already-invalidated token revokes the **whole family** and returns the same
opaque 401 every other failure returns — a caller holding a stolen token cannot learn which
failure it hit, or whether the theft was noticed. The distinction is logged server-side,
with a digest prefix and never token material.

### The replay window, and why a replay returns an old token

Two tabs sharing one cookie jar both fire `/auth/refresh` the instant the access token
expires, and a client that never received its response asks again. Those honest cases
present an invalidated token routinely, so within `REFRESH_ROTATION_GRACE_SECONDS` a
presentation is treated as a **replay** and answered *idempotently, with the token that
rotation already issued* — not with a fresh one. Minting a fresh token for the second
caller would invalidate the one the first caller was already handed, and in a shared jar
the loser's `Set-Cookie` can land last: the next refresh would then carry a token revoked
minutes earlier, be classified as reuse, and log the user out everywhere. Converging both
callers on one token removes the choice. A replay writes nothing at all.

That is possible without storing plaintext because the successor is **derived**, not
randomly signed: its `jti` is `HMAC(refresh secret, digest of the presented token)`, `iat`
is suppressed and `exp` comes from the family's fixed expiry, which makes the token a pure
function of the token it replaces. Reuse detection is deferred by this, not weakened — a
thief and the legitimate holder converge on the same token, and whichever falls outside the
window first trips detection.

### Serialization

Every path that changes a user's sessions takes `SELECT ... FOR UPDATE` on the **user row
first**, then token rows: rotation, logout, global revocation, and the revocation that
follows detected reuse. Nothing may invert that order. Without the user lock, "revoke every
live session" is one statement whose snapshot is fixed when it starts, so a successor
inserted by a rotation committing a moment later is not in it and the session comes back.
Freshness is measured with `clock_timestamp()`, never `NOW()`: `NOW()` is fixed at
transaction start, so for the caller that loses the lock race it reads *earlier* than the
revocation it is compared against.

Revocation after a detected reuse runs in its own transaction *after* the rotation
transaction commits — throwing from inside would roll it back — and is best-effort: a
database fault there is logged as a security event but never turns the 401 into a 500.

### Cleanup

Rows are revoked, never deleted, until they expire: a revoked row is the evidence that
makes a later replay detectable, and a deleted one cannot tell "token I have never seen"
from "token I invalidated 20 minutes ago". `DELETE ... WHERE expires_at < NOW()` is swept
on login, throttled hourly per process and non-fatal.

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `JWT_ACCESS_TTL` | `15m` | Access-token lifetime. **Capped at 1h.** |
| `JWT_REFRESH_TTL_DAYS` | `7` | Session lifetime, and the ceiling no rotation extends. |
| `REFRESH_ROTATION_GRACE_SECONDS` | `60` | Replay window; `0` is strict no-grace rotation. |
| `COOKIE_SAMESITE` | `lax` | Case-insensitive; `none` forces `Secure`. |
| `COOKIE_DOMAIN` | unset | Unset means a host-only cookie, which is stricter. |

All five fall back to their default and warn rather than failing the boot, the same posture
as the rate-limit ceilings. The access TTL cap is not a style choice: an access token is
accepted on its signature alone, so `JWT_ACCESS_TTL=7d` would make logout, global
revocation and reuse detection no-ops for a week. The grace default is derived from the
case it absorbs — a client cannot even observe a dropped response until its HTTP request
times out, commonly 30s or more, so the previous 10s sat below the timescale of the failure
it existed for.

`POST /api/v1/auth/logout` ends the presented token's whole lineage;
`POST /api/v1/auth/logout-all` ends every session that user has, on every device. Neither
can reach an access token already issued, which is why that lifetime is short and capped.

## Git Workflow

- **Always branch from `main`** before starting a feature (`feature/xxx`, `fix/xxx`)
- Commit frequently with clear messages
- Merge back via PR

## Build Warnings

Chunk size warning (>500KB) is expected for SPA bundle — safe to ignore.
