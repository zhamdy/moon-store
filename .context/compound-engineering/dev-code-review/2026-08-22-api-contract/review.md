# API contract review

Mode: autofix
Base: main

## Applied fixes

- Standardized upload middleware errors.
- Paginated vendor payout history.
- Rejected invalid report/export dates.
- Reset narrowed filters to page one.
- Hid inert server-side search/sort controls and corrected total row counts.
- Expanded conformance checks to mounted middleware.

## Residual actionable work

- Move row-oriented Intelligence pagination from controller array slicing into PostgreSQL queries with scoped counts and full-filter summaries.
- Either implement advertised `sortBy`/`sortOrder` in every migrated repository or reject those parameters where sorting is unsupported.
- Complete URL synchronization for shareable collection state identified by the implementation plan.
- Expand the endpoint manifest guardrail from router prefixes to every mounted verb/path and authorization scope.

## Verification

- Server suite: 132/132 passed before review fixes; focused post-fix server tests: 11/11 passed.
- Client suite: 212/213 initially; stale Promotions assertion fixed and focused test passed. Focused post-review client tests: 15/15 passed.
- Server and client lint: zero errors.
- Client production build: passed.
