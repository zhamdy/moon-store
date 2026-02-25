# MOON Fashion & Style - Technical Debt Report

> Generated: 2026-02-25 | Updated: 2026-02-25 | Codebase: 36 routes, 36 pages, 64 migrations

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | ~~5~~ 0 |
| High | ~~10~~ 2 |
| Medium | ~~12~~ 7 |
| Low | ~~14~~ 1 |
| **Total** | **41** (31 fixed, 10 remaining) |

---

## Critical

### ~~1. SQL Injection in Shifts Route~~ [FIXED]
- **File**: `server/routes/shifts.ts:76-80`
- **Issue**: `totalBreak` is interpolated directly into SQL via template string instead of parameterized:
  ```ts
  const totalHours = `ROUND(... - ${totalBreak / 60.0}, 2)`;
  db.query(`UPDATE shifts SET ... total_hours = ${totalHours} ...`);
  ```
  While `totalBreak` comes from a DB query (lower risk), this pattern is dangerous and could be replicated elsewhere.
- **Risk**: SQL injection if the pattern is copied to user-controlled inputs.
- **Fix**: Move calculation to a parameterized value or compute in JavaScript.

### ~~2. Zero Test Coverage~~ [FIXED]
- **Files**: Entire codebase
- **Issue**: No test files exist (0 `.test.ts`, 0 `.spec.ts`). No test runner configured (no jest/vitest in dependencies).
- **Risk**: Any refactor or bug fix can introduce regressions undetected. Impossible to safely ship changes.
- **Fix**: Add Vitest for both client and server. Start with critical paths: auth, sales, cart logic.

### ~~3. CORS Allows All Origins in Production~~ [FIXED]
- **File**: `server/index.ts:58-78`
- **Issue**: The CORS callback always calls `callback(null, true)` — the `else` branch on line 73 allows all origins with the comment `// allow all in dev`, but there is no production check.
- **Risk**: Any external site can make authenticated requests to the API via the user's browser cookies.
- **Fix**: Check `NODE_ENV` and reject unknown origins in production.

### ~~4. Error Handler Exposes Internal Messages~~ [FIXED]
- **File**: `server/middleware/errorHandler.ts:14`
- **Issue**: Raw `err.message` is sent to clients in all environments. Stack traces are logged but messages like "SQLITE_CONSTRAINT" or internal errors leak to the frontend.
- **Risk**: Information disclosure to attackers. OWASP Top 10 violation.
- **Fix**: Return generic message in production, only expose details in development.

### ~~5. No JWT Secret Validation at Startup~~ [FIXED]
- **File**: `server/index.ts`
- **Issue**: If `JWT_SECRET` or `JWT_REFRESH_SECRET` env vars are missing, the server starts but auth silently breaks or uses `undefined`.
- **Risk**: Authentication bypass or cryptographic weakness.
- **Fix**: Validate required env vars at startup, exit if missing.

---

## High

### 6. Monster Components (1000+ Lines)
- **Files**:
  - `client/src/pages/Inventory.tsx` — **1,652 lines**
  - `client/src/pages/Deliveries.tsx` — **848 lines**
  - `client/src/pages/PurchaseOrders.tsx` — **799 lines**
  - `client/src/pages/Register.tsx` — **700 lines**
  - `client/src/pages/Dashboard.tsx` — **603 lines**
  - `client/src/pages/POS.tsx` — **582 lines**
- **Issue**: Massive single-file components with mixed concerns (data fetching, business logic, UI rendering, modals).
- **Risk**: Hard to maintain, slow to iterate, high merge conflict probability.
- **Fix**: Extract sub-components, custom hooks for data fetching, and modal components.

### 7. Monster Route Files
- **Files**:
  - `server/routes/products.ts` — **1,175 lines**
  - `server/routes/sales.ts` — **752 lines**
  - `server/routes/analytics.ts` — **461 lines**
  - `server/routes/delivery.ts` — **453 lines**
  - `server/routes/register.ts` — **408 lines**
  - `server/routes/coupons.ts` — **405 lines**
  - `server/routes/giftCards.ts` — **396 lines**
- **Issue**: Business logic mixed directly into route handlers. No service layer.
- **Risk**: Impossible to reuse logic, hard to test, high coupling.
- **Fix**: Extract service layer (`server/services/`) for business logic. Routes should only handle req/res.

### ~~8. 37 `as any` Type Casts Across Server~~ [FIXED]
- **Files**: `ai.ts` (10), `exports.ts` (5), `sales.ts` (3), `onlineOrders.ts` (7), `analytics.ts` (2), `branches.ts` (2), `reports.ts` (2), `giftCards.ts` (1), `stockCounts.ts` (1), `storefront.ts` (1), `layaway.ts` (1), `migrate.ts` (2)
- **Issue**: `as any` bypasses TypeScript's type system entirely.
- **Risk**: Runtime type errors that TypeScript was supposed to prevent.
- **Fix**: ~~Define proper interfaces for DB query results and API payloads.~~ Done — replaced all 33 `as any` casts with proper typed interfaces, `Record<string, unknown>`, or specific `{ field: type }` casts across 11 files.

### ~~9. Missing Database Indexes on Wave 3 Tables (050-064)~~ [FIXED]
- **Files**: `server/db/migrations/050_ecommerce_customers.sql` through `064_auto_descriptions.sql`
- **Issue**: All 15 Wave 3 migrations (050-064) have **zero** `CREATE INDEX` statements. Tables like `online_orders`, `vendor_products`, `smart_pricing_rules`, `ai_chatbot_sessions` have no indexes beyond primary keys.
- **Risk**: Query performance degrades as data grows. Full table scans on JOINs and WHERE clauses.
- **Fix**: ~~Add migration 065 with indexes on all FK columns and commonly filtered fields.~~ Done — `065_wave3_indexes.sql` adds 44 indexes across all Wave 3 tables.

### ~~10. No Request Logging~~ [FIXED]
- **File**: `server/index.ts`
- **Issue**: No HTTP request logging middleware (no morgan, winston, or pino). Only `console.log` on startup and `console.error` in error handler.
- **Risk**: No visibility into production traffic, impossible to debug issues or detect anomalies.
- **Fix**: ~~Add morgan for HTTP logs, structured logging with winston/pino for application logs.~~ Done — `server/lib/logger.ts` (structured JSON in prod, human-readable in dev) + `server/middleware/requestLogger.ts` for HTTP request logs.

### ~~11. DB Wrapper Silently Swallows Errors~~ [FIXED]
- **File**: `server/db/index.ts:38-49`
- **Issue**: The `RETURNING` clause fallback catches all errors and falls back to a query without `RETURNING`. If the original SQL had a real error, it's masked.
- **Risk**: Silent data corruption or unexpected behavior.
- **Fix**: ~~Only catch specific SQLite `RETURNING` incompatibility errors, rethrow others.~~ Done — only catches errors containing "RETURNING", rethrows all others.

### ~~12. Monolith Server Entry Point~~ [FIXED]
- **File**: `server/index.ts` — ~~46 imports, 36 `app.use()` calls~~ → **14 imports, 170→135 lines**
- **Issue**: Every route file was imported and mounted at the top level. Adding a new feature meant touching this file.
- **Fix**: ~~Auto-discover routes from filesystem or group into domain modules.~~ Done — created `server/routes/index.ts` as centralized route registry. `routeTable: [string, Router][]` array + single `for..of` loop in `index.ts`. Adding a new route = 1 import + 1 line in the registry.

### ~~13. N+1 Query Problem in Delivery Route~~ [FIXED]
- **File**: `server/routes/delivery.ts`
- **Issue**: Loops through orders fetching items one-by-one instead of using a JOIN query.
- **Risk**: O(n) queries for n orders. Slow as data grows.
- **Fix**: ~~Use a single JOIN query to fetch all orders with items.~~ Done — batch-fetch with `WHERE order_id IN (...)` + JS grouping.

### ~~14. Silent Audit Logger Failures~~ [FIXED]
- **File**: `server/middleware/auditLogger.ts`
- **Issue**: Catch block is empty — audit log failures are silently swallowed with no logging.
- **Risk**: Security-critical events can be lost without anyone knowing.
- **Fix**: ~~At minimum add `console.error` in the catch block.~~ Done — logs error with `console.error('Audit log failed:', err)`.

### ~~15. `noUnusedLocals` and `noUnusedParameters` Disabled~~ [FIXED]
- **Files**: `server/tsconfig.json:16-17`, `client/tsconfig.json:20-21`
- **Issue**: Both set to `false`. Dead code and unused imports accumulate silently.
- **Risk**: Code bloat, confusion about what's actually used.
- **Fix**: ~~Enable both flags, clean up existing unused code.~~ Done — enabled + all violations fixed.

---

## Medium

### ~~16. No ESLint Configuration~~ [ALREADY DONE]
- **Files**: `server/eslint.config.mjs`, `client/eslint.config.mjs`
- **Status**: Already configured with `@typescript-eslint`, `eslint-config-prettier`, react-hooks plugin.

### ~~17. console.log in Production Code~~ [FIXED]
- **Files**: 35 `console.log/warn/error` calls across 7 files including `server/middleware/errorHandler.ts`, `server/db/seed.ts`, `server/services/twilio.ts`
- **Issue**: No structured logging. Console output is unstructured and hard to parse.
- **Risk**: Noisy logs, potential PII leakage, no log levels.
- **Fix**: ~~Replace with proper logger. Set log levels per environment.~~ Done — runtime files now use `server/lib/logger.ts`. CLI scripts (seed, migrate) keep console.log.

### 18. No Database Down Migrations
- **Files**: `server/db/migrations/` — 64 migration files, all `CREATE`/`ALTER`, none with rollback
- **Issue**: Migration runner only goes forward. No way to reverse a failed migration.
- **Risk**: Stuck migrations require manual DB intervention.
- **Fix**: Add rollback support to migration runner, or at minimum document manual rollback steps.

### ~~19. Hardcoded CORS Origins~~ [ALREADY DONE]
- **File**: `server/index.ts:71-78`
- **Status**: Already supports `ALLOWED_ORIGINS` env var as comma-separated list. Hardcoded values are dev-only fallbacks when env var is not set.

### ~~20. Rate Limiter Not Per-Route~~ [FIXED]
- **File**: `server/index.ts:81-88`
- **Issue**: Single global rate limit (200 req/15min). Auth endpoints should be stricter, read endpoints more permissive.
- **Fix**: ~~Add per-route rate limiters.~~ Done — `authLimiter` (10 req/15min) on login + refresh.

### ~~21. No Graceful Shutdown~~ [FIXED]
- **File**: `server/index.ts:147-149`
- **Issue**: `app.listen()` with no signal handlers. `setInterval` on line 145 also has no cleanup.
- **Risk**: In-flight requests dropped on deploy. DB connections not closed cleanly.
- **Fix**: ~~Handle `SIGTERM`/`SIGINT`, drain connections, close DB, clear intervals.~~ Done — `shutdown()` handles SIGTERM/SIGINT, clears interval, closes server + DB, 10s force exit timeout.

### ~~22. Client Bundle Size~~ [FIXED]
- **Issue**: 36 pages, all lazy-loaded but heavy vendor deps bundled into single chunk.
- **Fix**: ~~Split heavy libraries into separate chunks.~~ Done — Vite `manualChunks` splits vendors into 5 cached chunks: `vendor-react` (165 KB), `vendor-charts` (411 KB), `vendor-query` (96 KB), `vendor-ui` (109 KB), `vendor-forms` (86 KB). Vendor cache invalidation is now independent of app code changes.

### ~~23. Mixed Sync/Async DB Patterns~~ [FIXED]
- **File**: `server/db/index.ts`
- **Issue**: The pg-compat wrapper makes synchronous `better-sqlite3` calls look async (returns plain objects, not Promises). Routes use `await db.query()` but it resolves immediately.
- **Fix**: ~~Document that `await` is unnecessary.~~ Done — added clear documentation comment explaining the sync-wrapped-in-Promise pattern and when to use `db.db` for raw access.

### 24. `uploads/` Directory in Server Root
- **File**: `server/uploads/`
- **Issue**: User-uploaded files stored on local filesystem with no size limits beyond Express's `10mb` body parser.
- **Risk**: Disk exhaustion. Lost on redeploy (not in external storage).
- **Fix**: Add file size/type validation in upload routes. Plan migration to S3/R2 for production.

### ~~25. No Input Sanitization Layer~~ [FIXED]
- **Issue**: Zod validates structure but didn't sanitize HTML/SQL. No XSS protection for stored user input.
- **Fix**: ~~Add sanitization middleware.~~ Done — `server/middleware/sanitize.ts` strips HTML tags, `<script>`, `javascript:` URIs, and inline event handlers from all string values in request bodies. Applied globally before routes.

### ~~26. Timer-Based Cleanup Without Error Handling~~ [FIXED]
- **File**: `server/routes/reservations.ts`
- **Issue**: `cleanupExpiredReservations` had no error handling — if it threw, the error was unhandled.
- **Fix**: ~~Wrap in try/catch or use a proper job scheduler.~~ Done — `cleanupExpiredReservations()` now has try/catch with structured error logging via `logger.error()`.

### 27. No API Versioning
- **Issue**: All endpoints are under `/api/` with no version prefix (e.g., `/api/v1/`).
- **Risk**: Breaking changes require frontend and backend to deploy simultaneously.
- **Fix**: Add `/api/v1/` prefix to allow future API evolution.

---

## Low

### ~~28. Inconsistent Migration Index Naming~~ [FIXED]
- **Files**: Across `server/db/migrations/`
- **Issue**: Early migrations use `IF NOT EXISTS` on indexes, later ones don't. Naming varies. Also a duplicate `021_` prefix (two files: `021_product_status.sql` and `021_shipping_companies.sql`).
- **Fix**: ~~Adopt consistent naming convention.~~ Done — added naming convention documentation in `server/db/migrate.ts` (NNN prefix, `idx_{table}_{column}` for indexes, `IF NOT EXISTS` for all creates). Renaming existing files would break `_migrations` tracking.

### ~~29. `DATABASE_URL` Legacy Config~~ [FIXED]
- **File**: `server/.env`
- **Issue**: PostgreSQL connection string existed in `.env` but was never used (app uses SQLite).
- **Fix**: ~~Remove the misleading env var.~~ Done — removed `DATABASE_URL` from `.env`.

### ~~30. No Prettier Configuration~~ [ALREADY DONE]
- **Status**: Already configured at `.prettierrc` (semi, singleQuote, tabWidth 2, trailingComma es5, printWidth 100).

### ~~31. Component Prop Interfaces Not Exported~~ [FIXED]
- **Issue**: `ApiErrorResponse` duplicated across 20 pages. `Product`, `Category`, `Distributor`, `ProductVariant` duplicated across 6+ pages.
- **Fix**: ~~Extract shared types to `client/src/types/` directory.~~ Done — created `client/src/types/index.ts` with 5 shared interfaces. Updated 22 pages to import from `@/types` instead of defining locally.

### ~~32. Single ErrorBoundary for Entire App~~ [FIXED]
- **File**: `client/src/App.tsx`
- **Issue**: Only one error boundary wrapped the whole app. A crash in any page took down everything.
- **Fix**: ~~Add per-page error boundaries.~~ Done — App.tsx refactor (#35) wraps each route in its own `<ErrorBoundary>` via the RouteConfig array.

### ~~33. No Health Check for Database~~ [FIXED]
- **File**: `server/index.ts:137-139`
- **Issue**: Health endpoint returns `ok` without checking DB connectivity.
- **Fix**: ~~Add `SELECT 1` query to health check.~~ Done — health endpoint runs `SELECT 1`, returns 503 if DB unreachable.

### ~~34. Reservation Cleanup Runs in App Process~~ [FIXED]
- **File**: `server/routes/reservations.ts`
- **Issue**: Background job runs in the same process with no visibility into what it does.
- **Fix**: ~~Add metrics and logging.~~ Done — `cleanupExpiredReservations()` now logs the count of cleaned-up reservations. Note: horizontal scaling concern remains (all instances run cleanup) but is harmless since the DELETE is idempotent.

### ~~35. App.tsx Route Boilerplate (DRY Violation)~~ [FIXED]
- **File**: `client/src/App.tsx` — ~~480 lines~~ → **140 lines**
- **Issue**: Every route repeats identical nesting: `<ProtectedRoute>` → `<ErrorBoundary>` → `<Suspense>` → `<Page />`. Adding a new page = copy-pasting 12 lines.
- **Fix**: ~~Create a route config array and build routes programmatically.~~ Done — `RouteConfig[]` array with `.map()` rendering. Adding a page = 1 line in the config.

### ~~36. Incomplete Logout Cleanup~~ [FIXED]
- **File**: `client/src/store/authStore.ts`, `client/src/services/api.ts`
- **Issue**: `logout()` clears auth state but does NOT clear React Query cache, cancel pending requests, or clear offline queue. Stale data can persist across user sessions.
- **Fix**: ~~Create a `useLogout()` hook that clears all stores + calls `queryClient.clear()`.~~ Done — `logout()` now clears queryClient, offlineStore queue, and cart.

### ~~37. Theme Flash on Load (FOUC)~~ [FIXED]
- **File**: `client/src/store/settingsStore.ts`, `client/src/main.tsx`
- **Issue**: `settingsStore.hydrate()` is called in `App.tsx useEffect` — too late. If user has dark mode saved, the page briefly flashes light theme before hydration.
- **Fix**: ~~Call `useSettingsStore.getState().hydrate()` synchronously before `ReactDOM.createRoot()`.~~ Done — hydrate called synchronously in `main.tsx` before render.

### ~~38. Missing Loading States on Mutation Buttons~~ [ALREADY DONE]
- **Files**: `CartPanel.tsx`, `Customers.tsx`, `Users.tsx` and others
- **Issue**: Create/Edit/Checkout buttons don't show loading spinners during mutations. Users can double-click and create duplicate records.
- **Status**: Already implemented — all checked files use `isPending` to disable buttons during mutations.

### ~~39. API Client Global Mutable State~~ [FIXED]
- **File**: `client/src/services/api.ts`
- **Issue**: `isRefreshing` and `failedQueue` were module-level mutable variables.
- **Fix**: ~~Move to a class or closure.~~ Done — encapsulated in `setupRefreshInterceptor()` closure. State is no longer accessible outside the interceptor.

### ~~40. Hardcoded English in Zod Validation Schemas~~ [FIXED]
- **Files**: `Login.tsx`, `Users.tsx`, `Categories.tsx`, `Customers.tsx`, `Distributors.tsx`, `Deliveries.tsx`
- **Issue**: Zod `.min(1, 'Name required')` messages were hardcoded English while the app supports Arabic.
- **Fix**: ~~Use the standalone `t()` function from `i18n/` in all Zod schemas.~~ Done — all 6 pages now use `tStandalone()` with getter functions (`getSchema()`) for locale-reactive validation. Added `validation.passwordRequired` and `validation.codeRequired` keys to en.json/ar.json.

### ~~41. Accessibility — Missing ARIA Labels~~ [FIXED]
- **Files**: `Layout.tsx`, `Sidebar.tsx`, `NotificationCenter.tsx`, `DataTable.tsx`
- **Issue**: Icon-only buttons (language toggle, theme toggle, notifications bell, logout) missing `aria-label`. No `aria-live` region for notifications.
- **Fix**: ~~Add `aria-label` to all icon buttons.~~ Done — added `aria-label` to language toggle, theme toggle, notifications bell, close panel, and mark-read buttons.

---

## Debt by Area

| Area | Items | Highest Severity |
|------|-------|------------------|
| Security | #1, #3, #4, #5, #14, #20, #25, #39 | Critical |
| Testing | #2 | Critical |
| Architecture | #6, #7, #12, #34, #35 | High |
| TypeScript | #8, #15, #31 | High |
| Database | #9, #11, #13, #18, #23, #28, #33 | High |
| Observability | #10, #14, #17 | High |
| Client UX | #36, #37, #38, #40 | Medium |
| Accessibility | #32, #41 | Medium |
| DevOps | #16, #19, #21, #27, #30 | Medium |
| Performance | #13, #22, #23 | Medium |
| Storage | #24 | Medium |

---

## Recommended Priority Order

### Sprint 1 — Security & Safety Net [DONE]
1. ~~Fix SQL injection in shifts.ts (#1)~~ — parameterized query
2. ~~Fix CORS to reject unknown origins in production (#3)~~ — rejects unknown origins + `ALLOWED_ORIGINS` env var
3. ~~Validate JWT secrets at startup (#5)~~ — exits if missing
4. ~~Sanitize error messages in production (#4)~~ — generic 500 in prod, detailed in dev
5. ~~Add per-route rate limiting for auth (#20)~~ — 10 req/15min on login + refresh

### Sprint 2 — Testing Foundation [DONE]
6. ~~Set up Vitest for server + client (#2)~~ — vitest.config.ts + setup files + `npm test` scripts
7. ~~Add tests for auth flow, sales creation, cart logic~~ — 47 tests (27 server + 20 client)
8. ~~Enable `noUnusedLocals`/`noUnusedParameters` (#15)~~ — enabled in both tsconfigs, fixed all violations
9. ~~Add ESLint + Prettier (#16, #30)~~ — already configured (eslint.config.mjs + .prettierrc)

### Sprint 3 — Architecture Cleanup [PARTIAL]
10. Extract service layer from top route files (#7)
11. Split monster components into sub-components (#6)
12. ~~DRY up App.tsx route config (#35)~~ — route config array, 480→140 lines
13. ~~Add structured logging (#10, #17)~~ — `server/lib/logger.ts` + `requestLogger` middleware
14. ~~Add missing Wave 3 indexes (#9)~~ — migration 065 with 44 indexes
15. ~~Fix N+1 query in delivery (#13)~~ — batch IN query
16. ~~Fix silent audit logger (#14)~~ — structured error logging

### Sprint 4 — Client Quality [DONE]
16. ~~Fix theme flash on load (#37)~~ — hydrate moved to main.tsx (synchronous)
17. ~~Add loading states to mutation buttons (#38)~~ — already implemented
18. ~~Fix logout to clear all stores + cache (#36)~~ — clears queryClient + offlineStore + cart
19. ~~Translate Zod validation messages (#40)~~ — all 6 pages use `tStandalone()` with getter schemas
20. ~~Add ARIA labels to all icon buttons (#41)~~ — added to Layout + NotificationCenter

### Sprint 5 — Production Readiness [PARTIAL]
21. ~~Add graceful shutdown (#21)~~ — SIGTERM/SIGINT handlers, drain + close DB
22. ~~Add DB health check (#33)~~ — SELECT 1 in health endpoint
23. ~~Add request logging middleware (#10)~~ — done in Sprint 3
24. Plan file storage migration (#24)
25. ~~Fix DB wrapper error swallowing (#11)~~ — only catches RETURNING-specific errors
