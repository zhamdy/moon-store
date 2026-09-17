# Code review: storefront Shop + Collections

- Branch: `zhamdy/feat-storefront-shop-collections`, base `d607ef3` (main), 157 files, +14,747 / -358
- Plan: `docs/plans/2026-09-14-002-feat-storefront-shop-collections-plan.md` (explicit)
- Mode: autofix
- Reviewers: correctness+adversarial, security+api-contract, performance+reliability+data-migrations, testing, maintainability+project-standards, react+frontend-races, agent-native. `learnings-researcher` skipped: `docs/solutions/` does not exist.

## Fixer queue (applied in one pass)

| Sev | Finding | File | Source |
|---|---|---|---|
| P1 | Storefront price filter has no upper bound; server 400s above 10,000,000, the error boundary's retry loops on the same URL | `apps/storefront/features/catalog/search-params.ts`, `catalog-controls-state.ts` | correctness |
| P2 | No committed guard for the KD-10 invariant (no `loading.tsx` at/above catalog segments; slug pages call `notFound()`) | new `apps/storefront/app/**/catalog-routes.test.ts` | testing |
| P2 | Stale generate-barcode / generate-sku responses overwrite the product form after close/reopen or a category change | `apps/dashboard/.../ProductFormDialog.tsx` | react+races |
| P3 | Uncancelled scroll-into-view timer in the filter sheet | `apps/storefront/features/catalog/components/catalog-controls.tsx` | react+races |
| P3 | Route comments say `/api/collections`, mount is `/api/v1/collections`; 014 lock duration undocumented | `apps/server/src/modules/inventory/collections/routes.ts`, `apps/server/CLAUDE.md` | maintainability, perf |

## Residual: decisions for the owner (not auto-applied)

| Sev | Finding | Options |
|---|---|---|
| P1 | Server-side catalog fetches have no timeout (deliberate, KD: keep per-render memoization). A stalled-but-connected API holds SSR requests indefinitely. Build is unaffected: catalog routes are request-time. | Keep (API side has a 2s statement timeout) / add a generous timeout to list fetches only (entity fetches keep memoization) |
| P2 | Missing `CATALOG_SERVER_TOKEN` in production is warn-only; every shopper then shares a 300/15min per-IP bucket | Keep warn / fail boot in production |
| P2 | Migration 014 builds unique indexes inside the migration transaction (ACCESS EXCLUSIVE on `products` for the build) | Maintenance window (documented) / split into a non-transactional `CONCURRENTLY` migration |
| P2 | Listing runs the scoped join+aggregate twice (count/priceRange, then page) | Accept at current scale / fold into one window-aggregate CTE |
| P2 | One pooled connection pinned across 3-4 catalog queries; production pool max 20 shared with POS | Accept / dedicated catalog pool / split reads |

### Owner decisions (2026-09-14)

| Finding | Decision | Status |
|---|---|---|
| SSR catalog fetch timeout | 15s timeout on the product-list fetch only; entity fetches keep memoization | applied in round 2 |
| Missing token in production | Fail boot in production; `CATALOG_PUBLIC_ONLY=true` opts out | applied in round 2 |
| 014 index locks | Deploy in a maintenance window (documented in `apps/server/CLAUDE.md`) | done in fix commit `9e6b678` |
| Double scan + pinned connection | Defer; tracked in the plan's Deferred list for the B-9 launch load review | recorded in round 2 |

## Applied fixes (round 1, commit `9e6b678`)

All five fixer-queue items. Storefront 265 tests, dashboard 693 tests, server tsc and lint (384 warnings) green. The two dashboard race tests were confirmed to fail with the guards removed.

## Pre-existing (not counted)

- `ProductsRepository.create/update` have no callers (`apps/server/src/modules/inventory/products/repository.ts:211,231`).

## Advisory

- `products/api/list-catalog-products.ts` imports a type from `features/catalog/search-params.ts`; documented one-way edge, no cycle.
- Dashboard slug pattern mirrors the server's by hand (commented).
- No e2e spec covers Shop/Collections; 404 status and the client error screen are proven only by the uncommitted capture.
- `history: 'push'` on every filter commit adds a history entry per change (KD-14 choice).
- Agent-native parity: no gaps.

## Requirements completeness

R1-R21 and R10b addressed across Units 1-12. Unit 13 docs done; its capture review (AD-12) is pending the owner's run. Unaddressed: none.
