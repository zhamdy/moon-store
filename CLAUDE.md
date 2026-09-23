# MOON Fashion & Style

Luxury fashion retail management: a React SPA point of sale over an Express + PostgreSQL
API. This file is always loaded and holds what is true across both halves. The subsystem
contracts load on demand, when you work in the tree they govern.

## Quick Start

Run `pnpm install` at the repository root first. The workspace contains
`apps/dashboard`, `apps/server`, and `apps/storefront` (a Next.js storefront: a
prerendered homepage whose New Arrivals carousel reads the public catalog and falls
back to a static set without one, plus Shop, category, New In, Collections and product
detail pages rendered from the server's public catalog API, and a guest bag (Add to Bag, a header drawer and `/bag`)
priced by the server's cart quote; a Checkout base UI that collects contact and delivery
details and stops at a commerce seam with no order behind it, switched off in production
builds by `NEXT_PUBLIC_CHECKOUT_ENABLED` until a commerce strategy exists).
Use `pnpm dev:storefront` for it on port 3000; copy `apps/storefront/.env.example` to
`apps/storefront/.env.local` first (see `apps/storefront/CLAUDE.md` for what each
variable does). The catalog pages need the API running on a database with migration 014
and the seed applied; `CATALOG_SERVER_TOKEN` (matching the API's) and `MEDIA_ORIGIN` are
set in the storefront env, the latter before `next build`. The bag calls the API from the
browser, so it also needs `NEXT_PUBLIC_API_URL` at build and the storefront's origin in the
server's `STOREFRONT_ORIGINS` (dev default `http://localhost:3000`).

```bash
# Terminal 1 — Server (port 3001)
cd apps/server && npm run migrate && npm run seed && npm run dev

# Terminal 2 — Client (port 5173)
cd apps/dashboard && npm run dev
```

## Default Logins

| Email          | Password    | Role     |
| -------------- | ----------- | -------- |
| admin@moon.com | admin123    | Admin    |
| sarah@moon.com | cashier123  | Cashier  |
| james@moon.com | delivery123 | Delivery |

## Subsystem contracts

- **`apps/server/CLAUDE.md`** — the API contract and its two gates, rate-limit bucketing,
  idempotency, optimistic concurrency, typed error contracts, scheduled jobs, media
  storage, refresh-token rotation, migration verification.
- **`apps/dashboard/CLAUDE.md`** — the offline queue replay contract, PWA install/update policy,
  react-hook-form on HeroUI inputs, the accessibility rules and patterns.
- **`apps/storefront/CLAUDE.md`** — the token/utility vocabulary and the `--surface-*`
  indirection, locale/RTL rules, the client boundary rule, the header boundary contract,
  the motion primitives, the image pipeline and swap procedure, the API client's DTO
  rule and `API_URL` vs `NEXT_PUBLIC_API_URL`, the logo swap procedure. Nothing is
  shared with the dashboard.
- **`e2e/README.md`** — ownership, the flake policy, and what the suite has already found.
- **`docs/CONVENTIONS.md`** — placement detail, the string-coupling contract, E2E
  conventions. **`docs/ACCESSIBILITY.md`** — what is scanned, what is manual, what is not
  proven.

## Key Patterns

`apps/dashboard/src/` is three layers: `app/` (composition root — routing, shell, session wiring),
`features/` (nine domain slices), `shared/` (cross-cutting code, feature-agnostic).
`ls apps/dashboard/src/features` lists the slices; `docs/CONVENTIONS.md` has the dependency rules.

`apps/server/src/modules/` is grouped by domain (`core`, `inventory`, `commerce`, `pos`,
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
| Manifest authorization (a step on the server job) | Every `endpointDetailsManifest` entry is served, and its `authorization` matches the route's real `verifyToken` / `requireRole` chain, walked from `createApp()`. A route weaker than its manifest passes only as a counted `UNDER_PROTECTED_ROUTES` entry. |
| Client API paths (a step on the server job) | Every `transport.request`, `useApiQuery` and `resource()` URL in `apps/dashboard/src` maps to a route `createApp()` serves. Calls into postponed features are reported, not failed; a dynamic path needs an explicit resolution. |
| `Client (lint, typecheck, test)` | ESLint, `tsc --noEmit`, vitest. |
| `Storefront (typecheck, lint, test, build)` | `tsc --noEmit`, ESLint, vitest (API client contract, translation-key parity), `next build`. |
| `E2E smoke (pull requests)` | The money paths, under a ~3 minute budget. |
| `E2E full (main)` / `E2E settings` | The sharded suite and the serial settings project. |

### Ratchets

Two numbers in this repo are ratchets, and they follow the same rule.

| Ratchet | Where | Today |
| --- | --- | --- |
| ESLint warnings | `--max-warnings` in `apps/server/package.json` | `384`, essentially all `@typescript-eslint/no-explicit-any` |
| Operations with no request contract | `EXPECTED_UNCONVERTED` in `apps/server/src/docs/requestContracts.ts` | `3` of 209 — the health probes |
| Operations accounted for by neither | `EXPECTED_UNCLASSIFIED`, same file | `0`, and it must stay there |
| Routes weaker than their manifest | `EXPECTED_UNDER_PROTECTED` in `apps/server/src/http/endpointManifest.ts` | `0`; any entry in `UNDER_PROTECTED_ROUTES` is an open owner decision |

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
`Intentionally a no-op.` marker, and how to run it: `apps/server/CLAUDE.md`.

## Testing

```bash
cd apps/server && npm test          # pg-mem suites; real-PostgreSQL suites report as skipped
cd apps/dashboard && npm test
cd apps/storefront && npm test      # API client contract and translation-key parity only
```

### Real-PostgreSQL suites

Concurrency and idempotency invariants (guarded relative writes, `FOR UPDATE`, unique-claim
races) cannot be proven on pg-mem — they need two genuinely concurrent connections. Those
suites use `describeWithPostgres` from `apps/server/tests/support/realPostgres.ts` and run only
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
npm run build --prefix apps/dashboard                 # deliberately its own step, not webServer
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
- `role="status"` on a `<td>` strips the cell of its table semantics, and a live region
  rendered alongside its own message has no content change to announce — it must be
  mounted beforehand (2026-09-06)
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
  consumer reads it character by character and silently sees no prior refunds. A refund
  and an exchange draw on that one sold quantity, so each caps against the other's
  history; capping one alone leaves the opposite direction open (2026-09-09)
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
- Postponed features are hidden by one list, `apps/dashboard/src/shared/lib/postponedFeatures.ts`,
  read by three consumers: the Sidebar filter, the `_admin` `beforeLoad` guard and the POS
  Bundles strip. A hidden path redirects to the user's default route instead of 404ing, and
  its code and tests stay compiled, so reactivating is a one-line removal plus the checklist
  in the file's header. The removed features' 14 tables stay dormant, with no drop, until
  the production reset or an export: some hold financial history, and a down migration can
  recreate a table but not its rows. See `apps/server/CLAUDE.md` → *Dormant tables* (2026-09-11)
- An e2e run used to delete the tracked images in `apps/server/uploads`: global setup empties
  every table, then the API Playwright starts runs `orphaned-media-cleanup`, which finds no
  `image_url` references and removes everything older than its 24h grace from the default
  `MEDIA_LOCAL_ROOT` — the real `apps/server/uploads`. The sweep is right for production; the
  harness pointed it at the wrong root. Fixed (#170) by setting `MEDIA_LOCAL_ROOT` to a
  per-run `os.tmpdir()` scratch directory in `e2e/playwright.config.ts`'s `webServer.env`;
  no manual `git restore` needed going forward (2026-09-11, fixed 2026-09-13)
- Under pnpm, a library `.d.ts` that imports `react` without a local `@types/react`
  resolves the hidden hoist `node_modules/.pnpm/node_modules/@types/react`, which holds
  whichever app's React types landed there. It cut both ways: the dashboard's React 18
  build failed with 457 JSX errors against the storefront's 19, and inside the storefront
  `@tanstack/react-query` saw the dashboard's 18 (`ReactNode` mismatch). Each app's
  `tsconfig.json` `paths` pins `react`/`react-dom` to its own `@types` (2026-09-13)
- Tailwind's `content` glob `./node_modules/@heroui/theme/dist/**` matched nothing after the
  pnpm move: npm had hoisted `@heroui/theme`, pnpm links only direct dependencies. The build
  still passed and every unit test stayed green while HeroUI's component CSS was missing;
  e2e smoke caught it as a radio whose dot intercepted the click. The dashboard now declares
  `@heroui/theme` itself — a path a config reaches into must belong to a direct dependency
  (2026-09-13)
- The bundle budget gate measured almost nothing from #98 on: the `from"./x.js"` regex in
  `apps/dashboard/scripts/bundleBudget.mjs` began with an invisible `\x08` byte, so each route
  counted only its own chunk and every budget was set from those numbers (`/pos` 15 KiB, real
  37; `/inventory` 11, real 125). It stayed green until a chunk split happened to land on a
  side-effect import. The script now fails on zero `from` imports; `cat -A` shows the byte
  where an editor shows nothing (2026-09-13)
- The storefront's semantic colours are `@theme inline`, so `text-text` compiles to the
  value and a scoped `--color-text` override does nothing — the header overlay and ink
  footer route through `--surface-*` variables instead, the same seam the locale font
  switch already used. And the gold logo is never recoloured: the hero is dusk-toned so
  gold and ivory read on it, with code scrims guaranteeing contrast rather than the
  image (2026-09-13)
- Every storefront page render calls the API from the Next server's one IP, so under the
  global per-IP limiter all shoppers would share 200 requests per 15 minutes. The public
  catalog therefore has its own limiter with a trusted `X-Catalog-Server-Token` bucket —
  which is *not* a per-shopper limit: one client varying query values can spend it, so
  per-client limiting is an edge requirement, not something the API can do (2026-09-14)
- An `UPDATE` re-checks every CHECK constraint, including one added `NOT VALID`. 004 left
  `products_stock_non_negative` unvalidated so legacy negative-stock rows could stay, so
  014's slug backfill would have aborted on those rows; it lifts and restores the
  unvalidated checks inside its block. Any later migration that updates `products` or
  `categories` rows needs the same (2026-09-14)
- Two more pg-mem traps, both silent: with a unique index on `slug` and mixed statuses,
  `status = 'active' AND slug IS NOT NULL` returns no rows (the shim rewrites it to
  `NOT (slug IS NULL)`); and `endpointHealth.test.ts` rewrote any SQL containing `OVER ()`,
  which matched a *comment* in migration 006, so that suite never had
  `collection_products.position`. A shim that matches SQL text must match statements, not
  prose (2026-09-14)
- A full-bleed section that pairs `aspect-*` with `max-h-*` stops being full-bleed at
  the width where the cap binds: the box holds its ratio by shrinking its **width**, so
  the photograph ends short of the viewport edge and the section's own background shows
  through the gap. It looks like a broken image, not a layout bug, and only appears past
  a certain width — 1900px for the campaign's 21:9 at `max-h-[40rem]`. Both the Silk Edit
  and the campaign hit it; both carry an explicit `w-full` beside the cap (2026-09-21)
- The homepage's static set (`apps/storefront/features/products/data/home-products.ts`) was
  authored to mirror the seed's vocabulary rather than from its real slugs, and nothing tied
  the two together, so it drifted: **five** of the nine product links the homepage published
  were 404s, not the two this entry originally named (`cross-body-leather-bag`, `silk-blouse`,
  `embroidered-evening-dress`, `velvet-evening-bag`, `wool-tailored-jacket`), and the cardigan
  read 2,750 against the seed's 2,400. Three were Moon Selection tiles, which render
  unconditionally in every build. Fixed by removing the product identity rather than
  re-keying the slugs: `HomeProductMock` has no `slug` and no `price`, so a product href
  cannot be built from it, and `ProductCardModel.href`/`price` are nullable for the
  editorial card. A mock set is not a catalogue and cannot track one — re-keying would have
  fixed five instances and kept the class (2026-09-21, fixed 2026-09-23)
- In the storefront, `next/dynamic` is not free for a component that never renders on the
  server: its loader runtime measured ~1.2 KB gz of extra eager JS on every page just to
  host the lazy Bag drawer. `React.lazy` + `Suspense` loads the same chunk at no eager cost.
  Measure the eager chunks of `.next/server/app/en.html` before and after any lazy-loading
  change; the method is in `apps/storefront/CLAUDE.md` → *Cart* (2026-09-15)
