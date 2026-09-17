# Code review: storefront product detail

- Branch: `zhamdy/storefront-product-detail`, base `43c20c3` (main)
- Scope: 62 files, +4573 / -69
- Mode: autofix
- Plan: `docs/plans/2026-09-14-003-feat-storefront-product-detail-plan.md` (explicit)
- Reviewers (14): correctness, testing, maintainability, project-standards,
  agent-native, learnings-researcher, security, performance, api-contract,
  data-migrations, reliability, adversarial, shaheen-react, deployment-verification
- Not run: dan-frontend-races (island has only synchronous local state),
  schema-drift-detector (no ORM model snapshots in this repo)

## Findings

| # | Sev | File | Issue | Reviewer | Conf | Route |
|---|-----|------|-------|----------|------|-------|
| 1 | P1 | `apps/storefront/features/products/api/get-catalog-product.ts:96` | Malformed slug (API 400 VALIDATION_ERROR) renders the error screen with HTTP 500 instead of a 404 (R2, KD-10). Confirmed live: `/en/products/Silk-Midi-Dress` -> 500 | security (residual), orchestrator verified | 0.95 | `safe_auto -> review-fixer` (implements plan R2) |
| 2 | P2 | `apps/server/services/productService.ts:440` | CSV import validates but never persists `description`/`description_en`. Downgraded from P1: the dashboard CSV has no description column; affects direct API callers | data-migrations | 0.88 | `safe_auto -> review-fixer` |
| 3 | P2 | `apps/server/src/modules/commerce/catalog/mappers.ts:135` | Variant attribute keys/values not Unicode-normalized (NFC vs NFD become different options; a variant is dropped) | adversarial | 0.72 | `safe_auto -> review-fixer` |
| 4 | P2 | `apps/server/src/modules/commerce/catalog/repository.ts:240` | `listProductCollections` filters `collection_products` by `product_id`, the non-leading PK column: sequential scan per cache miss | performance | 0.72 | `manual -> human` (needs a migration; plan allows only 015) |
| 5 | P3 | `apps/server/src/modules/commerce/catalog/mappers.ts:143` | Signature/combination keys joined with control characters that staff input can contain | adversarial | 0.65 | `safe_auto -> review-fixer` |
| 6 | P3 | `apps/server/src/modules/commerce/catalog/service.ts:110` | `has_variants` truthiness check duplicated in service and mapper | api-contract | 0.72 | `safe_auto -> review-fixer` |
| 7 | P3 | `apps/storefront/features/catalog/components/catalog-controls-state.ts:179` | Leftover `fillTemplate` re-export after the move to `lib/utils` | maintainability | 0.72 | `safe_auto -> review-fixer` |
| 8 | P3 | `apps/server/validators/productSchema.ts:10` | No test for the 5000-char description bound | testing | 0.62 | `safe_auto -> review-fixer` |
| 9 | P3 | `apps/storefront/features/products/components/purchase-panel.tsx:53` | Selection state could carry across product navigation. Downgraded from P1: the App Router keys page segments by param value (~75% confident it already remounts); an explicit `key={product.slug}` is added defensively | shaheen-react | 0.70 | `safe_auto -> review-fixer` |
| 10 | P3 | `apps/storefront/features/catalog/api/load-related-products.ts:27` | Best-effort related row reuses the 15s listing deadline | reliability | 0.65 | `manual -> human` |
| 11 | P3 | `apps/storefront/features/products/api/get-catalog-product.ts:13` | Two `isRecord` guards with different array semantics | maintainability | 0.65 | `advisory -> human` |

## Pre-existing

| File | Issue | Reviewer |
|------|-------|----------|
| `apps/storefront/features/collections/api/get-catalog-collection.ts` | Same malformed-slug bug: `/en/collections/Evening` -> 500 (API 400). Shipped in #196 | orchestrator verified |

## Discarded

- Parallelise `listGallery`/`listVariants`/`listProductCollections` with `Promise.all`
  (reliability): they share one pooled client inside one transaction, which runs
  statements serially; it would change nothing (performance reviewer flagged the same trap).
- Related row swallows every `ApiError` (reliability): this is PD-13 as written; advisory only.

## Advisory

- `displayedPrice` ranges over all variants, not the partial selection; only matters once a
  second option key exists (correctness).
- `purchase-panel-slot.tsx:33` casts `option.key` to the translated-key union; benign today
  (shaheen-react).
- No component-test harness: island radio semantics and the live region are verified only by
  the manual review (testing).

## Learnings

Every known pitfall checked was avoided: Zod key stripping (HTTP-boundary tests), HeroUI
`Controller`, live region mounted first, 014 NOT VALID caveat, pg-mem NUMERIC strings, TEXT JSON
parsed in the reader, `motion/react` ban, KD-10, `unstable_rethrow`, catalog limiter reuse.

## Agent-native

No parity gaps: the product read is a documented public route and descriptions are writable
through the products API the dashboard uses.

## Deployment notes

- Order: migrate (015) -> API -> storefront.
- Verify: `products.description`/`description_en` exist and are nullable; a known slug returns
  200 with `Cache-Control: public, max-age=60`; an unknown slug 404 with `no-store`.
- Logs: "dropped unusable variants" (`product_slug`, `variant_ids`) means malformed staff variant
  attributes, not the POS price bug; sustained 503s on the route mean the 2s statement timeout.
- Rollback: API/storefront code can roll back without the down migration; `.down.sql` discards
  any descriptions entered since deploy.

## Applied fixes

One fixer, one round; the orchestrator re-read the resulting diff (11 files, +98/-21).

| # | Outcome | Change | Test |
|---|---------|--------|------|
| 1 | fixed | `getCatalogProduct` maps `VALIDATION_ERROR` to `null`; live: `/en/products/Silk-Midi-Dress` 404 | `returns null on a 400 VALIDATION_ERROR (a malformed slug)` |
| 2 | fixed | `importProducts` writes descriptions; re-import without them keeps stored values (the `name_en` COALESCE rule) | `persists descriptions from a CSV import and keeps them when a re-import omits them` |
| 3 | fixed | `parseAttributes` NFC-normalizes key label and value after trim | `merges keys and values that differ only by Unicode normalization` |
| 5 | fixed | signature and combination keys built with `JSON.stringify` | `does not conflate combinations whose values contain control characters` |
| 6 | fixed | `rowHasVariants(row)` shared by mapper and service | existing suites |
| 7 | fixed | `fillTemplate` re-export removed; importers use `@/lib/utils/fill-template` | existing suites |
| 8 | fixed | new | `rejects a description longer than 5000 characters on create` |
| 9 | fixed | `key={product.slug}` on `PurchasePanelSlot` | none (no component harness) |

Verification: server lint 0 errors / 384 warnings (ratchet), `tsc` clean, 970 tests pass
(real-PG skipped in that run), `check:api-docs` / `check:route-auth` / `check:client-paths`
green; real-PG catalog + products suites 112/112 against a throwaway database; storefront
typecheck, lint, 345 tests, `next build` (`ƒ /[locale]/products/[slug]`).

## Residual (owner decisions, no todos created)

- #4 `collection_products(product_id)` index: needs a second migration; the plan allowed one.
- #10 shorter deadline for the related row: needs a new option on the shared listing fetch.
- Pre-existing collection malformed-slug 500.

## Verdict

Ready with fixes applied. No P0/P1 remain; every plan requirement R1-R14 is met in code,
with R9 (visual/keyboard/screen-reader review) and Unit 8 verification left to the owner's
screenshot review.
