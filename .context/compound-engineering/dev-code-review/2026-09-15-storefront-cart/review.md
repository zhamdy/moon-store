# Code review — storefront cart (guest bag + cart quote)

- **Run:** 2026-09-15, `dev-code-review mode:autofix`
- **Branch:** `zhamdy/feat/storefront-cart`, base `main` (merge-base `2b1ff64`), 15 commits, 73 files, +8,889 / −176 before fixes
- **Plan:** `docs/plans/2026-09-15-001-feat-storefront-cart-plan.md` (`plan_source: explicit`)
- **Intent:** a guest bag held in browser `localStorage` (Add to Bag, header trigger + badge, lazy drawer, static `/[locale]/bag`), priced by a new public read-only `POST /api/v1/catalog/cart/quote` with its own CORS / limiter / 16kb parser chain. No checkout, payment, reservation or server cart.

## Review team (12)

| Reviewer | Why |
| --- | --- |
| correctness, testing, maintainability, project-standards, agent-native | always on |
| security | new unauthenticated public POST, path-scoped CORS/limiter/parser, untrusted `localStorage` parsing |
| performance | batched catalog reads per quote, debounced re-quotes, eager JS on every page |
| api-contract | new endpoint contract, storefront DTO + hand validation, OpenAPI, manifest |
| reliability | statement timeout, retry policy, storage failure, quote failure states |
| adversarial | ~8.9k-line diff across a public endpoint and client state |
| shaheen-react | new React 19 islands, hooks, shared TS contracts |
| dan-frontend-races | debounced keys, store-writing effects, focus after fades, cross-tab events, lazy drawer |

`learnings-researcher` not run: `docs/solutions/` does not exist in this repo. No migrations, so no schema-drift or deployment-verification agents.

## Findings

Severities are after synthesis; several were re-graded from the reviewer's value after verifying in code (noted).

### P1

1. **A failed drawer chunk crashed every route** — `apps/storefront/features/cart/components/bag-trigger.tsx:104` (reliability; reviewer P0, re-graded P1: needs a chunk-load failure). `React.lazy` caches a rejected import and re-throws on every render; `Suspense` does not catch errors; the only error boundary, `app/[locale]/(catalog)/error.tsx`, is not an ancestor of the header. Verified. **`safe_auto` → fixed.**
2. **Headless UI focus restore can override `#main-content` focus after a navigation close** — `apps/storefront/features/cart/components/bag-drawer.tsx:34` (dan-frontend-races, 0.72). `closeForNavigation()` focuses `#main-content` on the next frame, but the Dialog's FocusTrap restores focus to the invoker when its leave transition unmounts (~`duration-base` later). Headless UI exposes no documented switch to disable restore. **`gated_auto` → human.** Browser check: add → View bag, confirm where focus ends.

### P2

3. **Repeat-announcement frame could overwrite a newer message** — `features/cart/components/drawer-announcer.ts:27`, same pattern in `bag-view.tsx:42` (dan-frontend-races 0.65/0.60, merged with testing's "announcer untested" 0.70). **`safe_auto` → fixed** with a generation token, plus `drawer-announcer.test.ts`.
4. **`server-only` rule stated as universal** — `apps/storefront/CLAUDE.md:542` (project-standards, 0.75). The browser quote client is the documented CD-4 exception. **`safe_auto` → fixed.**
5. **`resolveStorefrontOrigins` defaults untested** — `apps/server/src/app.ts:34` (testing, 0.72). Production-unset must allow no origin. **`safe_auto` → fixed** (`tests/http/storefrontOrigins.test.ts`).
6. **Back navigation to `/bag` with the drawer open runs two controllers for a frame** — `features/cart/components/bag-drawer.tsx:96` (adversarial; reviewer P1, re-graded P2). The drawer closes from a passive `useEffect` after paint while `/bag`'s controller is always active. Realistic trigger is the browser/hardware Back button (the Dialog is modal, so header links are not clickable). Verified. The duplicate "Your bag was updated" half is now prevented by fix 9; the one-frame overlay and a possible duplicate quantity announcement remain. What Back should do with an open drawer is a design decision. **`manual` → human.**
7. **Post-remove focus can be lost if the drawer closes during the 180ms fade** — `features/cart/components/use-bag-controller.ts:140` (dan-frontend-races, 0.62). The after-render focus effect has no `active` guard. **`gated_auto` → human.**
8. **Header Bag island re-renders on unrelated session writes** — `features/cart/components/bag-trigger.tsx:55` (performance, 0.72). `useCartSession()` returns the whole session object; price-memory and announcement writes replace it. **`manual` → downstream-resolver.** Options: split the session snapshot, or a selector subscription.
9. **Failed/empty-state markup and `TEXT_ACTION` duplicated between drawer and page** — `features/cart/components/bag-view.tsx:97` vs `bag-drawer.tsx:162` (maintainability, 0.65). **`manual` → human.**
10. **Double cast in `plural()` erases next-intl key typing** — `features/cart/utils/bag-strings.ts:125` (shaheen-react, 0.72). The narrower cast suggested does not typecheck (next-intl types `raw` for leaf keys only). Risk now mitigated by a test (fix 13). **`manual` → human.**

### P3

11. **OpenAPI description said classification `B`; manifest says `S`** — `apps/server/src/docs/openapi.ts:10262` (api-contract, 0.82). **`safe_auto` → fixed.**
12. **Unused `getChooseOptionTemplate`** — `features/cart/utils/bag-strings.ts:147` (maintainability, 0.90). **`safe_auto` → fixed.**
13. **Overlapping-remove key filter untested; plural keys not pinned to both catalogues** (testing 0.62; shaheen-react testing gap). **`safe_auto` → fixed:** `visibleRowKeys` extracted and tested; `PLURAL_KEYS` exported with a completeness type check and `bag-strings.test.ts`.
14. **Strict Mode re-run announced twice** — `features/cart/components/use-bag-controller.ts:117` (dan-frontend-races, 0.60). **`safe_auto` → fixed:** the guard reads the live store.
15. **Catalog read limiter's quote skip never matches** — `apps/server/src/http/rateLimits.ts:284` with `catalog/routes.ts:35` (api-contract; reviewer P2 0.62, re-graded P3). `isCartQuotePath` tests `req.path`, which is router-relative (`/cart/quote`) inside the catalog router. Verified. Real quotes are unaffected (the POST is registered before the limiter); only a stray non-POST to the quote path spends a catalog read too, contradicting the comments. **`gated_auto` → downstream-resolver** (changes rate-limit accounting). Fix: match `req.baseUrl + req.path`, plus a test.
16. **`quantityControl` never reads its documented `pending` input** — `features/cart/utils/quantity-control.ts:50` (correctness, 0.62). **`manual` → human.**
17. **Root `CLAUDE.md` Learnings is at 20; its rule says under 20** — `CLAUDE.md:191` (project-standards, 0.60). **`manual` → human** (which entry to prune).

## Applied fixes

Commits `d171cd6` (storefront) and `6827fc1` (server: `openapi.ts`, `tests/catalogCartQuote.test.ts`, `tests/http/storefrontOrigins.test.ts`); full server suite on real PostgreSQL afterwards: 94 test files passed:

- `features/cart/components/drawer-error-boundary.tsx` (new, no directive): renders `null` on error. `bag-trigger.tsx` holds `lazy(loadDrawer)` in state; on error closes the drawer, unmounts the host and replaces the lazy reference so the next open retries. False retry comment in `add-to-bag-button.tsx` corrected.
- Generation-token guard in `drawer-announcer.ts` (exports `getDrawerAnnouncement`) and in `bag-view.tsx`'s `announce`.
- Live-store `announcedQuoteKeys` check before announcing in `use-bag-controller.ts`.
- `visibleRowKeys` in `bag-view-model.ts`; `PLURAL_KEYS` in `bag-strings.ts`; `getChooseOptionTemplate` removed.
- `apps/storefront/CLAUDE.md` exception clause; OpenAPI `B` → `S`.
- Tests added: `drawer-announcer.test.ts` (4), `bag-strings.test.ts` (both locales × 7 families), `visibleRowKeys` (3), `storefrontOrigins.test.ts` (4), quote `HEAD` → 404, raw `__proto__` option key (200, key dropped, no prototype pollution). Already covered and not duplicated: `GET` → 404; a non-allowlisted origin gets no `Access-Control-Allow-Origin`.

Verification after fixes: server lint 384 warnings (ratchet unchanged), `tsc --noEmit` clean, `catalogCartQuote` + `tests/http` 194 passed, `check:api-docs` 209 routes; storefront lint clean, typecheck exit 0, vitest 55 files / 584 tests, `next build` with `/en`, `/ar`, `/en/bag`, `/ar/bag` static. `/en` eager JS 251,064 B gz (+143 B for the boundary). Re-review round 1 of the changed scope (orchestrator, by reading the diff): no new defects.

## Residual actionable work (downstream-resolver)

- #8 header island re-render fan-out.
- #15 catalog limiter skip uses the router-relative path.

The `todo:create` skill is not installed in this environment, so no `docs/todos/` files were created; these are recorded here and in the PR description instead.

## For a human decision

#2 focus restore vs `#main-content`, #6 Back with the drawer open, #7 focus after remove during close, #9 duplicated failed-state markup, #10 `plural()` cast, #16 unused `pending`, #17 Learnings count.

## Advisory / release

- Launch prerequisites: production `TRUST_PROXY` set to the exact hop count or list (never `true`); `STOREFRONT_ORIGINS` set to exact storefront origins; storefront `NEXT_PUBLIC_API_URL` pointing at the API. Edge per-client limiting still required (UD-5).
- Owner-accepted: +6.1 KB gz eager JS on every page (budget 5 KB); stock below 10 and in-stock state enumerable within the quote rate limit (CD-7).
- A drawer that fails on every render now closes silently: the header Bag click does nothing, `/bag` still works. Whether Turbopack's runtime retries a failed chunk on a fresh `import()` is unverified — browser check with the chunk blocked.
- Both apps cap a line at 5 option keys; a product with more than 5 variant attributes would make the whole quote a 400, not a per-line `variantUnavailable`.
- `openapi.ts` hard-codes `maximum: 10` for `maxQuantity`; nothing gates response schemas against `MAX_LINE_QUANTITY`.
- `sanitizeBody`'s treatment of tag-like option values remains unverified (plan open item).
- The body-parser error handler on the quote path sends `no-store` only for recognised 4xx parser errors; an unrecognised one falls through to the shared handler (suppressed finding, 0.55).
- Arabic bag copy is a first draft for the native review on #201.

## Pre-existing (not counted)

- `docs/ACCESSIBILITY.md` → *Decisions* says sold-out sizes use `text-disabled`; the code and storefront `CLAUDE.md` use `text-text-secondary`.
- `main` CI: one failing dashboard test, `src/features/admin/pages/Settings.test.tsx` › "loads the storefront policies and sends them, edited, in the merged save".

## Requirements completeness

| Req | Status | Evidence |
| --- | --- | --- |
| R1 guest add/change/remove/persist | met | `cart-store.ts`, `cart-lines.ts`, `cart-storage.ts` |
| R2 minimal versioned shape, no price/stock/name | met | `persisted-cart.ts` guard, `moon-fashion-cart` v1 |
| R3 server authoritative, no price in request | met | `.strict()` schema; price key → 400 |
| R4 single price rule, NULL price never 0, real PG | met | `deriveVariantOptions` reuse; `catalogCartQuote.realpg.test.ts` passed locally |
| R5 drawer + bag page | met | `bag-drawer.tsx`, `app/[locale]/bag/page.tsx`, `bag-view.tsx` |
| R6 visible reconciliation, no silent substitution | met | `reconcile.ts` statuses and notices |
| R7 Add to Bag via `purchaseReadiness`, no fetch | met | `add-to-bag-action.ts`, `purchase-selection-context.ts` |
| R8 merge same options, new line otherwise | met | `cartLineKey`, `addLine` |
| R9 stepper stops at 1, explicit Remove | met | `quantity-control.ts`, `quantity-stepper.tsx` |
| R10 subtotal only | met | `bag-summary.tsx`; no shipping/tax/checkout copy |
| R11 `formatPrice`, EN/AR plurals, RTL | met | `plural-templates.ts`, `bag-strings.test.ts`, logical CSS |
| R12 header count, no hydration mismatch | met in code; browser check pending | `bag-trigger-label.ts`, server snapshot `hydrated:false` |
| R13 graceful degradation | met after fix #1 | failed view, storage try/catch, drawer boundary |
| R14 WCAG 2.2 AA, announcement policy | partially — code met, #2/#6/#7 and screen-reader checks open | `docs/ACCESSIBILITY.md` scenario 8 |
| R15 controlled client growth recorded | met (budget overage owner-accepted) | `apps/storefront/CLAUDE.md` → *Bundle budget* |
| R16 no reservation / expiry / server cart | met | quote is read-only; no tables or migrations |

Units 1–8: all present in the diff.

## Coverage

- Suppressed below confidence gate: 1.
- Dropped as malformed: 0. Failed or timed-out reviewers: 0.
- Protected artefacts respected (`docs/plans/*.md`).
- Testing gaps that remain structural: no storefront DOM/browser harness, so focus, Dialog, live-region speech and the lazy-failure recovery are covered only by the manual QA matrix and `docs/ACCESSIBILITY.md` scenario 8.

## Verdict

**Ready with fixes.** All `safe_auto` findings are applied and verified. No P0 remains. The one open P1 (#2, focus restore after a navigation close) needs a browser check before deciding on a change; the rest are design decisions or low-impact residuals that do not block merge.
