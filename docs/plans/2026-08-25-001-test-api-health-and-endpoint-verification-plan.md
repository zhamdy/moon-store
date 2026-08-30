---
title: "test: Automated API health and comprehensive endpoint verification suite"
type: test
status: active
date: 2026-08-25
origin: docs/brainstorms/2026-08-25-api-health-and-endpoint-verification-requirements.md
---

# test: Automated API health and comprehensive endpoint verification suite

## Overview

Build and execute an automated verification harness that runs against a seeded database to exercise every mounted endpoint in `server/src/http/endpointManifest.ts`. The suite tests both read and write paths with role authentication (`Admin`, `Cashier`, `Delivery`, and `Public`), wraps mutation calls with transactional rollbacks/cleanup to preserve database state, intercepts unhandled `500` server errors, and generates an actionable diagnostic report detailing failing queries, schema mismatches, and route locations.

## Problem Frame

Recent database schema migrations and query refactorings introduced regressions where certain endpoints fail with unhandled `500 Internal Server Error` due to table column mismatches, stale SQL queries, or unhandled nulls. A comprehensive verification suite is needed to sweep across all modules (Core, POS, Inventory, Commerce, Fulfillment, Intelligence), verify endpoint health against seeded PostgreSQL data, and output detailed diagnostics so developers can isolate and resolve database discrepancies.

## Requirements Trace

- **Test Suite & Execution:** R1, R2, R3 (Full manifest coverage, read/write coverage, role authorization testing).
- **Database Isolation & Safety:** R4, R5 (Seed integrity check, transactional rollback / test mutation cleanup).
- **Diagnostic Reporting & Error Logging:** R6, R7 (Capture 500 stack traces, SQL errors, and output formatted failure diagnostics report).

## Scope Boundaries

- Non-goal: Modifying frontend React components or store slices.
- Non-goal: Modifying existing database migration scripts unless an explicit bug or missing column is identified.
- Non-goal: Replacing Vitest unit test suites or mock-based repository tests.

## Context & Research

### Relevant Code and Patterns

- `server/src/http/endpointManifest.ts`: The authoritative catalog of 38 mounted routers and detailed endpoint definitions with HTTP methods, classifications (`P`, `B`, `S`, `M`, `E`), and role authorization rules.
- `server/src/router.ts`: Maps all 38 module routers under `/api/v1/*`.
- `server/src/database/pool.ts` & `server/src/database/transaction.ts`: Manages database connections and transactions.
- `server/src/database/seed.ts`: Seeds Egyptian Arabic test data for categories, users, products, customers, distributors, branches, etc.
- `server/index.ts`: Application entry point setting up middleware, route tables, error handlers, and Express app configuration.

## Key Technical Decisions

| Decision | Direction | Rationale |
|---|---|---|
| Test Harness Structure | Standalone verification test script & Vitest integration (`server/tests/verification/endpointHealth.test.ts` & `server/src/tools/verifyEndpoints.ts`) | Allows running via `npm run verify:api` as a standalone diagnostic tool or inside standard CI via `npm test`. |
| Request Execution Seam | Supertest / Express app direct dispatch with mock auth tokens | Avoids needing an active network port while testing full Express pipeline (middleware, route guards, validators, services, repositories, DB). |
| Mutation Safety | Begin transaction before write requests or execute within isolated transactional rollback wrappers | Ensures write tests can execute representative payloads without corrupting seeded DB state. |
| Diagnostic Interception | Custom error recorder middleware attached during verification run | Captures exact SQL query, parameter values, error code, and stack trace when a 500 error occurs. |
| Diagnostic Output | Formatted CLI table + Markdown report saved to `docs/reports/api-verification-report.md` | Provides immediate terminal feedback and persistent diagnostic artifact for planning bug fixes. |

## Open Questions

### Resolved During Planning

- **Q: How to authenticate requests without hitting external auth services?**
  - *Resolution:* Generate signed JWT tokens using the test `JWT_SECRET` for Admin, Cashier, and Delivery roles directly in the test helper.
- **Q: How to handle routes that require specific parameters (e.g. `:id`)?**
  - *Resolution:* Query existing seeded entity IDs (e.g. first product, user, branch, category) during setup to populate path parameters dynamically.

### Deferred to Implementation

- **Payload templates for complex mutations:** Define representative minimal valid payload dictionaries in a dedicated test payload fixture module (`server/tests/verification/fixtures.ts`).

---

## Implementation Units

- [ ] **Unit 1: Test Auth Helpers & Seeded Fixture Provider**
  - **Goal:** Provide signed tokens for each role and helper functions to query seeded entity IDs for dynamic URL parameters (`:id`, `:branchId`, etc.).
  - **Requirements:** R3, R5
  - **Dependencies:** None
  - **Files:**
    - `server/tests/verification/authHelpers.ts`
    - `server/tests/verification/fixtureProvider.ts`
  - **Patterns to follow:** `server/tests/auth.test.ts`, `server/src/database/seed.ts`
  - **Test scenarios:**
    - Happy path: Generate valid Admin, Cashier, Delivery JWT tokens that satisfy `verifyToken` and `requireRole`.
    - Happy path: Query database for seeded IDs (product, category, user, branch, customer, sale).
  - **Verification:** Helper functions resolve valid tokens and seeded record IDs without errors.

- [ ] **Unit 2: Express Verification Test Harness & Error Diagnostic Collector**
  - **Goal:** Create an Express test runner harness with custom middleware to capture diagnostics (SQL, stack trace, parameters) on 500 errors.
  - **Requirements:** R6, R7
  - **Dependencies:** Unit 1
  - **Files:**
    - `server/tests/verification/diagnosticCollector.ts`
    - `server/tests/verification/testApp.ts`
  - **Patterns to follow:** `server/index.ts`, `server/middleware/errorHandler.ts`
  - **Test scenarios:**
    - Happy path: Captures successful 200/201/204 response details.
    - Error path: Intercepts 500 exceptions, extracts SQL query and error messages, and adds to diagnostics list.
  - **Verification:** Triggering a simulated error records full diagnostic context.

- [ ] **Unit 3: Comprehensive Endpoint Verification Runner**
  - **Goal:** Implement the test suite traversing all endpoints from `endpointDetailsManifest` / `endpointManifest`, executing GET and mutation requests across all domains.
  - **Requirements:** R1, R2, R3, R4
  - **Dependencies:** Unit 1, Unit 2
  - **Files:**
    - `server/tests/verification/endpointHealth.test.ts`
    - `server/tests/verification/payloads.ts`
    - `server/package.json` (add `"verify:api"` script)
  - **Patterns to follow:** `server/src/http/endpointManifest.ts`, `server/tests/http/contracts.test.ts`
  - **Test scenarios:**
    - Happy path: GET requests for all 38 domains return 2xx / valid enveloped response.
    - Happy path: POST/PUT/DELETE requests succeed without polluting DB (using transaction rollback/cleanup).
    - Diagnostic path: Endpoints returning 500 are logged softly without halting the remaining endpoint tests.
  - **Verification:** Running `npm run verify:api` executes all endpoints and outputs diagnostic summary.

- [ ] **Unit 4: Diagnostic Reporting & Summary Generator**
  - **Goal:** Generate a Markdown and terminal report summarizing passing endpoints, expected client errors, and cataloging all 500 failures with root cause hints.
  - **Requirements:** R6, R7
  - **Dependencies:** Unit 3
  - **Files:**
    - `server/tests/verification/reportGenerator.ts`
    - `docs/reports/api-verification-report.md`
  - **Patterns to follow:** Markdown report format, console summary table
  - **Test scenarios:**
    - Happy path: Generates structured Markdown report with pass/fail counts, route breakdown, and error tables.
  - **Verification:** Markdown report is generated and accurately lists any failing queries/endpoints.
