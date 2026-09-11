# MVP scope reduction review

Mode: autofix
Base: c6a196a (main)
Plan: docs/plans/2026-09-11-001-refactor-mvp-scope-reduction-plan.md (explicit)
Reviewers: correctness, testing, maintainability, project-standards, agent-native, security,
api-contract, adversarial, shaheen-react, frontend-races. learnings-researcher was skipped
because `docs/solutions/` does not exist. data-migrations, reliability and performance were
skipped because the diff changes no migration, retry, job or query shape.

## Applied fixes

Fixed automatically by the review fixer (safe fixes):
- **Exports download link.** It is now attached to the page before the click, and its URL is
  revoked on the next tick. WebKit can open a revoked blob when the link is detached.
  (`0b29df4`)
- **Bundles path.** It is now the named constant `BUNDLES_PATH`, instead of a literal
  retyped by hand in two POS files. (`6cca6c0`)
- **Stale comments.** Task references are gone, and the `openapi.ts` header no longer
  carries endpoint counts. (`3609bdb`)
- **Admin-only tests.** `GET /online-orders` and `PUT /online-orders/:id/status` are now
  tested as Admin-only for Cashier and Delivery. The test checks through the DB that a
  refused status write changes nothing. (`b0dd778`)

Approved by the user (gated):
- **CSV formula guard.** It now catches a trigger after leading whitespace, and a leading
  `|` (the DDE trigger). Before, `' =HYPERLINK(...)'` was exported unescaped, and Cashiers
  can write customer names. (`f224fdf`)
- **Exports wording.** The heading and dropdown now read "Download Export" and "Data"
  instead of "Generate Export" and "Module", with the keys renamed in both locales.
  (`83cd4dc`)
- **Arabic Insights section label.** It now reads "الرؤى والتقارير". (`3648802`) Its Sidebar
  test still expected the old label and failed the final client run; it was fixed in
  `5656c03`.

Round-two nit:
- **`BUNDLES_PATH` comment.** Removed a comment that named its caller. (`4f70392`)

## Residual actionable work

- **The 404 test does not exercise the real app.** The test for removed paths re-mounts
  `routeTable` with a copied fallback. Extract an app factory that `server/index.ts` and
  the tests both use. (`server/tests/http/contracts.test.ts:197`)
- **`GET /exports/sales` is unbounded.** It has no LIMIT, builds one in-memory string, and
  sends it as one buffered response. The user accepted this for the MVP. The follow-up is
  streaming or a default window, together with a date range in the UI.
- **Pre-existing role and route breakages in retained screens.** The user decided they go
  in a separate PR before launch:
  - Every `/delivery` route is Admin-only, so the Delivery role's only screen cannot load.
  - `GET /customers` is Admin-only, so Cashier customer search at checkout fails.
  - StockCount calls approve and DELETE routes; the server serves `complete` and `cancel`.
  - `GET purchase-orders/auto-generate` does not exist.

## Advisory

- **Stale tills.** Tills on an old PWA build will call the removed `/layaway`, `/vendors`
  and `/ai` routes until every tab closes. Deploy after the production reset, and send a
  staff note.
- **Duplicated gate-lift comment.** It is repeated on the six gated routes, because the
  plan asks for one per route.
- **Phone numbers in CSV.** An international number such as `+20…` now exports with a `'`
  prefix. Excel hides the prefix; raw consumers see it. This is a deliberate trade-off of
  the guard.
- **Two separate lists.** The client's `POSTPONED_PATHS` and the server's Admin gates share
  no source of truth, so reactivating a feature means touching both.
- **Fullwidth lookalikes.** `＝ ＋ － ＠` are not treated as triggers. Mainstream Excel does not
  evaluate them.
- **The e2e run deletes local uploads.** Its media sweep deletes the tracked
  `server/uploads` files unless `MEDIA_LOCAL_ROOT` points elsewhere. This was observed on
  the first smoke run and restored from git. It is recorded in `CLAUDE.md` Learnings.

## Requirements completeness

- R1–R9 are met.
- R5 was verified by an API contract audit: a runtime walk of `routeTable` against every
  client call.
  - Retained screens have no call left to a removed or never-served path.
  - Hidden-screen residue is listed rather than fixed, as the plan intends.
- R10 is the final report delivered to the user.

## Verification

Final gates were run on the finished branch at `4f70392`, plus `5656c03`, which only
changes a test.

- **Server:**
  - `tsc` is clean.
  - Lint shows 0 errors and 384 warnings, at the `--max-warnings 384` cap.
  - `check:api-docs` passes: 192 served routes, 189 with derived request contracts,
    3 excused.
  - The full suite on real PostgreSQL passes: 73 files, 902/902 tests, 0 skipped.
- **Client:**
  - `tsc` is clean.
  - Lint shows 0 errors.
  - The full suite at `4f70392` gave 648/649. The one failure was the stale Arabic label
    assertion; after `5656c03`, Sidebar plus Layout parity give 15/15.
  - The production build passes, with no drift in `routeTree.gen.ts`.
  - The bundle budget is within limits:
    - initial 402/414
    - pos 15/20
    - inventory 12/16
    - analytics 4/9
    - sales 11/14
- **Migrations:** `verify:migrations` reports that all 13 migrations round-trip.
- **E2E smoke:** 26/26 in 1.0 min on the final build, against `moon_store_e2e`, with
  `MEDIA_LOCAL_ROOT` pointed at a scratch directory. `server/uploads` was untouched.
- **Reviewer checks:**
  - The api-contract reviewer re-ran `check:api-docs` and the conformance tests (exactly
    35 mounts).
  - The security reviewer walked every `routes.ts`. The only non-GET handlers without
    `verifyToken` are `POST /auth/login` and `POST /auth/refresh`.
