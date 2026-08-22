---
date: 2026-08-22
topic: api-response-and-server-listing
---

# API Response and Server-Side Listing

## Problem Frame

Moon Store's JSON API responses and collection query behavior are inconsistent. Some endpoints already return an envelope and perform pagination or filtering in the backend, while others return unpaginated arrays or use different conventions. The React client therefore carries endpoint-specific assumptions and sometimes performs list operations locally. The goal is one predictable JSON contract and backend-owned search, filtering, sorting, and pagination for user-facing collections.

## Contract Overview

```text
React route state (URL query parameters)
                  |
                  v
GET /api/v1/<resource>?page=1&pageSize=25&search=...&sortBy=...&sortOrder=...
                  |
                  v
Backend validates query -> filters/sorts/paginates at the data source
                  |
                  v
{ data: [...], meta: { pagination: ... } }
```

## Requirements

**Response contract**

- R1. Every successful JSON business response that contains a body returns `{ "data": ... }`, with optional `{ "meta": ... }` when contextual metadata is needed. The API must not return a redundant `success` flag; the `204` delete response in R3 is the explicit bodyless exception.
- R2. Every failed JSON business request returns `{ "error": { "code": string, "message": string, "details"?: ValidationDetail[] } }` with an appropriate HTTP status. Each validation detail is `{ "field": string, "code": string, "message": string }`; `field` supports nested paths, and all validation issues are preserved rather than only the first message.
- R3. Create operations return `201` with the created resource in `data`; update operations return `200` with the updated resource in `data`; successful delete operations return `204` with no body.
- R4. Operational health checks, file/image transfer, CSV or other exports, and backup downloads are exempt from the JSON envelope when their purpose requires another representation.
- R18. Public error codes, messages, and details are allowlisted and sanitized. Responses never expose stack traces, SQL or query errors, internal identifiers, secrets, or other diagnostic context; protected server logs retain only appropriately redacted diagnostics.

**Collection behavior**

- R5. User-facing collection endpoints perform search, filtering, sorting, and pagination in the backend; the React client must not fetch an entire collection and then apply those operations locally.
- R6. Collection endpoints use flat camelCase query parameters. Common parameters are `page`, `pageSize`, `search`, `sortBy`, and `sortOrder`; each resource may add documented flat parameters such as `status`, `categoryId`, `dateFrom`, or `dateTo`.
- R7. Paginated responses include `meta.pagination` with `page`, `pageSize`, `totalItems`, `totalPages`, `hasNextPage`, and `hasPreviousPage`.
- R8. The default page size is 25, supported choices are 10, 25, 50, and 100, and the hard maximum is 100.
- R9. Invalid filters, unsupported sort fields, invalid directions, malformed values, and unsupported page sizes return `400` with error code `VALIDATION_ERROR` and field-level details rather than being ignored or silently corrected.
- R10. Explicitly bounded lookup collections, such as small option lists, may return the complete array without pagination. They still use the standard `{ "data": [...] }` envelope.
- R19. Existing authentication, role authorization, and branch- or record-level scoping are preserved for every migrated endpoint. Authorization predicates apply before counting and pagination so neither rows nor totals disclose unauthorized records.
- R24. Low-stock products use the standard products collection with `lowStock=true`, retaining normal search, sorting, pagination, and metadata. The existing `/products/low-stock` behavior is only a temporary compatibility path and is removed when the products migration completes.
- R31. A syntactically valid page beyond the available range returns `200` with empty `data` and accurate pagination metadata. If records exist, React replaces the URL with the last valid page and fetches it; when `totalItems` is zero, the logical page is 1 and `totalPages` is 0.
- R32. Every collection sort is deterministic and includes `id` as a tie-breaker. Each response is correct for its request-time dataset; normal operational tables accept that concurrent writes may shift rows between page requests and do not maintain snapshot tokens. Reports or exports that require frozen results remain separate workflows.

**React behavior**

- R11. React list screens treat the backend response as the source of truth for rows and pagination totals.
- R23. The React transport error model preserves the server error `code`, `message`, HTTP status, and every validation detail so screens can associate field errors with their controls.
- R12. Safe search terms, filters, sorting, current page, and page size are synchronized with browser URL query parameters so views survive refresh and support browser navigation and sharing. Potentially sensitive search terms or identifiers are excluded under R30.
- R13. Changing search, filters, sorting, page, or page size triggers a backend request. Changes that invalidate the current page, such as changing a filter or page size, reset the current page to 1.
- R25. Search requests use a 300 ms debounce. Initial collection loading shows a table skeleton; subsequent query changes retain existing rows with a subtle loading indicator and disable only conflicting actions.
- R26. Collection screens distinguish an empty dataset from no matches for the active query. Request failures preserve prior rows when available, present a retry action, and associate validation details with the relevant filter controls.
- R27. Asynchronous result changes announce loading, result counts, empty results, and errors to assistive technology. Focus remains on the control that triggered the request unless an explicit user action requires otherwise.
- R28. Pagination, page-size, sorting, and committed filter changes push a browser-history entry. Debounced search changes replace the current entry so typing does not create a history step per term.
- R29. The React route validates URL query state before calling the API. Invalid or obsolete parameters are normalized to safe defaults and removed using history replacement; strict backend validation remains authoritative for direct or malformed API requests.
- R30. Each domain classifies URL-safe query state. Non-sensitive filters such as status, category, dates, sorting, and pagination remain shareable; potentially sensitive customer, sales, or transaction search terms stay outside the URL. Product names and SKUs may remain URL-safe. Request and access logs redact search values.

**Migration and compatibility**

- R14. Migration occurs incrementally within `/api/v1`, one domain at a time, with each backend contract change coordinated with its React consumers.
- R15. The products resource and every existing product-list consumer form the reference migration because they exercise search, resource-specific filters, sorting, pagination, bounded selection, and mutations. This includes the main inventory product table, low-stock view, product selectors used by bundles and collections, and product search used by POS where applicable. Categories, bundles, collections, stock counts, and other inventory resources migrate later.
- R16. The React application is the only API consumer. Once a domain and all of its React consumers are migrated and verified, its obsolete response shape may be removed without a public deprecation window.
- R17. Temporary compatibility adapters may exist only while a domain is actively migrating and must be removed when that domain's migration is complete.
- R20. Before obsolete contracts are removed, the migration verifies the sole-consumer assumption using repository references, tests, scripts, documented integrations, and runtime access evidence when available.
- R21. Planning produces an exhaustive `/api/v1` endpoint matrix that classifies each endpoint as an enveloped singleton, paginated collection, bounded lookup, mutation, or exempt response. The matrix is the migration checklist and source for contract acceptance tests.
- R22. The products reference pattern is not generalized until it is checked against at least one contrasting collection, initially sales history, covering date filters, aggregate metadata, and role-scoped transactional data.

## Success Criteria

- Every in-scope JSON response with a body follows the success or error envelope without endpoint-specific variants; successful `204` deletes remain bodyless.
- Every user-facing collection fetches only the requested server-filtered and server-paginated result set.
- React tables display server totals and retain their query state across refresh and browser back/forward navigation.
- Invalid collection queries fail consistently with structured, field-level validation errors.
- Authorization regression tests prove unauthorized records are absent from both collection rows and pagination totals.
- The endpoint matrix accounts for every `/api/v1` endpoint and its applicable contract or explicit exception.
- The products resource and all of its existing list consumers establish a tested reference pattern that can be applied to subsequent domains without redesigning the contract.
- Existing React workflows continue working as each domain is migrated.

## Scope Boundaries

- The work does not replace REST, rename the `/api/v1` resource hierarchy, or introduce `/api/v2`.
- The work does not add support for external, mobile, or third-party API consumers.
- Bounded lookup endpoints are not forced to paginate.
- Operational and binary/file endpoints are not forced into a JSON representation.
- Domain-specific filtering rules remain specific to their resource; the migration does not introduce a generic query language.

## Key Decisions

- Use HTTP status plus `data`/`error` envelopes: avoids the redundant current `success` boolean and gives all JSON consumers one shape.
- Use flat camelCase query parameters: keeps requests readable and sufficient for the application's filtering needs.
- Keep page-based pagination: it matches the application's table navigation and shareable URL requirements.
- Accept request-time page consistency: deterministic ordering prevents unstable ties without adding snapshot infrastructure to operational tables.
- Migrate incrementally in `/api/v1`: avoids a duplicated API while limiting the blast radius of each migration.
- Start with the products resource and all product-list consumers: it is the most representative existing collection and already has partial backend list support.

## Dependencies / Assumptions

- The existing React client is the only consumer of `/api/v1`.
- Resource repositories can apply filtering, sorting, counting, and page limits at the data-source level.
- Each collection exposes an explicit allowlist of supported filters and sort fields.

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R14-R17][Technical] Determine the safest domain migration sequence after the products reference migration by mapping React consumers and backend endpoint coverage.
- [Affects R16, R20][Needs research] Verify the sole-consumer assumption before removing obsolete contracts.
- [Affects R21][Technical] Build and approve the endpoint classification matrix before measuring whole-API completion.
- [Affects R1-R2][Technical] Identify the shared backend response, query-validation, and error-handling boundaries that minimize repeated controller logic.
- [Affects R11-R13][Technical] Determine how the existing transport, resource hooks, React Query keys, and table components should expose paginated collection results without breaking non-collection calls.
- [Affects R5-R9, R32][Needs research] Define resource-specific query-cost controls and verify indexes/query plans for allowed searches, filters, sorts, counts, and deep pages.
- [Affects R14-R17][Technical] Define backend-first compatibility and rollback ordering for renamed query parameters and the shared error model when client and server deployments are not atomic.

## Next Steps

Run `/dev:plan` against this document for structured implementation planning.
