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
| API documentation drift (a step on the server job) | Every route the router serves is documented and manifested, and nothing is documented that is not served. |
| `Client (lint, typecheck, test)` | ESLint, `tsc --noEmit`, vitest. |
| `E2E smoke (pull requests)` | The money paths, under a ~3 minute budget. |
| `E2E full (main)` / `E2E settings` | The sharded suite and the serial settings project. |

### Ratchets

Two numbers in this repo are ratchets, and they follow the same rule.

| Ratchet | Where | Today |
| --- | --- | --- |
| ESLint warnings | `--max-warnings` in `server/package.json` | `387`, essentially all `@typescript-eslint/no-explicit-any` |
| Unconverted request contracts | `EXPECTED_UNCONVERTED` in `server/src/docs/requestContracts.ts` | `196` of 203 served operations |

**Never raise one. Lower it in the same commit that earns the reduction.** A ratchet left
above the true count has silently stopped ratcheting, which is why the contract one is an
exact count rather than a ceiling and fails in both directions. The lint number exists
because errors were already fatal while warnings gated nothing, so nothing stopped the
next `any` from landing; it has gone 391 → 387, and lowering it further is #47's work.

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
