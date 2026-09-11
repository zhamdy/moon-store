# MOON Fashion & Style

Luxury fashion retail management: a React SPA point of sale over an Express + PostgreSQL
API. This file is always loaded and holds what is true across both halves. The subsystem
contracts load on demand, when you work in the tree they govern.

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

## Subsystem contracts

- **`server/CLAUDE.md`** — the API contract and its two gates, rate-limit bucketing,
  idempotency, optimistic concurrency, typed error contracts, scheduled jobs, media
  storage, refresh-token rotation, migration verification.
- **`client/CLAUDE.md`** — the offline queue replay contract, PWA install/update policy,
  react-hook-form on HeroUI inputs, the accessibility rules and patterns.
- **`e2e/README.md`** — ownership, the flake policy, and what the suite has already found.
- **`docs/CONVENTIONS.md`** — placement detail, the string-coupling contract, E2E
  conventions. **`docs/ACCESSIBILITY.md`** — what is scanned, what is manual, what is not
  proven.

## Key Patterns

`client/src/` is three layers: `app/` (composition root — routing, shell, session wiring),
`features/` (nine domain slices), `shared/` (cross-cutting code, feature-agnostic).
`ls client/src/features` lists the slices; `docs/CONVENTIONS.md` has the dependency rules.

`server/src/modules/` is grouped by domain (`core`, `inventory`, `commerce`, `pos`,
`fulfillment`, `intelligence`), each module a `routes` / `controller` / `service` /
`repository` / `types` / `schemas` set. `src/router.ts` mounts them all, and is the only
authority on what this server actually serves — every gate that matters walks it rather
than reading a list someone maintains by hand.

### Where does a file go? (R5 placement checklist)

1. Used by two or more slices? → `shared/`.
2. Is it the app shell or composition root? → `app/`.
3. Otherwise → the one slice that uses it.
4. Another slice needs it? → export it from that slice's `index.ts`. Never import deeper
   (`@/features/other-slice/pages/...` is a lint error).
5. Colocate the test beside the unit.

Full checklist detail, the global string-coupling contract (persist keys, shared React
Query keys, duplicated Sidebar route strings, global i18n files), and slice split/merge
criteria: `docs/CONVENTIONS.md`.

## CI gates

Each gate is its own job, so the checks list says what broke without anyone opening a log.

| Job | What it proves |
| --- | --- |
| `Server (lint, typecheck, test)` | ESLint clean of errors and **not above the warning ratchet**, `tsc --noEmit`, the full suite with a real PostgreSQL, plus a guard that the real-PG suites were not silently skipped. |
| `Migrations (up, down, re-apply)` | Every `.down.sql` actually reverses its `.sql`. |
| API documentation drift (a step on the server job) | Every route the router serves is documented, manifested, and describes its request shape with the schema that validates it; and nothing is documented that is not served. |
| `Client (lint, typecheck, test)` | ESLint, `tsc --noEmit`, vitest. |
| `E2E smoke (pull requests)` | The money paths, under a ~3 minute budget. |
| `E2E full (main)` / `E2E settings` | The sharded suite and the serial settings project. |

### Ratchets

Two numbers in this repo are ratchets, and they follow the same rule.

| Ratchet | Where | Today |
| --- | --- | --- |
| ESLint warnings | `--max-warnings` in `server/package.json` | `384`, essentially all `@typescript-eslint/no-explicit-any` |
| Operations with no request contract | `EXPECTED_UNCONVERTED` in `server/src/docs/requestContracts.ts` | `3` of 192 — the health probes |
| Operations accounted for by neither | `EXPECTED_UNCLASSIFIED`, same file | `0`, and it must stay there |

**Never raise one. Lower it in the same commit that earns the reduction.** A ratchet left
above the true count has silently stopped ratcheting, which is why the contract one is an
exact count rather than a ceiling and fails in both directions. The lint number exists
because errors were already fatal while warnings gated nothing, so nothing stopped the
next `any` from landing; it has gone 391 → 385 → 384, and lowering it further is #47's work.

The two contract numbers answer different questions on purpose. `EXPECTED_UNCONVERTED`
counts what is *derived* and moves only on real conversion; `EXPECTED_UNCLASSIFIED` counts
what is *accounted for*, and writing an explanation moves only the second. One number would
have let the API reach zero by documenting reasons instead of schemas.

### Migration verification

Every `.down.sql` must actually reverse its `.sql`, and CI proves it. Details, the
`Intentionally a no-op.` marker, and how to run it: `server/CLAUDE.md`.

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

Three projects: a `setup` project that logs in through the real form, a `fullyParallel`
`pos-parallel` project, and a serial `pos-settings` project that is the **only** place
permitted to write `PUT /api/v1/settings` — tax and loyalty are global rows, so a write
from a parallel worker changes the totals every other worker is asserting on.

`@smoke` is the pull-request gate, budgeted under three minutes; the full sharded suite
runs on `main`. Read `docs/CONVENTIONS.md` → *E2E test conventions* before adding specs.

## Git Workflow

- **Always branch from `main`** before starting a feature (`feature/xxx`, `fix/xxx`).
- Commit frequently, with messages that say why rather than what.
- Merge back via PR.

## Build Warnings

Chunk size warning (>500KB) is expected for the SPA bundle — safe to ignore.

## Learnings

Project-specific quirks and decisions worth not rediscovering. Keep under 20 entries and
prune stale ones; anything cross-project belongs in the global instructions instead.

- The Segments page was written against an RFM endpoint the server never had: it read
  `GET /api/v1/segments`, which serves rule-authored segment records, and crashed on
  `data.summary.map`. RFM now lives at `GET /api/v1/analytics/customer-segments`, and the
  two features are unrelated despite the shared word (2026-09-09)
- HeroUI's `Input`/`Textarea` hold their own controlled value, so react-hook-form's
  `setValue` never reaches the DOM. Any programmatically-filled field needs `Controller`;
  the delivery customer picker had been silently failing to populate since it was written
  (2026-09-06)
- All 86 request bodies in the published OpenAPI document were
  `{ type: 'object', additionalProperties: true }` — the spec said nothing about what to
  send, so deriving request schemas is additive and needs no consumer audit. That premise
  does not carry to responses (2026-09-06)
- `role="status"` on a `<td>` strips the cell of its table semantics, and a live region
  rendered alongside its own message has no content change to announce — it must be
  mounted beforehand (2026-09-06)
- The a11y `jsx-a11y` rules are at `error` and *docs/ACCESSIBILITY.md* Known gaps is empty;
  record the next gap there with an issue rather than only dropping a rule (2026-09-06)
- A `route.fulfill` carrying `Access-Control-Allow-Origin: '*'` never reaches the client:
  the transport sets `withCredentials: true`, so the browser rejects the wildcard and the
  app takes its network-failure path instead of the status being faked. A test built on
  one can still pass — it just proves something else (2026-09-07)
- Playwright's `element is not stable` on the POS grid is `useAutoAnimate` animating cards
  out, not a slow render. It reads identically to a moving element and ends in
  `element was detached from the DOM` (2026-09-07)
- `purchase_orders_status_check` (009) never actually admitted `'Sent'` or
  `'Partially Received'` — the server enum, TS union, client chips/filters and i18n keys
  all used those spellings anyway, so any status write past `Draft` was an unmapped 23514
  since 009 shipped. Migration 010 narrowed the constraint to the app's five values; the
  application vocabulary won over the three lowercase legacy spellings 009 had tolerated
  (2026-09-09)
- `refunds.items` is a `TEXT` column holding JSON and is the **only** record of how much
  of each sale line has been refunded — there is no `refund_items` table. It is parsed in
  `findRefundsBySaleId`, not by callers; handed on as a string it is still iterable, so a
  consumer reads it character by character and silently sees no prior refunds (2026-09-09)
- A refund and an exchange are two routes to the same recovery and draw on one sold
  quantity, so each caps against the other's history. Capping one alone leaves the
  opposite direction open, and it is easy to close only the direction the issue named
  (2026-09-09)
- Zod strips unknown keys, so a field missing from a request schema never reaches the
  service however carefully the service handles it. `bundle_id` was absent from
  `saleItemSchema`, so `resolveBundleGroup` had never executed — while service-level tests
  that called past the schema passed the whole time. Test the boundary, not just the
  service (2026-09-09)
- pg-mem diverges from PostgreSQL in ways a green suite hides, so anything that depends on
  either difference is proven only on real PostgreSQL. It reports `err.code` for a unique
  violation but **not** `err.constraint`, so logic that narrows by constraint name — the
  document-number retry — never takes the narrowed branch there. And it returns `NUMERIC`
  as a JS number, where node-postgres returns a string (`"-5.00"`); the repo sets no
  `setTypeParser`, so a `typeof value === 'number'` branch behaves differently on each —
  which is why the CSV formula guard exempts plain decimal strings (2026-09-09, 2026-09-11)
- The cart line's `data-testid` is built from `lineKey`, and `e2e/support/locators.ts`
  rebuilds that same string by hand. Adding a segment to the key breaks every cart-line
  locator with no type error — seven smoke specs — so the two move together (2026-09-09)
- Postponed features are hidden by one list, `client/src/shared/lib/postponedFeatures.ts`,
  read by three consumers: the Sidebar filter, the `_admin` `beforeLoad` guard and the POS
  Bundles strip. A hidden path redirects to the user's default route instead of 404ing, and
  its code and tests stay compiled, so reactivating is a one-line removal plus the checklist
  in the file's header. The removed features' 14 tables stay dormant, with no drop, until
  the production reset or an export: some hold financial history, and a down migration can
  recreate a table but not its rows. See `server/CLAUDE.md` → *Dormant tables* (2026-09-11)
