---
title: "fix: Resolve 70 API 500 Errors and Database Schema Discrepancies"
type: fix
status: active
date: 2026-08-25
origin: docs/reports/api-verification-report.md
---

# fix: Resolve 70 API 500 Errors and Database Schema Discrepancies

## Overview

Based on the diagnostic findings in `docs/reports/api-verification-report.md` (where 70 out of 200 mounted endpoints returned `500 Internal Server Error`), this plan details the technical root causes, structural categories, and concrete remediation units across database schema migrations, repository queries, controller logic, and test harness execution environments to achieve a 0-failure health status across the backend API.

---

## Problem Frame & Error Root-Cause Taxonomy

The 70 failures cluster into 5 distinct technical root causes:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             70 API 500 Errors                                    │
├──────────────────┬─────────────────┬──────────────────┬──────────────────────────┤
│ 1. Express/IP    │ 2. Missing      │ 3. Column/Alias  │ 4. SQL / pg-mem          │
│    Req Context   │    Tables &     │    Mismatches    │    Function              │
│    (11 Endpoints)│    Migrations   │    (28 Endpoints)│    Incompatibilities     │
│                  │    (6 Endpoints)│                  │    (25 Endpoints)        │
└──────────────────┴─────────────────┴──────────────────┴──────────────────────────┘
```

### 1. Missing Express Request Context in Test Dispatch (`remoteAddress` / `set-cookie`) — 11 Endpoints
- **Symptom:** `TypeError: Cannot read properties of undefined (reading 'remoteAddress')` triggered by `express-rate-limit` / `auditLog` / cookie parsing.
- **Affected Endpoints:** `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `POST /api/v1/users`, `POST /api/v1/branches`, `POST /api/v1/products`, `DELETE /api/v1/products/1`, `POST /api/v1/products/1/image`, `POST /api/v1/stock-counts`, `POST /api/v1/stock-counts/1/complete`, `DELETE /api/v1/shipping-companies/1`.
- **Root Cause:** In `server/tests/verification/endpointHealth.test.ts`, mocked request objects omit `req.socket` / `req.ip` / `req.connection`, breaking `req.ip` resolution inside rate limiters and audit log recording.

### 2. Missing Database Tables & Incomplete Schemas — 6 Endpoints
- **Symptom:** `relation "branch_transfers" does not exist`, `relation "vendor_payouts" does not exist`.
- **Affected Endpoints:** `GET /api/v1/branches/transfers`, `GET /api/v1/vendors/1/payouts`.
- **Root Cause:** `branch_transfers` and `vendor_payouts` tables are queried in module repositories (`BranchesRepository`, `VendorsRepository`) but were omitted from `001_initial_schema.sql` (only `inter_store_transfers` and `vendor_commissions` existed).

### 3. Column & Model Name Mismatches — 28 Endpoints
- **Symptom:** `column "contact_info" does not exist`, `column "tax_number" does not exist`, `column "season" does not exist`, `column "s.status" does not exist`, `column "w.product_id" does not exist`, `column "source_id" does not exist`, `column "s.receipt_number" does not exist`.
- **Affected Endpoints:**
  - `distributors`: queries `contact_info`, schema has `contact_person`.
  - `vendors`: queries `tax_number`, schema lacks `tax_number`.
  - `collections`: queries `season`, `is_featured`, schema only has `id, name, description, created_at`.
  - `sales`: queries `receipt_number`, `status`, `subtotal`, schema lacks `receipt_number`, `status` (has `refund_status`), `subtotal`.
  - `exchanges`: queries `e.customer_id`, schema only has `original_sale_id, new_sale_id, cashier_id, price_difference, reason`.
  - `warranty_claims`: queries `w.product_id`, `resolution`, schema only links via `warranty_id` and lacks `resolution`.
  - `customer_feedback`: queries `category`, `comment`, schema has `comments` and lacks `category`.
  - `shipping_companies`: queries `phone`, `email`, schema has `contact_phone` and lacks `email`.
  - `coupons`: UPDATE queries `updated_at`, schema lacks `updated_at`.
  - `inventory_snapshots`: queries `snapshot_data`, schema lacks `snapshot_data`.
  - `products`: queries `lead_time_days`, `reorder_qty`, `abc_class`, schema has `abc_classification` and lacks `lead_time_days`, `reorder_qty`.

### 4. Query Alias & Subquery Parser Restrictions — 12 Endpoints
- **Symptom:** `Unknown alias "b"`, `Unknown alias "rs"`, `Unknown alias "c"`, `Unknown alias "d"`, `Unknown alias "s"`, `Unknown alias "po"`.
- **Affected Endpoints:** `GET /api/v1/branches`, `GET /api/v1/register/current`, `GET /api/v1/register/history`, `GET /api/v1/categories`, `GET /api/v1/distributors`, `GET /api/v1/stock-counts`, `GET /api/v1/bundles`, `GET /api/v1/collections`, `GET /api/v1/customers/1/sales`, `GET /api/v1/segments`, `GET /api/v1/online-orders`, `GET /api/v1/vendors`, `GET /api/v1/purchase-orders`, `GET /api/v1/shipping-companies`.
- **Root Cause:** Correlated subqueries inside `SELECT` (e.g. `SELECT b.*, (SELECT COUNT(*)... WHERE branch_id = b.id) FROM branches b`) fail in `pg-mem` test environment and are non-performant compared to `LEFT JOIN ... GROUP BY`.

### 5. PostgreSQL vs pg-mem Function / Type-Cast Dialect Incompatibilities — 13 Endpoints
- **Symptom:**
  - `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY` fails in `pg-mem`.
  - `cannot cast type date to timestamptz` / `cannot cast type timestamp with time zone to text`.
  - `ERROR: function round(float,integer) does not exist`, `date_trunc(text,date) does not exist`, `length(text) does not exist`.
  - `operator does not exist: timestamp with time zone - timestamp with time zone`.
- **Affected Endpoints:** `GET /api/v1/products`, `GET /api/v1/products/generate-barcode`, Analytics routes (`dashboard-all`, `dashboard`, `revenue`, `top-products`, `payment-methods`, `orders-per-day`, `cashier-performance`, `sales-by-category`, `sales-by-distributor`, `dead-stock`, `customer-ltv`, `hourly-heatmap`, `abc-classification`), `GET /api/v1/delivery/analytics/performance`.

---

## Requirements Trace

- **R1. Schema & Migration Alignment:** Update database schema (`server/src/database/migrations/001_initial_schema.sql` and down migration) to include missing tables (`branch_transfers`, `vendor_payouts`) and missing columns (`sales.receipt_number`, `sales.status`, `sales.subtotal`, `distributors.contact_info`, `vendors.tax_number`, etc.).
- **R2. Query & Repository Refactoring:** Rewrite correlated subqueries into clean `LEFT JOIN` / `GROUP BY` patterns that are standard PostgreSQL compatible and execution-safe in in-memory test mocks.
- **R3. Test Request & Socket Mocking:** Ensure the Express verification harness and supertest dispatches provide valid `socket.remoteAddress`, `headers`, and cookie mock implementations.
- **R4. pg-mem & DB Driver Polyfills:** Register missing functions (`ROUND(numeric, int)`, `DATE_TRUNC`, `LENGTH`, timestamp subtraction) in the test database initialization harness.
- **R5. Full Verification Zero-Failure:** Re-run `endpointHealth.test.ts` and verify 0 `500 Server Errors` across all 200 endpoints.

---

## Implementation Units

- [ ] **Unit 1: Test Dispatch & Express Socket/IP Mocking Fix**
  - **Goal:** Resolve all 11 `remoteAddress` and `set-cookie` 500 errors by equipping mocked Express request/response objects with network socket stubs.
  - **Dependencies:** None
  - **Files:**
    - `server/tests/verification/endpointHealth.test.ts`
    - `server/tests/verification/testApp.ts`
  - **Approach:** Attach `socket: { remoteAddress: '127.0.0.1' }`, `ip: '127.0.0.1'`, and proper cookie handling headers to `reqObj` in `endpointHealth.test.ts`.
  - **Test scenarios:**
    - Test `POST /api/v1/auth/login` and `POST /api/v1/products` pass rate limiter and audit logging without `remoteAddress` null errors.
  - **Verification:** 11 `TypeError: remoteAddress` errors drop to 0.

- [ ] **Unit 2: Database Schema & Migration Normalization**
  - **Goal:** Add missing tables (`branch_transfers`, `vendor_payouts`) and align missing columns across all tables in `001_initial_schema.sql` and `seed.ts`.
  - **Dependencies:** Unit 1
  - **Files:**
    - `server/src/database/migrations/001_initial_schema.sql`
    - `server/src/database/migrations/001_initial_schema.down.sql`
    - `server/src/database/seed.ts`
  - **Approach:**
    - Add `CREATE TABLE IF NOT EXISTS branch_transfers (...)` and `vendor_payouts (...)`.
    - Add missing columns: `sales.receipt_number`, `sales.status`, `sales.subtotal`, `vendors.tax_number`, `distributors.contact_info`, `collections.season`, `collections.is_featured`, `coupons.updated_at`, `customer_feedback.category`, `inventory_snapshots.snapshot_data`, `products.lead_time_days`, `products.reorder_qty`, `shipping_companies.phone`, `shipping_companies.email`.
  - **Test scenarios:**
    - Run migration up & seed without schema conflict.
  - **Verification:** All missing table/column 500 errors resolved.

- [ ] **Unit 3: Repository Query Refactoring & Alias Sanitization**
  - **Goal:** Refactor correlated subqueries in repositories to standard SQL joins/groupings.
  - **Dependencies:** Unit 2
  - **Files:**
    - `server/src/modules/core/branches/repository.ts`
    - `server/src/modules/inventory/categories/repository.ts`
    - `server/src/modules/inventory/bundles/repository.ts`
    - `server/src/modules/inventory/collections/repository.ts`
    - `server/src/modules/pos/register/repository.ts`
    - `server/src/modules/purchasing/distributors/repository.ts`
    - `server/src/modules/purchasing/vendors/repository.ts`
    - `server/src/modules/purchasing/purchaseOrders/repository.ts`
    - `server/src/modules/fulfillment/shippingCompanies/repository.ts`
  - **Approach:** Replace `SELECT x.*, (SELECT COUNT(*) FROM child WHERE parent_id = x.id) FROM table x` with clean `LEFT JOIN child c ON c.parent_id = x.id GROUP BY x.id`.
  - **Test scenarios:**
    - Querying branch listings, categories, bundles, and distributors returns correct counts without alias errors.
  - **Verification:** `Unknown alias` errors drop to 0.

- [ ] **Unit 4: Analytics Queries & pg-mem Compatibility Polyfills**
  - **Goal:** Fix timestamp casting, isolation syntax, and math function support across Analytics & Intelligence routes.
  - **Dependencies:** Unit 3
  - **Files:**
    - `server/src/modules/intelligence/analytics/repository.ts`
    - `server/src/modules/intelligence/ai/repository.ts`
    - `server/src/modules/inventory/products/service.ts`
    - `server/tests/verification/endpointHealth.test.ts`
  - **Approach:**
    - Ensure timestamp intervals and date casts use ISO strings or compatible SQL syntax (`CURRENT_DATE - INTERVAL '30 days'` sanitized).
    - Register standard SQL functions (`ROUND`, `DATE_TRUNC`, `LENGTH`) in `memDb.public.registerFunction` in test harness.
  - **Test scenarios:**
    - All analytics endpoints (`dashboard`, `revenue`, `top-products`, `customer-ltv`, `hourly-heatmap`, `anomalies`) return 200 OK with valid metrics.
  - **Verification:** All 15+ analytics/intelligence 500 errors eliminated.

- [ ] **Unit 5: Complete Verification Suite Execution & Report Regeneration**
  - **Goal:** Run the full automated verification test suite to regenerate `docs/reports/api-verification-report.md` confirming 0 server failures.
  - **Dependencies:** Units 1–4
  - **Files:**
    - `docs/reports/api-verification-report.md`
  - **Verification:** `npx vitest run tests/verification/endpointHealth.test.ts` passes with 0 Server Errors (500s).
