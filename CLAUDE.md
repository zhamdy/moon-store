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

## Offline queue

Sales rung up offline are queued in `localStorage` and replayed by
`client/src/shared/hooks/useOffline.ts`. A failed replay backs off, and a rejection the server will
repeat parks for a cashier rather than retrying forever — see the **Offline queue replay contract**
in `docs/CONVENTIONS.md` before changing the hook or its store.

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

## Git Workflow

- **Always branch from `main`** before starting a feature (`feature/xxx`, `fix/xxx`)
- Commit frequently with clear messages
- Merge back via PR

## Build Warnings

Chunk size warning (>500KB) is expected for SPA bundle — safe to ignore.
