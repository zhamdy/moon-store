---
title: "refactor: Migrate backend to PostgreSQL-only modular monolith"
type: refactor
status: active
date: 2026-08-21
---

# Refactor: Migrate Backend to PostgreSQL-Only Modular Monolith

## Overview

Refactor the MOON Fashion POS backend from its current SQLite-based architecture (with a pg-compatibility wrapper) to a clean PostgreSQL-only modular monolith. The current system uses `better-sqlite3` as its actual database engine while wrapping all queries behind a fake `pg`-compatible interface. This creates a fragile abstraction that prevents using PostgreSQL features, makes the `pg` dependency misleading, and blocks production deployment on managed database services.

## Problem Frame

The MOON POS backend has a **dual-identity database problem**: it declares `pg` as a dependency and uses `$1, $2` parameterized query syntax throughout, but every query actually executes against a local SQLite file (`server/db/moon.db`) via `better-sqlite3`. A hand-built compatibility layer in `server/db/index.ts` converts PostgreSQL placeholders to `?` at runtime. This means:

1. **No actual PostgreSQL is used anywhere** — the `pg` package is dead weight
2. **65+ migration files use SQLite DDL** — `INTEGER PRIMARY KEY AUTOINCREMENT`, `datetime('now')`, `TEXT` for timestamps, SQLite-specific `PRAGMA` commands
3. **The seed system is SQLite-only** — directly uses `better-sqlite3` API, `sqlite_master`, `sqlite_sequence`
4. **The migration runner is SQLite-only** — uses `PRAGMA table_info`, `sqlite_master` queries
5. **Services use raw `db.db` (better-sqlite3 instance)** for transactions — these are synchronous SQLite transactions, not PostgreSQL transactions
6. **Tests create temporary SQLite databases** — they cannot verify PostgreSQL behavior
7. **The deployment config (render.yaml) runs on a free tier** with no database service — SQLite on an ephemeral filesystem means data loss on redeploy

Additionally, the backend lacks proper layering: 38 route files contain mixed HTTP handling, business logic, and direct database access. Only 7 of those routes have had services extracted.

---

## Phase 1: Architecture Audit (INSPECTION ONLY — NO MODIFICATIONS)

### 1. Current Architecture

#### Request Flow

```
Client (React SPA)
  ↓ HTTP (axios via shared/lib/transport/)
Express Server (server/index.ts)
  ↓
Global Middleware Stack:
  helmet → cors → rate-limit → json parser → cookie-parser → sanitizeBody → requestLogger
  ↓
Route Registry (server/routes/index.ts — 36 route entries)
  ↓
Route File (e.g., server/routes/sales.ts)
  ↓ verifyToken → requireRole (per-route middleware)
  ↓
Route Handler (inline async function)
  ↓ Zod validation (10 validator files exist, but not all routes use them)
  ↓ Business logic (sometimes in handler, sometimes in service)
  ↓ db.query() or db.db (raw SQLite) for transactions
  ↓
pg-compat wrapper (server/db/index.ts)
  ↓ Converts $1,$2 → ?, wraps sync calls in Promise.resolve()
  ↓
better-sqlite3 → server/db/moon.db (SQLite WAL mode)
  ↓
Response: { success: boolean, data?: any, meta?: any, error?: string }
```

#### Server Directory Structure

```
server/
├── index.ts                    # Express app setup (141 lines)
├── .env                        # Config (no DATABASE_URL — removed per TECH_DEBT)
├── package.json                # Dependencies
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.mjs
├── db/
│   ├── index.ts                # pg-compat SQLite wrapper (81 lines) ← CRITICAL
│   ├── migrate.ts              # Migration runner (148 lines, SQLite-only)
│   ├── seed.ts                 # Seed data (1101 lines, SQLite-only)
│   ├── moon.db                 # SQLite database file
│   └── migrations/             # 65+ SQL files (SQLite DDL) + 19 .down.sql files
├── routes/                     # 38 route files (index.ts + 37 domain routes)
│   ├── index.ts                # Route table registry
│   ├── auth.ts                 # 181 lines — login/refresh/logout/me
│   ├── products.ts             # 745 lines — largest route file (has service extracted)
│   ├── sales.ts                # 353 lines (has service extracted)
│   ├── purchaseOrders.ts       # 365 lines (NO service extracted)
│   ├── customers.ts            # 301 lines (NO service extracted)
│   ├── branches.ts             # ~500 lines (NO service extracted)
│   └── ... (31 more route files)
├── services/                   # 9 service files
│   ├── saleService.ts          # 462 lines — sale & refund transactions
│   ├── productService.ts       # ~600 lines — product CRUD
│   ├── analyticsService.ts     # ~580 lines — analytics queries
│   ├── deliveryService.ts      # ~400 lines
│   ├── registerService.ts      # ~350 lines
│   ├── couponService.ts        # ~300 lines
│   ├── giftCardService.ts      # ~280 lines
│   ├── notifications.ts        # ~110 lines
│   └── twilio.ts               # ~60 lines
├── middleware/                  # 7 middleware files
│   ├── auth.ts                 # JWT verify + role check
│   ├── errorHandler.ts         # Centralized error handling
│   ├── auditLogger.ts          # Audit log recording
│   ├── requestLogger.ts        # HTTP request logging
│   ├── sanitize.ts             # XSS/HTML stripping
│   ├── upload.ts               # Multer + magic byte validation
│   └── cache.ts                # Cache-Control headers
├── validators/                 # 10 Zod schema files
├── lib/
│   └── logger.ts               # Structured logger
├── tests/                      # 2 test files + setup
│   ├── auth.test.ts            # 177 lines (SQLite-based)
│   ├── sales.test.ts           # 281 lines (SQLite-based)
│   └── setup.ts
└── uploads/                    # Product images
```

#### Key Patterns Observed

- **Route files serve as both controller AND service** for ~31 of 37 domain routes — only 7 routes have extracted services
- **No repository layer exists** — all database access happens directly in route handlers or services via `db.query()` / `db.db`
- **Response shape is consistent**: `{ success: true/false, data?, meta?, error? }`
- **Auth is JWT-based**: access token (15min) + refresh token (7d httpOnly cookie)
- **API versioning**: all routes under `/api/v1/`
- **Zod validation exists** for 10 entities but ~27 routes have no Zod schema

---

### 2. Current Database Architecture

#### Where SQLite Is Used (EVERYWHERE)

| Component | File | SQLite Usage |
|-----------|------|-------------|
| Database connection | `server/db/index.ts` | `new Database(dbPath)` — better-sqlite3 |
| Query wrapper | `server/db/index.ts` | Converts `$1` → `?`, wraps sync in `Promise.resolve()` |
| Transaction API | `server/db/index.ts` | Exports `db.db` (raw better-sqlite3 instance) |
| Pool mock | `server/db/index.ts` | `pool.connect()` returns fake PoolClient wrapping SQLite |
| Migration runner | `server/db/migrate.ts` | `new Database(dbPath)`, `PRAGMA`, `sqlite_master` queries |
| Migration tracking | `server/db/migrate.ts` | `_migrations` table with `INTEGER PRIMARY KEY AUTOINCREMENT` |
| Schema reconciliation | `server/db/migrate.ts` | `PRAGMA table_info()`, `sqlite_master` lookups |
| Seed system | `server/db/seed.ts` | `new Database(dbPath)`, `sqlite_master`, `sqlite_sequence` |
| All 65+ migrations | `server/db/migrations/*.sql` | SQLite DDL: `AUTOINCREMENT`, `datetime('now')`, `TEXT` timestamps |
| Sale transactions | `server/services/saleService.ts` | `db.db.transaction(() => { ... })()` — synchronous |
| Product operations | `server/services/productService.ts` | `db.db.transaction()`, `db.db.prepare()` |
| Register operations | `server/services/registerService.ts` | `db.db.transaction()` |
| Gift card operations | `server/services/giftCardService.ts` | `db.db.transaction()` |
| Coupon operations | `server/services/couponService.ts` | `db.db.transaction()` |
| Auth tests | `server/tests/auth.test.ts` | `new Database(TEST_DB_PATH)` |
| Sales tests | `server/tests/sales.test.ts` | `new Database(TEST_DB_PATH)` |
| Health check | `server/index.ts` | `db.db.prepare('SELECT 1').get()` |
| Shutdown | `server/index.ts` | `db.db.close()` |

#### Query Volume

The codebase contains **336+ raw SQL queries** across 38 route files, 9 services, seed scripts, and tests:

| SQL Verb | Count | Typical Location |
|----------|-------|-----------------|
| `SELECT` | ~180 | routes, services |
| `INSERT` | ~85 | routes, services, migrations |
| `UPDATE` | ~55 | routes, services |
| `DELETE` | ~20 | routes, seed |
| `CREATE TABLE` | 68 | migrations, tests |
| `ALTER TABLE` | 42 | migrations |

Database transactions are used in **17+ locations** across 8 service files and 9 route files — all using synchronous `db.db.transaction(() => { ... })()` pattern.

#### Where PostgreSQL Is Used (NOWHERE)

The `pg` package (`^8.13.0`) is listed in `dependencies` but is **never imported or used** by any file. It is completely dead weight. The pg-compat wrapper in `server/db/index.ts` mimics the `pg` query interface (`{ rows }` return shape, `$1` placeholder syntax) but executes everything through `better-sqlite3`.

#### How the pg-Compat Layer Works

`server/db/index.ts` exports an object with three properties:

1. **`query(text, params)`** — Converts `$1, $2` placeholders to `?`, determines if the query is a SELECT/RETURNING/write, executes via `db.prepare().all()` or `db.prepare().run()`, wraps result in `Promise.resolve({ rows })`.

2. **`pool.connect()`** — Returns a fake `PoolClient` that delegates to the same synchronous `query()` function with a no-op `release()`. Used by routes that expect a pg pool client pattern.

3. **`db`** — Exposes the raw `better-sqlite3` Database instance. Used directly by services for transactions (`db.db.transaction(() => {...})()`).

#### SQLite-Specific Syntax in Migrations

All 65+ migration files use SQLite DDL:

- `INTEGER PRIMARY KEY AUTOINCREMENT` (PostgreSQL: `SERIAL` or `GENERATED ALWAYS AS IDENTITY`)
- `TEXT DEFAULT (datetime('now'))` for timestamps (PostgreSQL: `TIMESTAMPTZ DEFAULT NOW()`)
- `TEXT` type for dates/timestamps (PostgreSQL: `TIMESTAMPTZ`)
- `REAL` for decimal values (PostgreSQL: `NUMERIC` or `DECIMAL`)
- `CHECK` constraints inline (compatible but patterns differ)
- `REFERENCES` constraints inline in `CREATE TABLE` (compatible)
- No `BOOLEAN` type — uses `INTEGER` 0/1 (PostgreSQL: native `BOOLEAN`)

#### SQLite-Specific Syntax in Queries

Throughout route handlers and services:

- `datetime('now')` — PostgreSQL: `NOW()` or `CURRENT_TIMESTAMP`
- `date('now')` — PostgreSQL: `CURRENT_DATE`
- `date('now', 'start of month')` — PostgreSQL: `DATE_TRUNC('month', CURRENT_DATE)`
- `date('now', '-7 days')` — PostgreSQL: `CURRENT_DATE - INTERVAL '7 days'`
- `CAST(s.id AS TEXT) LIKE ?` — works in both but patterns differ
- `strftime('%Y-%m', date)` — PostgreSQL: `TO_CHAR(date, 'YYYY-MM')`
- Boolean as `1`/`0` — PostgreSQL: native `true`/`false`
- `LIKE` (case-sensitive in SQLite) vs `ILIKE` in PostgreSQL
- `GROUP BY s.id` without listing all selected columns (SQLite allows this, PostgreSQL doesn't by default)

#### How Migrations Currently Work

`server/db/migrate.ts`:
1. Opens a fresh `better-sqlite3` connection to `moon.db`
2. Creates `_migrations` tracking table (SQLite DDL)
3. Has a reconciliation step for the first 8 migrations (checks if tables/columns exist)
4. Reads `.sql` files from `migrations/` directory, sorted lexicographically
5. Skips files already in `_migrations` table
6. Executes each SQL file via `db.exec(sql)`
7. Supports `-- @FK_OFF` annotation to temporarily disable FK checks
8. Supports `--down [N]` for rollback using `.down.sql` files (19 exist)

#### How Seed Data Currently Works

`server/db/seed.ts` (1101 lines):
1. Opens a fresh `better-sqlite3` connection to `moon.db`
2. Disables foreign keys
3. Clears ALL data: queries `sqlite_master` for all tables, runs `DELETE FROM` on each
4. Resets autoincrement: deletes from `sqlite_sequence`
5. Re-enables foreign keys
6. Seeds: categories (11), users (3), distributors (5), products (30 with variants), customers (15), sales (40 random), delivery orders (8), settings (tax, loyalty), stock adjustments
7. Uses bcrypt.hashSync for passwords
8. All IDs are sequentially assigned (autoincrement from 1)

---

### 3. Problems

#### Critical

**C1. No actual PostgreSQL usage despite `pg` dependency**
- The `pg` package is in `dependencies` but never imported
- All data lives in a local SQLite file
- The pg-compat wrapper creates a false sense of PostgreSQL readiness
- **Impact**: Deployment to any managed service loses all data (ephemeral filesystem)

**C2. SQLite on ephemeral filesystem in production (render.yaml)**
- `render.yaml` deploys to Render's free tier — no persistent disk, no database service
- `startCommand: npm run migrate && npm run seed && npm run start` — re-seeds on every deploy
- **Impact**: Complete data loss on every deployment or redeploy

**C3. Synchronous SQLite transactions masquerading as async**
- `db.db.transaction(() => {...})()` is synchronous and blocks the Node.js event loop
- 6+ service files use this pattern for multi-step operations (sales, refunds, stock, registers)
- Under concurrent load, one sale transaction blocks all other requests
- **Impact**: Performance degradation and potential request timeouts under load

**C4. Client-supplied prices trusted in sale creation**
- `saleService.ts:calculateSaleTotals()` uses `item.unit_price` from client input to calculate subtotal
- While the service recalculates discounts, tax, and coupons server-side, the per-item price comes from the request body — it should be looked up from the database
- **Impact**: A malicious client can set arbitrary item prices

#### High

**H1. No separation between controllers and repositories**
- 31 of 37 route files have both HTTP logic AND direct database queries
- Only 7 routes have extracted services, and even those services directly call `db.query()`/`db.db`
- No repository layer exists anywhere
- **Impact**: Impossible to swap database, extremely hard to test business logic in isolation

**H2. SQLite-specific queries throughout the codebase**
- `datetime('now')`, `date('now', 'start of month')`, `strftime()` used across routes and services
- `sales.ts` stats endpoint uses `date(created_at) = date('now')` — SQLite-specific
- `analytics.ts` and `reports.ts` use extensive SQLite date functions
- **Impact**: Cannot switch to PostgreSQL without rewriting dozens of queries

**H3. Tests are coupled to SQLite**
- Both test files create temporary SQLite databases with `new Database()`
- Schema is manually recreated in each test file (not using migrations)
- Tests verify SQLite behavior, not application behavior
- **Impact**: Tests don't validate PostgreSQL compatibility; schema drift between tests and migrations

**H4. Missing Zod validation on ~27 routes**
- Only 10 validator files exist for 37 route domains
- Routes like `purchaseOrders.ts`, `branches.ts`, `analytics.ts`, `register.ts`, `shifts.ts`, `expenses.ts`, `vendors.ts`, `stockCounts.ts`, etc. do manual validation or none at all
- **Impact**: Inconsistent input validation, potential data integrity issues

**H5. Business logic in route handlers**
- PO number generation (`purchaseOrders.ts:generatePONumber`)
- Price calculation logic in route handlers
- Stock validation scattered across multiple routes
- Notification triggering from route handlers
- **Impact**: Logic duplication, hard to test, hard to maintain

**H6. Inconsistent transaction boundaries**
- Sale creation uses a proper SQLite transaction (saleService)
- Purchase order receiving in `purchaseOrders.ts` modifies stock without a transaction wrapper
- Stock adjustments in `stockAdjustments.ts` are single queries (no transaction)
- **Impact**: Data inconsistency if a multi-step operation partially fails

#### Medium

**M1. Mixed `?` and `$N` placeholder styles**
- Route files use `?` directly (SQLite native): `WHERE id = ?`
- The pg-compat wrapper converts `$1` → `?` but most code already uses `?`
- Some code uses `$1` style (expecting pg) — inconsistent
- **Impact**: Confusion about which style to use; harder migration

**M2. No connection pooling**
- SQLite is single-connection by nature; the mock `pool.connect()` is a no-op
- When migrating to PostgreSQL, proper `pg.Pool` management will be needed
- **Impact**: Must be implemented during migration

**M3. Seed system re-runs on every production deploy**
- `render.yaml`: `startCommand: npm run migrate && npm run seed && npm run start`
- Seed script clears all data before inserting
- **Impact**: Production data destroyed on every deployment

**M4. Large route files remain**
- `products.ts` (745 lines), `purchaseOrders.ts` (365 lines), `branches.ts` (~500 lines)
- Even routes with extracted services still have significant handler logic
- **Impact**: Hard to navigate, test, and maintain

**M5. `as any` and weak typing in route handlers**
- Multiple route handlers cast query results to `Record<string, any>`
- `sale.ts:63` uses `Record<string, any>` for sale result
- **Impact**: Runtime type errors, TypeScript benefits lost

**M6. Auth route has inline bcrypt, JWT, and DB logic**
- `auth.ts` (181 lines) has login, refresh, logout all in one file with no service extraction
- Login handler does: validation, DB lookup, bcrypt compare, JWT sign, DB insert, cookie set, audit log
- **Impact**: Hard to test auth logic independently

**H7. Warranty route not mounted (orphan endpoint)**
- `server/routes/warranty.ts` exists but is NOT listed in `routeTable` in `server/routes/index.ts`
- The frontend calls `/api/v1/warranty` endpoints (GET/POST/PUT) — all return 404
- **Impact**: Warranty feature is completely broken

**H8. Tip vs. Quick Discount inconsistency**
- Frontend `checkout.ts` calculates `amountDue = totalWithTax - pointsDiscount - tip` and presents this as "Quick Discount" in the UI (5%/10%/15% buttons)
- Backend `saleService.ts` stores `tip_amount` but does NOT subtract it from `totals.total`
- **Impact**: Cash register balances will be incorrect — customer pays discounted price but sale records full total

**H9. Purchase order creation lacks transaction wrapper**
- `purchaseOrders.ts` POST handler creates PO header and line items using sequential `await db.query()` calls
- If an item insert fails, the orphaned PO header remains in the database
- **Impact**: Partial PO records with no items

**H10. Incomplete offline queue payload**
- `CartPanel.tsx` `checkoutMutation.onError` reconstructs the offline payload but omits `payments` (split payments), `coupon_code`, `points_redeemed`, `notes`, and `tip`
- **Impact**: Offline sales lose split payment, coupon, loyalty, and note data when synced

**H11. Bundle pricing computed purely on frontend**
- When a bundle is added to cart, the frontend decomposes it into individual product lines with calculated `adjustedUnitPrice`
- The server has no validation that the bundle items or discounted prices match the active bundle configuration
- **Impact**: Bundle prices can be manipulated via network interception

#### Medium

**M7. SQLite scalar `MAX()` used as two-argument function**
- `routes/customers.ts` uses `MAX(0, loyalty_points + ?)` — SQLite allows scalar `MAX(a,b)`, but PostgreSQL only has aggregate `MAX()`
- PostgreSQL requires `GREATEST(0, loyalty_points + ?)` instead
- **Impact**: Will fail during PostgreSQL migration

**M8. `INSERT OR IGNORE` / `INSERT OR REPLACE` — SQLite-only conflict handling**
- Used in migrations 008, 014, 015, 044, 047 and in `seed.ts`
- PostgreSQL requires `ON CONFLICT ... DO NOTHING` / `ON CONFLICT ... DO UPDATE`
- **Impact**: Must be converted during migration

**M9. `julianday()` used for date arithmetic**
- `routes/shifts.ts` and `routes/segments.ts` use `julianday('now') - julianday(column)` for day/hour calculations
- PostgreSQL uses `EXTRACT(EPOCH FROM ...)` or `DATE_PART()` or `interval` arithmetic
- **Impact**: Must be converted during migration

**M10. Currency inconsistency in migration 047**
- `047_store_branches.sql` defaults currency to `SAR` (Saudi Riyal)
- `seed.ts` and the rest of the application use `EGP` (Egyptian Pounds)
- **Impact**: New branches would get wrong currency unless overridden

**M11. AI bulk descriptions endpoint is empty stub**
- `routes/ai.ts` `POST /descriptions/bulk` has an empty `for` loop body — does nothing
- **Impact**: Feature doesn't work; dead code in production

**M12. Public endpoints without rate limiting**
- `POST /api/v1/ai/chat/session` and `POST /api/v1/ai/chat/message` are public and unthrottled
- `POST /api/v1/online-orders` has no rate limiter or captcha protection
- **Impact**: Abuse potential — DoS vector and spam orders

**M13. Hardcoded backend URL in storefront**
- `client/src/features/fulfillment/pages/Storefront.tsx` line 178 hardcodes `http://localhost:3001`
- **Impact**: Product images broken in production deployment

**M14. Only 19 of 68 migrations have `.down.sql` rollback files**
- Migrations 001-046 cannot be rolled back via `npm run migrate:down`
- **Impact**: Rollback capability is limited to recent migrations only

**M15. Duplicated financial calculation logic (frontend + backend)**
- Tax rounding, discount distribution, loyalty point formulas, and coupon validation are implemented independently in both `checkout.ts` (frontend) and `saleService.ts` (backend)
- **Impact**: Formula divergence causes frontend preview to disagree with backend receipts

#### Low

**L1. Duplicate `021_` migration prefix**
- Two files share the `021_` prefix: `021_product_status.sql` and `021_shipping_companies.sql`
- Documented in TECH_DEBT.md as harmless (both independent)
- **Impact**: Minor naming inconsistency

**L2. `cache.ts` middleware is minimal (one-liner)**
- Only sets `Cache-Control` header — could be inline
- **Impact**: Negligible, but adds unnecessary file

**L3. Hardcoded JWT secrets in .env**
- Development `.env` has readable JWT secrets
- Production (render.yaml) properly generates secrets
- **Impact**: Low risk (dev-only), but should document `.env.example`

**L4. `render.yaml` uses free tier**
- No persistent storage, no database add-on
- **Impact**: Deployment config must be updated alongside migration

---

### 4. Target Architecture

Based on the actual domain discovered in the repository (38 route files, 65+ migrations, 9 features slices on the frontend), here is the target modular monolith:

```
server/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.repository.ts
│   │   │   ├── auth.schema.ts          # Zod schemas
│   │   │   └── auth.types.ts
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   ├── users.schema.ts
│   │   │   └── users.types.ts
│   │   ├── products/
│   │   │   ├── products.routes.ts
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   ├── products.repository.ts
│   │   │   ├── products.schema.ts
│   │   │   ├── products.types.ts
│   │   │   ├── variants.controller.ts   # sub-resource
│   │   │   └── variants.repository.ts
│   │   ├── categories/                  # Simple CRUD — may skip controller layer
│   │   │   └── ...
│   │   ├── inventory/                   # Stock adjustments, counts, reservations, snapshots
│   │   │   ├── inventory.routes.ts
│   │   │   ├── inventory.controller.ts
│   │   │   ├── inventory.service.ts     # Stock validation, movement recording
│   │   │   ├── inventory.repository.ts
│   │   │   └── inventory.types.ts
│   │   ├── sales/                       # Sales, sale items, refunds, exchanges
│   │   │   ├── sales.routes.ts
│   │   │   ├── sales.controller.ts
│   │   │   ├── sales.service.ts         # Price calculation, transaction orchestration
│   │   │   ├── sales.repository.ts
│   │   │   └── sales.types.ts
│   │   ├── purchases/                   # Purchase orders, distributors, vendors
│   │   │   └── ...
│   │   ├── customers/                   # Customers, loyalty, segments, feedback
│   │   │   └── ...
│   │   ├── payments/                    # Coupons, gift cards, split payments, layaway
│   │   │   └── ...
│   │   ├── fulfillment/                 # Delivery, online orders, storefront, shipping
│   │   │   └── ...
│   │   ├── register/                    # Cash register sessions, shifts, expenses
│   │   │   └── ...
│   │   ├── analytics/                   # Dashboard, reports, exports, AI
│   │   │   └── ...
│   │   └── admin/                       # Settings, audit log, branches, collections,
│   │       └── ...                      #   label templates, bundles, warranty, notifications
│   ├── database/
│   │   ├── pool.ts                      # pg.Pool singleton
│   │   ├── transaction.ts               # Transaction helper (BEGIN/COMMIT/ROLLBACK)
│   │   ├── migrate.ts                   # PostgreSQL migration runner
│   │   ├── seed.ts                      # PostgreSQL seed script
│   │   └── migrations/                  # PostgreSQL-compatible SQL files
│   ├── middleware/
│   │   ├── auth.ts                      # verifyToken, requireRole (unchanged)
│   │   ├── errorHandler.ts
│   │   ├── auditLogger.ts
│   │   ├── requestLogger.ts
│   │   ├── sanitize.ts
│   │   ├── upload.ts
│   │   └── validate.ts                  # Generic Zod validation middleware
│   ├── infrastructure/
│   │   ├── twilio.ts                    # SMS/WhatsApp (unchanged)
│   │   └── notifications.ts
│   ├── config/
│   │   ├── env.ts                       # Environment validation (Zod)
│   │   └── app.ts                       # Express app factory
│   ├── shared/
│   │   ├── types.ts                     # Shared types (ApiResponse, Pagination, etc.)
│   │   └── errors.ts                    # AppError class, error factory functions
│   └── index.ts                         # Entry point
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

#### Module Mapping from Current Routes

| Current Route File(s) | Target Module | Rationale |
|----------------------|---------------|-----------|
| `auth.ts` | `auth/` | Authentication is cross-cutting |
| `users.ts` | `users/` | User management |
| `products.ts` | `products/` | Product CRUD + variants |
| `categories.ts` | `categories/` | Simple CRUD |
| `sales.ts`, `exchanges.ts` | `sales/` | Core sales domain |
| `purchaseOrders.ts`, `distributors.ts`, `vendors.ts` | `purchases/` | Procurement domain |
| `customers.ts`, `segments.ts`, `feedback.ts` | `customers/` | Customer domain |
| `coupons.ts`, `giftCards.ts`, `layaway.ts` | `payments/` | Payment instruments |
| `delivery.ts`, `onlineOrders.ts`, `storefront.ts`, `shippingCompanies.ts` | `fulfillment/` | Order fulfillment |
| `stockAdjustments.ts`, `stockCounts.ts`, `reservations.ts` | `inventory/` | Inventory management |
| `register.ts`, `shifts.ts`, `expenses.ts` | `register/` | Cash register operations |
| `analytics.ts`, `reports.ts`, `exports.ts`, `ai.ts` | `analytics/` | Reporting/analytics |
| `settings.ts`, `auditLog.ts`, `branches.ts`, `notifications.ts`, `bundles.ts`, `collections.ts`, `labelTemplates.ts`, `warranty.ts` | `admin/` | Administration |

---

### 5. Migration Strategy

#### Phase A: PostgreSQL Infrastructure (Foundation)

1. **Add PostgreSQL connection module** — Create `server/src/database/pool.ts` using `pg.Pool` with proper config from environment variables (`DATABASE_URL` or individual `PGHOST`, `PGPORT`, etc.)
2. **Create transaction helper** — `server/src/database/transaction.ts` wrapping `client = await pool.connect(); BEGIN; ... COMMIT; ROLLBACK;` with proper client release
3. **Add `DATABASE_URL` to `.env`** pointing to a local PostgreSQL instance
4. **Update `render.yaml`** to include a PostgreSQL database add-on

#### Phase B: Migration System Conversion

1. **Rewrite `migrate.ts`** to use `pg.Pool` instead of `better-sqlite3`
   - Replace `PRAGMA table_info` with `information_schema.columns`
   - Replace `sqlite_master` with `information_schema.tables`
   - Replace `INTEGER PRIMARY KEY AUTOINCREMENT` tracking with `SERIAL`/`IDENTITY`
   - Keep the same file-based migration approach
2. **Create PostgreSQL-compatible migration files**
   - Convert all 65+ `.sql` files from SQLite DDL to PostgreSQL DDL
   - Key conversions: `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`, `TEXT` timestamps → `TIMESTAMPTZ`, `REAL` → `NUMERIC`, `datetime('now')` → `NOW()`
   - Consolidate into fewer migration files (the 65 files represent incremental evolution — a fresh PostgreSQL schema can be more compact)
3. **Rewrite `seed.ts`** to use `pg.Pool`
   - Replace `sqlite_master`/`sqlite_sequence` with `TRUNCATE ... CASCADE`
   - Replace `db.prepare().run()` with parameterized `pool.query()`
   - Replace `db.transaction()` with `BEGIN/COMMIT` blocks

#### Phase C: Query-by-Query Conversion

For each route/service file:
1. Replace `datetime('now')` → `NOW()`
2. Replace `date('now')` → `CURRENT_DATE`
3. Replace `date('now', 'start of month')` → `DATE_TRUNC('month', CURRENT_DATE)`
4. Replace `date('now', '-30 days')` → `CURRENT_DATE - INTERVAL '30 days'`
5. Replace `strftime('%Y-%m', ...)` → `TO_CHAR(..., 'YYYY-MM')`
6. Replace `julianday('now') - julianday(col)` → `EXTRACT(EPOCH FROM NOW() - col) / 86400` (for days) or `EXTRACT(EPOCH FROM NOW() - col) / 3600` (for hours)
7. Replace `?` placeholders → `$1, $2, ...`
8. Replace `CAST(x AS TEXT) LIKE ?` → `x::TEXT ILIKE $1` where appropriate
9. Replace `db.db.transaction()` → PostgreSQL transaction helper
10. Replace boolean `1`/`0` → `true`/`false`
11. Replace `MAX(0, col + ?)` (scalar) → `GREATEST(0, col + $1)`
12. Replace `INSERT OR IGNORE INTO` → `INSERT INTO ... ON CONFLICT DO NOTHING`
13. Replace `INSERT OR REPLACE INTO` → `INSERT INTO ... ON CONFLICT(...) DO UPDATE SET ...`
14. Fix `GROUP BY` clauses to list all non-aggregated columns

#### Phase D: Remove SQLite

1. Remove `better-sqlite3` and `@types/better-sqlite3` from dependencies
2. Delete `server/db/index.ts` (pg-compat wrapper)
3. Delete `server/db/moon.db`
4. Update all imports from `'../db'` to `'../database/pool'`
5. Update health check to use `pool.query('SELECT 1')`
6. Update shutdown to call `pool.end()`

---

### 6. Dependency Cleanup

#### Dependencies to Keep

| Package | Version | Reason |
|---------|---------|--------|
| `express` | ^4.21.0 | Core framework |
| `pg` | ^8.13.0 | **Will become the actual database driver** |
| `bcrypt` | ^5.1.1 | Password hashing |
| `jsonwebtoken` | ^9.0.2 | JWT auth |
| `zod` | ^3.23.8 | Request validation |
| `multer` | ^2.0.2 | File upload |
| `helmet` | ^7.1.0 | Security headers |
| `cors` | ^2.8.5 | CORS handling |
| `express-rate-limit` | ^7.4.0 | Rate limiting |
| `twilio` | ^5.3.0 | SMS/WhatsApp |
| `cookie-parser` | ^1.4.6 | Cookie parsing |
| `dotenv` | ^16.4.5 | Env vars |

#### Dependencies to Remove (after migration)

| Package | Version | Reason |
|---------|---------|--------|
| `better-sqlite3` | ^12.6.2 | Replaced by `pg` |
| `@types/better-sqlite3` | ^7.6.13 | No longer needed |

#### Dependencies to Add

| Package | Reason |
|---------|--------|
| `@types/pg` | TypeScript types for pg |

#### Dependencies That Should NOT Be Added

- **Prisma / Drizzle / TypeORM** — The existing `pg` + raw SQL approach is working and well-understood. Adding an ORM would be a separate migration with its own risks.
- **Redis** — No caching requirements justify it. In-memory caching (if needed later) or PostgreSQL `UNLOGGED` tables suffice.
- **Kafka / RabbitMQ** — No event-driven requirements. The notification system is simple and synchronous.
- **GraphQL** — REST API is established with 37 route files and a working frontend. No benefit to switching.
- **Kubernetes / Docker** — Deployment complexity is not the current problem. Fix the database first.

---

### 7. Testing Strategy

#### Existing Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| `auth.test.ts` | 9 tests | JWT generation, user lookup, refresh tokens, role checking |
| `sales.test.ts` | 10 tests | Schema validation, stock deduction, discount/tax calculation |

Both test files are **SQLite-coupled** — they create temporary SQLite databases and test SQLite behavior directly.

#### Critical Behavior to Protect Before Refactoring

Priority order:

1. **Authentication flow** — Login, token refresh, logout, role enforcement
2. **Sale creation** — Atomic transaction: validate → calculate prices → create sale → create items → deduct stock → record movements → process payments
3. **Refund processing** — Partial/full refund with optional restock
4. **Inventory operations** — Stock deduction (atomic with sales), stock adjustments, stock counts, reservations
5. **Purchase order receiving** — Receive items → increase stock → update PO status
6. **Payment instruments** — Coupon validation and usage, gift card balance management, split payments
7. **Product CRUD** — Create with variants, update prices, manage stock

#### Testing Approach for Migration

1. **Characterization tests first** — Before modifying any business logic, add integration tests that capture current behavior (using a test PostgreSQL database instead of SQLite)
2. **Test the PostgreSQL transaction helper** — Verify BEGIN/COMMIT/ROLLBACK behavior
3. **Test the sale transaction end-to-end** — Verify atomicity: if stock deduction fails, sale is not created
4. **Test date/time functions** — Verify that PostgreSQL date functions produce equivalent results to SQLite ones
5. **API contract tests** — Verify that response shapes don't change during refactoring

---

## Implementation Units

### Phase 1: PostgreSQL Infrastructure

- [ ] **Unit 1: PostgreSQL connection pool and transaction helper**

  **Goal:** Establish the PostgreSQL foundation that all subsequent work builds on.

  **Requirements:** C1, C2, C3 — Replace fake pg-compat with real PostgreSQL

  **Dependencies:** None — this is the foundation

  **Files:**
  - Create: `server/src/database/pool.ts`
  - Create: `server/src/database/transaction.ts`
  - Create: `server/src/config/env.ts`
  - Modify: `server/.env` (add `DATABASE_URL`)
  - Test: `server/tests/database/pool.test.ts`
  - Test: `server/tests/database/transaction.test.ts`

  **Approach:**
  - Create `pg.Pool` singleton with config from `DATABASE_URL` env var
  - Create `withTransaction(callback)` helper that manages `BEGIN/COMMIT/ROLLBACK` and client release
  - Create Zod-based environment validation for required vars
  - Do NOT remove the existing `db/index.ts` yet — both will coexist during migration

  **Patterns to follow:**
  - The existing `db/index.ts` export shape (`query`, `pool`) — maintain API similarity for easier migration
  - The existing logger (`server/lib/logger.ts`) for connection events

  **Test scenarios:**
  - Happy path: Pool connects to PostgreSQL, `pool.query('SELECT 1')` returns `{ rows: [{ '?column?': 1 }] }`
  - Happy path: Transaction commits — two INSERTs in a transaction both persist
  - Error path: Transaction rolls back on error — first INSERT is undone when second throws
  - Error path: Pool rejects with clear error when `DATABASE_URL` is missing
  - Edge case: Client is always released even when callback throws

  **Verification:** `pool.query('SELECT 1')` succeeds against a local PostgreSQL instance

- [ ] **Unit 2: PostgreSQL migration runner**

  **Goal:** Rewrite the migration system to target PostgreSQL

  **Dependencies:** Unit 1

  **Files:**
  - Create: `server/src/database/migrate.ts`
  - Create: `server/src/database/migrations/001_initial_schema.sql` (consolidated PostgreSQL DDL)
  - Test: `server/tests/database/migrate.test.ts`

  **Approach:**
  - Port the migration runner logic from `server/db/migrate.ts` to use `pg.Pool`
  - Replace SQLite-specific checks (`PRAGMA table_info`, `sqlite_master`) with `information_schema` queries
  - Consolidate the 65+ incremental SQLite migrations into a smaller set of PostgreSQL-compatible files that represent the current schema
  - Preserve the file-based, sequential migration approach
  - Keep the `_migrations` tracking table pattern

  **Technical design (directional):**
  ```
  _migrations table: id SERIAL PRIMARY KEY, name TEXT UNIQUE, applied_at TIMESTAMPTZ DEFAULT NOW()
  Schema: Convert all TEXT timestamps → TIMESTAMPTZ, REAL → NUMERIC, AUTOINCREMENT → SERIAL
  ```

  **Patterns to follow:**
  - The existing migration file naming convention (`NNN_description.sql`)
  - The existing `--down` rollback support

  **Test scenarios:**
  - Happy path: Fresh database — all migrations run in order, `_migrations` table tracks them
  - Happy path: Re-run — already-applied migrations are skipped
  - Happy path: Down migration — last migration is rolled back and removed from tracking
  - Error path: Invalid SQL in migration — transaction rolls back, migration is not recorded
  - Edge case: Concurrent migration runs don't corrupt tracking (advisory lock)

  **Verification:** `npm run migrate` creates all tables in PostgreSQL; `\dt` shows the full schema

- [ ] **Unit 3: PostgreSQL seed system**

  **Goal:** Rewrite seed data to target PostgreSQL

  **Dependencies:** Unit 2

  **Files:**
  - Create: `server/src/database/seed.ts`
  - Test: `server/tests/database/seed.test.ts`

  **Approach:**
  - Port `server/db/seed.ts` to use `pg.Pool` and parameterized queries
  - Replace `sqlite_master`/`sqlite_sequence` with `TRUNCATE ... CASCADE` and `ALTER SEQUENCE ... RESTART`
  - Replace `db.prepare().run()` with `pool.query()` or batched queries
  - Keep the same seed data (categories, users, products, customers, sales, etc.)
  - Add guard to prevent running in production (`NODE_ENV === 'production'` → abort)

  **Test scenarios:**
  - Happy path: Seed populates expected number of rows in each table
  - Error path: Seed refuses to run when `NODE_ENV=production`
  - Edge case: Seed is idempotent — running twice produces same state (TRUNCATE + re-insert)

  **Verification:** `npm run seed` populates PostgreSQL; login with `admin@moon.com / admin123` works

### Phase 2: Query Migration (Module by Module)

- [ ] **Unit 4: Migrate auth module to PostgreSQL**

  **Goal:** Convert auth routes to use PostgreSQL directly — first module to prove the pattern

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `server/routes/auth.ts` (update queries)
  - Modify: `server/middleware/auth.ts` (unchanged, but verify)
  - Test: `server/tests/auth.test.ts` (rewrite for PostgreSQL)

  **Approach:**
  - Replace `?` with `$1, $2, ...` in all queries
  - Replace `datetime('now')` with `NOW()`
  - Replace `db.query()` calls with new pool-based queries
  - This is the simplest module (4 endpoints, no transactions) — use it to validate the migration pattern
  - **Do NOT restructure into controller/service/repository yet** — just swap the database

  **Execution note:** Characterization-first — verify current behavior before modifying queries.

  **Test scenarios:**
  - Happy path: Login with valid credentials returns access token + sets refresh cookie
  - Happy path: Refresh with valid cookie returns new access token
  - Happy path: Logout deletes refresh token
  - Error path: Login with wrong password returns 401
  - Error path: Expired refresh token returns 401
  - Integration: Full login → refresh → logout cycle works end-to-end

  **Verification:** All auth endpoints work with PostgreSQL; existing frontend login flow is unaffected

- [ ] **Unit 5: Migrate sales module to PostgreSQL**

  **Goal:** Convert the most critical transaction-heavy module

  **Dependencies:** Unit 1, Unit 4 (for auth middleware)

  **Files:**
  - Modify: `server/routes/sales.ts` (update queries)
  - Modify: `server/services/saleService.ts` (replace `db.db.transaction()` with PostgreSQL transactions)
  - Test: `server/tests/sales.test.ts` (rewrite for PostgreSQL)

  **Approach:**
  - Replace `db.db.transaction(() => {...})()` (synchronous SQLite) with `withTransaction(async (client) => {...})` (async PostgreSQL)
  - Convert all date functions: `datetime('now')` → `NOW()`, `date('now', 'start of month')` → `DATE_TRUNC('month', CURRENT_DATE)`
  - Replace `?` with `$1, $2, ...`
  - Replace `RETURNING *` usage — this already works in PostgreSQL
  - Fix `GROUP BY` clauses to list all non-aggregated columns
  - This is the highest-risk module — verify atomicity of sale + stock deduction

  **Test scenarios:**
  - Happy path: Create sale → stock deducted → sale items recorded → payment recorded — all in one transaction
  - Error path: Insufficient stock → entire transaction rolls back (sale not created)
  - Error path: Insufficient loyalty points → transaction rolls back
  - Happy path: Partial refund → stock restocked → sale updated
  - Error path: Refund exceeding sale total → rejected
  - Edge case: Concurrent sales for same product — no overselling (stock check + deduction is atomic)
  - Integration: Sale creation triggers notification and audit log

  **Verification:** Create and refund sales via the API; verify stock levels are correct

- [ ] **Unit 6: Migrate remaining modules to PostgreSQL (batch)**

  **Goal:** Convert all remaining route files and services

  **Dependencies:** Unit 5 (pattern established)

  **Files:**
  - Modify: All remaining route files (31 files)
  - Modify: All remaining service files (7 files)
  - Test: Add characterization tests for critical paths

  **Approach:**
  - Work module by module following the pattern established in Units 4-5
  - Priority order: products → inventory → purchases → customers → payments → fulfillment → register → analytics → admin
  - For each module: convert queries → update date functions → fix GROUP BY → convert transactions → test
  - This is the bulk of the work but should be mechanical after the pattern is proven

  **Test scenarios:**
  - Product CRUD with variants works
  - Purchase order receiving increases stock
  - Customer loyalty points are correctly managed
  - Gift card balance operations are atomic
  - Analytics queries return correct aggregations
  - Reports date filtering works with PostgreSQL date functions

  **Verification:** Full API smoke test — every endpoint returns valid responses

### Phase 3: Remove SQLite & Clean Up

- [ ] **Unit 7: Remove SQLite compatibility layer**

  **Goal:** Delete all SQLite code and dependencies

  **Dependencies:** Unit 6 (all modules migrated)

  **Files:**
  - Delete: `server/db/index.ts`
  - Delete: `server/db/moon.db`
  - Delete: `server/db/migrate.ts`
  - Delete: `server/db/seed.ts`
  - Delete: `server/db/migrations/` (all SQLite migration files)
  - Modify: `server/package.json` (remove `better-sqlite3`, `@types/better-sqlite3`; add `@types/pg`)
  - Modify: `server/index.ts` (update imports, health check, shutdown)
  - Modify: `render.yaml` (add PostgreSQL database service, remove seed from start command)

  **Test scenarios:**
  - Test expectation: none — this is a cleanup unit. Verification is that all tests still pass after removal.

  **Verification:** `npm run build` succeeds; no `better-sqlite3` imports remain; all tests pass

### Phase 4: Modular Architecture (Incremental)

- [ ] **Unit 8: Extract repository layer for sales module (pattern)**

  **Goal:** Establish the Repository pattern on the most critical module

  **Dependencies:** Unit 5

  **Files:**
  - Create: `server/src/modules/sales/sales.repository.ts`
  - Modify: `server/services/saleService.ts` (delegate DB calls to repository)
  - Test: `server/tests/modules/sales/sales.repository.test.ts`

  **Approach:**
  - Extract all SQL queries from `saleService.ts` into `sales.repository.ts`
  - Repository methods: `createSale()`, `createSaleItems()`, `getSaleById()`, `listSales()`, `createRefund()`, `updateSaleRefundStatus()`
  - Service retains business logic: price calculation, stock validation, coupon validation
  - Service calls repository for data access, passing the transaction client when needed

  **Patterns to follow:**
  - Each repository method takes an optional `client` parameter for transaction support
  - Repository returns typed results, not `Record<string, any>`

  **Test scenarios:**
  - Happy path: Repository creates sale and returns typed result
  - Happy path: Repository lists sales with pagination and filtering
  - Integration: Service calls repository within a transaction — commit persists, rollback undoes

  **Verification:** Sales API behavior unchanged; service tests pass with repository layer

- [ ] **Unit 9: Extract controller layer for sales module**

  **Goal:** Thin out the route handler by extracting HTTP logic into a controller

  **Dependencies:** Unit 8

  **Files:**
  - Create: `server/src/modules/sales/sales.controller.ts`
  - Modify: `server/routes/sales.ts` (become a thin route file)
  - Test: `server/tests/modules/sales/sales.controller.test.ts`

  **Approach:**
  - Route file defines only `router.get()`, `router.post()` with middleware chain → controller method
  - Controller handles: Zod parsing, calling service, formatting response, calling audit/notification
  - Service handles: business logic, calling repository
  - Repository handles: SQL queries

  **Test scenarios:**
  - Happy path: Controller calls service and returns formatted response
  - Error path: Controller returns 400 on Zod validation failure
  - Error path: Controller returns 404 when sale not found

  **Verification:** Route → Controller → Service → Repository flow works; API responses unchanged

- [ ] **Unit 10: Apply modular pattern to remaining critical modules**

  **Goal:** Extract repositories and controllers for products, inventory, purchases, and auth

  **Dependencies:** Unit 9 (pattern proven)

  **Files:**
  - Create: Repository + controller files for products, inventory, purchases, auth modules
  - Modify: Corresponding route and service files
  - Test: Module-level tests

  **Approach:**
  - Follow the same pattern established in Units 8-9
  - For simple CRUD modules (categories, settings), skip the controller layer — route → service → repository is sufficient
  - For analytics/reports, keep queries in service layer (complex aggregation queries don't benefit from a repository abstraction)

  **Test scenarios:**
  - Product CRUD through the layered architecture
  - Inventory movement recording through repository
  - Purchase order receiving through service + repository

  **Verification:** All API endpoints work through the new layered architecture

### Phase 5: Hardening

- [ ] **Unit 11: Server-side price validation**

  **Goal:** Fix C4 — stop trusting client-supplied prices

  **Dependencies:** Unit 8 (sales repository exists)

  **Files:**
  - Modify: `server/services/saleService.ts` (or `server/src/modules/sales/sales.service.ts`)
  - Test: Sales service tests

  **Approach:**
  - In `calculateSaleTotals()`, look up each item's price from the database instead of trusting `item.unit_price`
  - Compare client-supplied price with DB price — allow a small tolerance for rounding, reject large discrepancies
  - Log warnings when client price differs from server price

  **Test scenarios:**
  - Happy path: Sale with correct client prices proceeds normally
  - Error path: Sale with manipulated client prices is rejected or corrected
  - Edge case: Variant price differs from product base price — correct price used

  **Verification:** Creating a sale with a tampered price is detected and prevented

- [ ] **Unit 12: Add missing Zod validation schemas**

  **Goal:** Fix H4 — ensure all routes have input validation

  **Dependencies:** None (can be done in parallel)

  **Files:**
  - Create: Zod schemas for the ~27 routes currently missing validation
  - Modify: Corresponding route files to use the new schemas

  **Approach:**
  - Create validation schemas for: branches, analytics queries, register sessions, shifts, expenses, vendors, stock counts, notifications, bundles, collections, label templates, warranty, feedback, segments, online orders, storefront, exchanges, layaway, AI, exports, coupons (create/update), gift cards (create/update), reservations
  - Use a generic validation middleware: `validate(schema)` that wraps Zod parsing

  **Test scenarios:**
  - Happy path: Valid input passes validation
  - Error path: Missing required fields returns 400 with descriptive error
  - Error path: Invalid types (string where number expected) returns 400

  **Verification:** All POST/PUT/PATCH endpoints reject invalid input with clear error messages

---

## System-Wide Impact

- **API surface parity:** All existing API endpoints (`/api/v1/*`) must continue to return the same response shapes. The frontend must not require changes during the backend refactoring.
- **Error propagation:** PostgreSQL errors (constraint violations, connection failures) must be caught and translated to the existing `{ success: false, error: string }` response format.
- **State lifecycle risks:** During the migration window (Phase C), the system will be in a transitional state. Each module migration must be atomic — don't leave a module half-migrated.
- **Unchanged invariants:** The React frontend, the API versioning (`/api/v1/`), the JWT auth flow, the response envelope format, the Zod validation approach, and the middleware chain all remain unchanged.

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data loss during migration | Medium | Critical | Export SQLite data before migration; verify row counts after PostgreSQL seed |
| Query behavior differences (dates, types, GROUP BY) | High | Medium | Characterization tests before each module migration; compare query results |
| Transaction semantics differ (sync vs async) | Medium | High | Test atomicity explicitly; verify rollback behavior |
| PostgreSQL not available locally | Low | High | Document local PostgreSQL setup; provide Docker compose option |
| Breaking API contracts during refactor | Low | High | API contract tests; don't change response shapes |
| Performance regression (SQLite is fast for single-user) | Low | Medium | PostgreSQL with proper pooling should be equivalent or better for concurrent use |

## Alternative Approaches Considered

- **Prisma/Drizzle ORM**: Rejected — would require learning a new tool, adds abstraction that hides PostgreSQL, and the existing raw SQL approach is well-understood. The team has 65+ migration files showing comfort with SQL.
- **Keep SQLite with pg backup**: Rejected — SQLite is single-writer, not suitable for production web servers with concurrent users, and blocks deployment to managed services.
- **Rewrite from scratch**: Rejected — the existing code works and has been through 5 sprints of tech debt cleanup. Incremental migration preserves working functionality.

## Sources & References

- Current architecture: `docs/ARCHITECTURE.md`
- Current conventions: `docs/CONVENTIONS.md`
- Completed tech debt: `TECH_DEBT.md` (41 items, all fixed)
- Deployment config: `render.yaml`
- Database wrapper: `server/db/index.ts`
- Migration runner: `server/db/migrate.ts`
- Seed system: `server/db/seed.ts`
- Sale transaction: `server/services/saleService.ts`
