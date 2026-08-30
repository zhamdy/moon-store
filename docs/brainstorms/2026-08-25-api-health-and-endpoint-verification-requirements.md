---
date: 2026-08-25
topic: api-health-and-endpoint-verification
---

# API Health and Comprehensive Endpoint Verification Suite

## Problem Frame

Recent database schema changes and query updates have caused several endpoints across Moon Store to return unhandled `500 Internal Server Error` responses. Developers and operators need an automated verification suite that exercises all registered endpoints across modules (both read operations and mutation flows), catches database mismatch regressions, and produces structured diagnostic reports for any failing routes without polluting persistent data.

## Requirements

**Test Suite & Execution**
- R1. An automated verification test runner covers all endpoints registered in `server/src/http/endpointManifest.ts` across all modules (Core, Inventory, Commerce, POS, Fulfillment, Intelligence).
- R2. Tests exercise both read endpoints (`GET` with listing, pagination, filtering, single-resource retrieval) and write endpoints (`POST`, `PUT`, `PATCH`, `DELETE` with representative payloads).
- R3. Tests authenticate requests using appropriate test roles (`Admin`, `Cashier`, `Delivery`) and test unauthenticated access where public endpoints are permitted.

**Database Isolation & Safety**
- R4. Write tests run with database transaction rollbacks or automated cleanup hooks so test mutations do not corrupt or leave leftover artifacts in the database.
- R5. Seed data integrity is verified prior to running verification suites.

**Diagnostic Reporting & Error Logging**
- R6. When an endpoint returns a `500 Internal Server Error` or unhandled exception, the suite captures and logs full diagnostic information (HTTP method, route, request payload, query params, response body, SQL query, and stack trace).
- R7. The runner outputs a clear summary report grouping passing routes, expected client error routes (e.g. 400 validation), and failing 500 routes with actionable root-cause hints.

## Success Criteria

- All endpoints listed in the manifest are systematically tested against a seeded database.
- Zero silent unhandled 500 errors in normal endpoint operations.
- Any failing endpoint is cataloged in a diagnostic report identifying the exact query or schema discrepancy.
- The test suite is runnable via an npm script (e.g., `npm run test:endpoints` or vitest suite).

## Scope Boundaries

- Does not rewrite client UI components or frontend state management.
- Does not modify existing database migrations unless a specific schema bug is identified during diagnosis.
- Does not replace standard unit test suites.

## Key Decisions

- **Comprehensive Read & Write Coverage**: Verification tests both GET and mutation flows across all registered routes.
- **Transaction Rollback / Automated Cleanup**: Protects database state during write tests.
- **Soft Diagnostic Reporting**: Captures detailed endpoint metadata, SQL queries, and error traces into a consolidated report when 500s occur rather than immediately aborting the full suite.

## Outstanding Questions

### Deferred to Planning
- [Affects R2][Technical] What are the minimal valid payloads for domain-specific mutation endpoints (e.g. shifts, layaway, exchanges)?
- [Affects R6][Technical] What logger / reporter format (JSON, Markdown, CLI table) is best for summarizing verification results?

## Next Steps
`/dev:plan` for structured implementation planning.
