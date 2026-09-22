---
title: "Shop + Product + Cart full-stack audit (Dashboard → DB → API → Storefront → Bag)"
type: audit
status: complete
date: 2026-09-22
plan: docs/plans/2026-09-22-001-test-shop-cart-fullstack-audit-plan.md
---

# Shop + Product + Cart full-stack audit

Read-only, evidence-backed audit of the whole commerce chain — from the dashboard form that
authors a product, through PostgreSQL, the public catalog API and the cart quote, to the
storefront's card, product page, bag drawer and `/bag`. No code was changed, no issue was
opened, no commit was made (AD-2). This report is the only artefact.

---

## Executive summary

**What was audited.** Branch `zhamdy/storefront-silk-edit-section` (25 commits ahead of
`main`, storefront-only), against the disposable PostgreSQL 18 database `moon_store_audit`,
with a live API on `:3001`, `next dev` and a production `next build` of the storefront on
`:3000`, and the Vite dashboard on `:5173`. Eleven units ran: every automated suite and gate,
HTTP-boundary probes of the public catalog and cart quote, schema introspection and migration
verification, dashboard authoring probes through the app's own API, a stock/price trace across
eight surfaces, and six controlled cross-app propagation scenarios.

**Headline conclusions, in the order the owner needs them.**

1. **The money is safe.** The server is authoritative on price, stock and publication state on
   every probe that attacked it. The browser holds intent only — slug, canonical options,
   quantity — proven by one serializer and 231 green cart tests. `.strict()` refuses a
   client-supplied `price`, `unitPrice` or `total` with a 400, and the server's own price does
   not move. A NULL variant price resolves to the product price on real PostgreSQL, never `0`,
   on all eight surfaces. The quote is `no-store` on every status a shopper can reach and is
   ≤5 s behind a dashboard write.
2. **Two things block further commerce work.** The homepage publishes nine product links and
   **five of them 404** (HIGH-1). And a product withdrawn from sale keeps serving a fully
   purchasable 200 product page from Next's data cache — observed for 22 minutes with no
   self-recovery and no operator lever to force it (HIGH-2, dev-mode evidence; see the caveat
   in that finding).
3. **The storefront CI test job is red on this branch today** (MED-1): a `.png` campaign asset
   added on 2026-09-21 breaks the editorial asset guard. `next build` still succeeds.
4. **The dashboard's stock truth is wrong for every variant product** (HIGH-4), and any product
   edit silently restores stock sold since the form opened, with no audit row (HIGH-3). Both
   are operator-integrity defects; the storefront reads the correct column throughout.
5. **The single biggest structural gap is test coverage, not code.** There is **no storefront
   E2E at all** and **zero storefront component tests**; `e2e/playwright.config.ts` starts only
   the API and the Vite dashboard. The browser half of this audit is therefore a 120-row matrix
   for the owner to run (Appendix A), not something CI re-runs.

**Counts.** 0 Critical · 6 High · 16 Medium · 13 Low, plus 9 observations and an extensive
*Confirmed correct* section. Three findings answer **yes** to the blocking question.

**Scope note (AD-1).** `apps/server`, `apps/dashboard` and `apps/server/src/database/migrations`
are byte-identical to `main` on this branch (`git diff --stat main -- apps/dashboard apps/server`
is empty), so **every server, dashboard and database finding below applies equally to `main`**.
Each finding states this in its `apps` line. Storefront findings apply to the branch; where a
finding is attributable to the branch's three Quick Add / product-card commits it says so.

---

## Repository state (R1)

### Branch and divergence

| Item | Value |
| --- | --- |
| Branch under audit | `zhamdy/storefront-silk-edit-section` |
| Divergence from `main` | 0 behind, **25 ahead** (`git rev-list --count main..HEAD` = 25) |
| Scope of the 25 commits | `apps/storefront` only, plus the root `CLAUDE.md` and one plan document |
| `apps/server`, `apps/dashboard`, migrations | **byte-identical to `main`** — verified empty `git diff --stat main -- apps/dashboard apps/server` |
| In-scope commits | `feat(storefront): make the card's Add to Bag a corner disc`; `feat(storefront): reveal the card's Add to Bag on the photograph`; `fix(storefront): anchor bag icon inside product image`; and `style(storefront): redesign silk edit around campaign image` (373b85a, which introduced MED-1) |

**Consequence:** auditing `main`'s Quick Add would have audited a control that no longer
exists, which is why AD-1 targets the branch. Conversely, every backend finding here is a
`main` finding and needs no re-confirmation there.

### Uncommitted files and their risk

`git status` at audit start and at audit end is identical except for this report:

| File | Change | Risk judgement |
| --- | --- | --- |
| `apps/storefront/AGENTS.md` | **Deletion of the entire `## Learnings` section** — two entries dated 2026-09-21 | **Act on this first.** See below. |
| `apps/storefront/next-env.d.ts` | Generated by `next typegen` | None. Regenerates on every build. |
| `apps/storefront/features/cart/components/quick-add.tsx` | CRLF line endings only, no content change | None. A `git diff` shows zero content hunks. |
| `docs/plans/2026-09-22-001-...-plan.md` | Untracked — this audit's own plan | None. |

**The `AGENTS.md` Learnings deletion is unintended loss, and the audit did not restore it
(AD-2) — it reports it.** The `next dev` agent-rules block above it *is* rewritten automatically
(`node_modules/next/dist/server/lib/generate-agent-files.js`), but that generator does not touch
a `## Learnings` section. The two deleted entries, recovered from `git diff` for the owner's
convenience, are:

> - Silk Edit uses one 16:9 campaign source for both image slots. Its full-height mobile
>   background needs height-based image sizes to keep the cover crop sharp, with the model at
>   82% horizontally. Keep the section `w-full` so the desktop aspect ratio and max-height
>   cannot shrink its width. (2026-09-21)
> - Product-card photo and overlay must both explicitly occupy column 1; setting only
>   row-start allows CSS Grid to create an implicit second column and shrink the photo.
>   (2026-09-21)

Both are load-bearing engineering notes about the exact CSS this branch rewrote — the second
one is the direct ancestor of the grid rule that MED-5 is about. Continuing on this branch will
eventually commit or discard the deletion either way, so the owner should decide now:
`git checkout -- apps/storefront/AGENTS.md` restores them.

### Environment and methodology, including one incident

- **Disposable database (AD-4).** `moon_store_audit` on local PostgreSQL 18 at `localhost:5432`,
  all 17 migrations plus the seed applied. `MEDIA_LOCAL_ROOT` was exported to a scratch
  directory outside the repository before any API booted — the #170 trap did not fire, and
  `git status apps/server/uploads` stayed clean throughout. U8 used two further scratch
  databases (`moon_store_audit_migcheck` for introspection, `moon_store_migcheck_tmp` for
  `verify:migrations`, which refuses any database name not matching `/test|ci|tmp|scratch/i`).
- **All mutations went through the app's own HTTP API** with an Admin JWT (AD-6, AD-8). SQL was
  `SELECT`-only, except U8's constraint tests, which ran inside rolled-back transactions.
- **A storefront `.env.local` was created for the audit stack.** It is gitignored; the tracked
  tree is unaffected.

**Environment incident — early probes hit the wrong database.** The audit API initially failed
to bind port 3001 (`EADDRINUSE`): a stale dev API already held it, pointed at the **real
`moon_store` dev database**. The first passes of U2 and U6 therefore probed the wrong data
(24 products, 0 variants, 0 non-active rows, no `CATALOG_SERVER_TOKEN`). This was caught before
any conclusion was retained. The stale process was stopped with the owner's approval, the audit
API was restarted against `moon_store_audit`, and **database identity was re-verified from both
ends** before any probe was trusted — word slugs on the wire (`satin-off-shoulder-blouse`, not
`mn-drs-001`), `SELECT count(*) FROM products` = 34, 8 variants, 0 `product_images`, and a
tokened catalog GET answering `RateLimit-Limit: 20000`. **U2 and U6 both re-ran every
data-dependent probe against the corrected stack**, and every live-proven claim in this report
is from that corrected stack.

One stray row was created in the real dev database during that window: **product id 32, SKU
`AUDIT-U6-001`, slug `audit-test-dress-u6`**. It was soft-deleted (`status = discontinued`, so
it is outside the public catalog) and the owner chose to leave it in place. No other working
database was touched; `moon_store` (31 products) and `moon_store_sf_smoke` (34) were verified
intact by row count.

**How this affects the evidence's weight.** Nothing in this report rests on the pre-correction
window. Where a claim could not be re-run live it says so in `proven-on` (the `inactive`
publication leg, the 429/503 cache headers, the variant-barcode price surface). Readers should
treat the `proven-on` field as load-bearing, not decorative.

### Ratchets — no drift, but no slack either

| Ratchet | `CLAUDE.md` says | Found in code | Actual measured | Drift |
| --- | --- | --- | --- | --- |
| ESLint `--max-warnings` (`apps/server/package.json`) | 384 | 384 | **384 warnings, 0 errors** | none |
| `EXPECTED_UNCONVERTED` (`apps/server/src/docs/requestContracts.ts:143`) | 3 | 3 | 3 of 209 | none |
| `EXPECTED_UNCLASSIFIED` (same file, line 156) | 0 | 0 | 0 | none |
| `EXPECTED_UNDER_PROTECTED` (`apps/server/src/http/endpointManifest.ts:1128`) | 0 | 0 | 0 | none |

**All four match exactly.** Two facts worth surfacing anyway:

1. **The lint ratchet sits at its ceiling with zero slack** — the run produced exactly 384
   warnings against a limit of 384. Any single new `any` anywhere in `apps/server` fails CI
   until the ratchet is lowered or the warning removed. That is the ratchet working, but it
   means the next backend commit has no headroom.
2. **`check:client-paths` gates the dashboard's API calls only.** All 185 resolved calls are
   under `apps/dashboard/src`; not one `apps/storefront` path appears. The storefront's fetch
   calls (`features/products/api`, `features/cart/api`, `features/catalog/api`) have **no
   equivalent drift gate**, and neither the storefront's typecheck, its tests nor `next build`
   verify a route against the live router. A storefront call to a URL the server stopped
   serving would ship green.

### Working tree at audit end

`git status --short` shows exactly the three pre-existing dirty files, the untracked plan
document, and this new report. No repository file was edited. U8's scratch introspection
scripts were written outside the repository.

---

## How to read the findings

Every finding carries the plan's eleven fields verbatim: severity/title, `apps`, `files`,
`contract`, `repro`, `expected`, `actual`, `impact`, `cause`, `fix`, `blocks`, `proven-on`.
No field is a placeholder.

- **`contract` (AD-3).** Severity is graded against a written contract — a CD-n / PD-n / KD-n
  decision, a `CLAUDE.md` paragraph, or the test that pins it. Where the field reads
  `none — observation`, the item is graded by its consequence rather than by a violated
  contract, and the owner may rule it out of scope without re-litigating a settled decision.
- **`blocks` (AD-11).** Yes or no, plus one sentence. Three findings answer yes: HIGH-1,
  HIGH-2 and MED-1.
- **`proven-on` (AD-5).** `real PostgreSQL` and `live stack` are evidence. `code reading only`
  is a reasoned claim awaiting confirmation. A pg-mem-only green is never reported as passing.

Findings that two units both reported are merged once here, keeping the strongest `proven-on`
label; each merge is noted in its title line.

---

## Critical

**None.** No finding in this audit reaches Critical. The three blocking findings are graded
High: two are shopper-facing but bounded and reversible (a broken homepage link set, a stale
cached page), and the third is a red CI gate rather than a production fault. Nothing was found
that lets a shopper be charged a price the server did not set, that leaks cost, stock or
internal ids, or that corrupts persisted data — the four conditions that would have earned a
Critical here.

---

## High

### HIGH-1 — The homepage publishes nine product links and five of them 404 (lead L3/L4)

```
[HIGH] Homepage mock tiles link to five product slugs that do not exist
apps:        storefront (the mock file predates the branch and is present on main too)
files:       apps/storefront/features/products/data/home-products.ts:25,32,42,60,65
             apps/storefront/features/home/components/moon-selection/moon-selection.tsx:11,98
             apps/storefront/features/home/components/new-arrivals/new-arrivals.tsx:28,42
             apps/storefront/features/products/utils/product-card-model.ts:45
contract:    catalog plan KD-10 ("a 404 must be a real 404" - a link the site itself publishes
             must not be a dead end); root CLAUDE.md -> Learnings (2026-09-21), which records
             only TWO such slugs; plan lead L3.
repro:
  1. curl -s http://localhost:3000/en | grep -oE 'href="/en/products/[a-z0-9-]+"' | sort -u
  2. curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/en/products/<slug>
     (stack: storefront :3000, API :3001 on moon_store_audit)
expected:    every product link the homepage renders resolves to a product page.
actual:      the homepage publishes 9 distinct /en/products/<slug> links; FIVE return 404:
               silk-midi-dress 200 | cashmere-pullover 200 | cross-body-leather-bag 404 |
               silk-blouse 404 | embroidered-evening-dress 404 | linen-summer-dress 200 |
               long-wool-cardigan 200 | velvet-evening-bag 404 | wool-tailored-jacket 404
             The catalogue's nearest real slugs are leather-crossbody-bag,
             satin-off-shoulder-blouse, embroidered-evening-gown and velvet-evening-clutch;
             wool-tailored-jacket has no counterpart at all. THREE of the five dead links
             (embroidered-evening-dress, velvet-evening-bag, wool-tailored-jacket) are Moon
             Selection tiles, which render unconditionally in every build - so three dead
             links sit on the front door of every deploy. The other two reach a shopper
             through the New Arrivals fallback. The repository Learnings entry names only two
             of the five and understates the problem by three slugs.
impact:      a shopper clicking three of the five Moon Selection tiles, or two of the eight
             New Arrivals cards, lands on "Page not found" - on the homepage, in both locales.
cause:       home-products.ts was authored as static editorial content "mirroring the seed
             catalogue's vocabulary" rather than from the seed's real slugs, and nothing ties
             the two together. fromHomeMock unconditionally builds productHref(mock.slug).
fix:         either (a) make the mocks carry no href at all - an editorial photograph is not a
             product link - or (b) key them to slugs the catalogue actually creates, plus a
             test that fails when a mock slug is absent. (b) alone is fragile: the mock set is
             not a catalogue and cannot track one, and such a test must cross the app boundary
             the storefront contract forbids, which is itself an argument for (a).
blocks:      yes - the storefront's front door publishes broken commerce links; no further
             commerce work should ship on a homepage that 404s five of nine product links.
proven-on:   live stack + real PostgreSQL
```

**Nothing can catch this.** `apps/storefront/features/products/data/home-products.test.ts`
asserts unique slugs, known image slots, positive prices, both-locale names and that
`fromHomeMock` builds `/products/<slug>` — but no assertion relates a mock slug to any
catalogue. The defect has been invisible to CI since the mocks were written, and
`check:client-paths` covers `apps/dashboard` only.

### HIGH-2 — A withdrawn product's detail page keeps serving a purchasable 200

```
[HIGH] A deactivated or discontinued product's PDP stays 200 and purchasable indefinitely
apps:        storefront (the cache behaviour is storefront-side; the API is correct, and the
             API half is identical on main)
files:       apps/storefront/features/products/api/get-catalog-product.ts:104-118
             apps/storefront/lib/api/catalog.ts:5-8
             apps/storefront/app/[locale]/(catalog)/products/[slug]/page.tsx
             (mechanism) next/dist/server/lib/patch-fetch.js:696,796-820
contract:    apps/storefront/CLAUDE.md L607-609 - "a deactivated product can linger up to 60s
             - fine for browsing, never for checkout"; PD / KD-10 - "an inactive or
             discontinued product is a real 404"; this plan's U9 error path.
repro:
  1. Stack: API :3001 on moon_store_audit, storefront `next dev` :3000.
  2. curl http://localhost:3000/en/products/embroidered-evening-gown -> 200. This populates
     the Next data-cache entry for GET /api/v1/catalog/products/embroidered-evening-gown.
  3. PUT /api/v1/products/2/status {"status":"inactive"} as admin -> 200.
  4. curl -s -o /dev/null -w '%{http_code}' \
       http://localhost:3001/api/v1/catalog/products/embroidered-evening-gown -> 404 at once.
  5. Re-request the storefront URL on a fixed interval and count every response.
  6. Control: set `fine-knit-t-shirt` (id 6) inactive - a slug the storefront had never
     rendered, so no cache entry exists - and request its PDP.
expected:    the PDP 404s within the 60 s data-cache window (CLAUDE.md L607-609).
actual:      the API 404'd at 02:37:31. The PDP was then sampled **74 consecutive times across
             28 minutes** - 14 samples at 13 s (02:37:44-02:44:17) then 60 at 20 s
             (02:44:37-03:05:34) - with **zero non-200 responses in the entire run**. Every
             sample returned the full page: "4,500 EGP" and six "Add to Bag" controls. The
             window closed only because the audit restored the product to `active` at 02:59:48;
             the cache never healed on its own, so "never recovered" is a measured statement,
             not an inference. Reproduced independently on `leather-crossbody-bag`, set
             `discontinued` at 02:41:55 and still 200 at 02:44:25. The control 404'd within
             1 second, proving the fault is a pre-existing cache entry and not the route's 404
             logic. The *listing* dropped both products correctly (54 s and 52 s).
             **Caveat, which the sample count does not remove:** all of this was observed under
             `next dev`, whose caching differs from a production build. A statically generated
             route takes patch-fetch's `isStaticGeneration && entry.isStale` branch and awaits
             fresh data, which may bound the window near 60 s. The route carries no
             `generateStaticParams`, so which branch it takes under `next build && next start`
             is not decidable from a dev run. Both things are true at once: the staleness is
             now well evidenced, and the production behaviour is still unproven.
impact:      a withdrawn piece stays shoppable and shareable. Its link keeps working from
             search, social, a saved tab or an email; the shopper configures a size, presses
             Add to Bag, and is only told at the bag that the piece is gone. The price is
             frozen too - a product reactivated at a different price would still advertise the
             old figure from the same frozen entry.
cause:       Next writes the fetch data cache only when res.status === 200
             (patch-fetch.js:696). Once the entry is stale, a request-rendered page serves the
             stale body and starts a background revalidation; that revalidation receives the
             API's 404, so the entry is never replaced and never evicted, and the same stale
             200 is served indefinitely. The listing escapes because its own revalidation is
             still a 200 - the product simply drops out of the array.
fix:         stop expressing deletion by the absence of a cache entry. Either (a) tag catalog
             fetches and call revalidateTag from a route the API or dashboard pings on a status
             write - nothing in apps/storefront calls revalidateTag or revalidatePath today -
             or (b) have the API answer a 200 envelope carrying { available: false } for a
             withdrawn slug, so the entry is replaced. A shorter TTL does not fix it: the entry
             is stale and still served.
blocks:      yes - a commerce launch would ship shoppable pages for withdrawn stock with no
             operator lever to take one down.
proven-on:   live stack (`next dev`, 74 sampled responses) + real PostgreSQL. **Dev-mode
             evidence for the production question**: this MUST be re-run against
             `next build && next start` before the final severity is settled.
```

### HIGH-3 — A name-only product edit silently rewrites `products.stock` with no audit row (lead L1)

```
[HIGH] Any product edit resurrects stock sold since the form opened, unaudited
apps:        server | dashboard | db  (identical on main)
files:       apps/server/services/productService.ts:298
             apps/server/validators/productSchema.ts:25
             apps/dashboard/src/features/inventory/components/inventory/ProductFormDialog.tsx:285
contract:    none - observation, graded against the stock-adjustment audit contract
             (apps/server/src/modules/inventory/stockAdjustments/repository.ts:57-70 states a
             manual change is a guarded DELTA and is recorded); plan lead L1.
repro:       (database moon_store_audit, API :3001, Admin JWT)
  1. GET /api/v1/products?pageSize=100 -> linen-summer-dress (id 3) stock 30. The operator
     opens the product form; it loads stock: 30.
  2. A cashier sells one: POST /api/v1/sales
     {items:[{product_id:3,quantity:1,unit_price:1950}]} -> 201.
     SELECT stock FROM products WHERE id=3 -> 29.
  3. The operator saves the name change: PUT /api/v1/products/3 {name:"...", sku:"MN-DRS-003",
     price:1950, cost_price:900, stock:30, min_stock:5, category_id:1} -> 200, data.stock = 30.
  4. SELECT stock FROM products WHERE id=3 -> 30.
     SELECT count(*) FROM stock_adjustments -> unchanged at 2 (only the two 'Sale' rows).
  5. Omitting stock is not an option: PUT without `stock` -> 400
     {"field":"stock","code":"invalid_type","message":"Required"}.
expected:    either the edit leaves stock alone, or it goes through the audited delta path and
             leaves a stock_adjustments row naming who changed it and by how much.
actual:      the sold unit was resurrected. products.stock went 29 -> 30 on a *name* edit, with
             no audit row, no price_history row and no optimistic-concurrency check. `stock` is
             a REQUIRED field on PUT /api/v1/products/:id, so no caller can edit any field
             without also asserting an absolute stock. The same PUT also wiped `barcode`
             (6221002001 -> NULL, so GET /api/v1/products/barcode/6221002001 now 404s) and
             `distributor_id` (2 -> NULL), because updateProduct writes `barcode || null` and
             `distributor_id || null` absolutely.
impact:      every product edit is a lost-update window on stock: whatever sold between the
             form opening and the operator saving is silently restored, and the inventory audit
             trail shows nothing. Stock is then overstated and the storefront sells units that
             are not there. Barcode and distributor loss is the same defect on other columns.
cause:       updateProduct is a full-row absolute UPDATE with no field-presence handling for
             the non-storefront columns (the storefront columns already use the
             CASE WHEN $n::boolean pattern) and no `expected_updated_at` guard; productSchema
             marks `stock` required.
fix:         give `stock`, `barcode`, `distributor_id` and `min_stock` the same
             absent-keeps-stored treatment the storefront text fields already have; make
             `stock` optional on update; route any intentional stock change through
             stockAdjustmentsService.applyDelta so it is audited. Optimistic concurrency on
             `updated_at` closes the window entirely.
blocks:      no - it does not stop storefront commerce work, but it must be fixed before an
             operator is given the product form in production.
proven-on:   real PostgreSQL | live stack
```

### HIGH-4 — `products.stock` is dead state on a variant product, yet it is the dashboard's Stock column (lead L2)

```
[HIGH] The dashboard's primary stock number is wrong for every variant product, and drifts
apps:        server | dashboard | db  (identical on main)
files:       apps/dashboard/src/features/inventory/pages/Inventory.tsx:519-531 (Stock column)
             apps/dashboard/src/features/inventory/pages/Inventory.tsx:486-493 (low-stock badge)
             apps/dashboard/src/features/inventory/components/inventory/ProductFormDialog.tsx:285
             apps/server/services/productService.ts:298
             apps/server/src/modules/commerce/catalog/mappers.ts:353
contract:    R13 - "one agreed source of truth for stock across normal products, variants, POS
             sales, refunds, exchanges, adjustments and the storefront quote"; plan lead L2.
repro:
  1. Baseline: products.stock(id 4) = 6; variants S=4, M=0, L=2 (SUM = 6). They agree only
     because seed.ts:878 sets products.stock = SUM(variants.stock) at seed time.
  2. POST /api/v1/sales {items:[{product_id:4, variant_id:4, quantity:1, unit_price:2750}]}
     -> 201.
  3. SELECT: products.stock = 6 (unchanged); variants S=3, M=0, L=2, SUM = 5.
  4. GET /api/v1/products?search=MN-KNT-001 -> {"id":4,"stock":6,"variant_stock":5,
     "variant_count":3,"has_variants":1}. The dashboard Stock column renders `stock` = 6.
  5. GET /api/v1/catalog/products/cashmere-pullover -> variant S inStock true;
     POST /cart/quote {size:"S", quantity:4} -> "reduced", maxQuantity 3. Correct.
  6. PUT /api/v1/products/4 {... stock: 99 ...} -> 200, products.stock = 99. The catalog is
     completely unchanged: S/M/L availability identical.
expected:    one number, or the dashboard shows the number that actually governs sale.
actual:      three different answers for the same product at the same instant - products.stock
             6 (the dashboard Stock column, and the min_stock=5 low-stock badge, which
             therefore stays silent), SUM(variants) 5, and per-size sellable 3/0/2 (catalog and
             quote). The form's Stock field writes a column no sale path touches; the real
             variant stock appears only as a parenthetical "(5)" in the Variants column
             (Inventory.tsx:603). A stock of 99 typed into the form changed nothing a shopper
             can see or buy.
impact:      the operator's primary stock number is wrong for every variant product and drifts
             further with every sale. Reorder decisions, the low-stock badge and the low-stock
             notification (productService.ts notifyLowStock) all read the dead column. The
             Stock field is a trap: editing it looks like restocking and changes nothing.
cause:       two columns, only one of which is meaningful when has_variants = 0, with no
             has_variants branch in the dashboard list column, the badge or the form.
fix:         render `has_variants ? variant_stock : stock` in the Stock column (POS.tsx:204
             already does exactly this), disable or hide the Stock field on the form when
             has_variants = 1, and either derive products.stock from the variant sum on every
             variant write or drop it from the variant path entirely.
blocks:      no - the storefront reads the correct column throughout; this is a dashboard-truth
             defect, not a shopper-facing one.
proven-on:   real PostgreSQL | live stack
```

### HIGH-5 — An oversized or disallowed image upload answers 500 INTERNAL_ERROR, not 400

```
[HIGH] The two most likely upload refusals are 500s against a published 400 contract
apps:        server | dashboard  (identical on main)
files:       apps/server/src/storage/upload.ts:72-84 (multer limits + fileFilter cb(new Error))
             apps/server/src/modules/inventory/products/routes.ts:10,65,83
             apps/server/src/modules/inventory/products/schemas.ts:256-258, :290-292
             apps/dashboard/src/features/inventory/components/inventory/ProductGalleryManager.tsx:53-66
contract:    apps/server/src/modules/inventory/products/schemas.ts beyondSchema, published in
             the OpenAPI document: "At most 2 MB, JPEG, PNG or WebP, and the magic bytes must
             agree with the extension - a renamed file is rejected before anything is written."
             Also apps/server/CLAUDE.md -> "Error contracts: typed at the throw site" - "An
             unexpected error is now a 500, which is the truth", whose corollary is that an
             expected refusal must not be one.
repro:
  1. POST /api/v1/products/35/image with a 4.3 MB PNG (over the 2 MB ceiling), Admin token.
  2. POST /api/v1/products/35/image with a .gif.
  3. For contrast: POST a .png whose bytes are JPEG, and a .png containing plain text.
expected:    all four refused with 400 VALIDATION_ERROR naming the reason, per the published
             contract.
actual:      steps 1 and 2 -> HTTP 500 {"error":{"code":"INTERNAL_ERROR","message":"Internal
             server error"}}. Steps 3 and 4 -> correct 400s ("File extension (.png) does not
             match actual content (image/jpeg)" and "File content does not match a supported
             image format"). Identical 500s on the gallery endpoint POST
             /api/v1/products/35/images for both cases. Nothing in the tree maps MulterError or
             the fileFilter Error to a status: grep for "MulterError" / "LIMIT_FILE_SIZE"
             across apps/server/src returns nothing.
impact:      uploading a photo straight off a phone - routinely 3-5 MB - is the single most
             likely upload an operator will attempt, and it answers "Internal server error".
             The dashboard's describeFailure has no branch for a 500, so the operator sees only
             the generic galleryUploadFailed toast and is told neither that the file is too
             large nor that resizing would fix it. Every such attempt also books a spurious 500
             in error monitoring, where genuine faults are supposed to live.
cause:       validateImageBytes is ordinary middleware and answers its own failures, so the
             magic-byte paths return 400 correctly. Multer's own two refusals - the fileSize
             limit and the fileFilter callback - are surfaced as errors passed to next(), and
             the shared error handler has no mapping for them, so they fall through to 500.
fix:         add a handler immediately after the multer middleware on both image routes that
             maps MulterError LIMIT_FILE_SIZE to 400/413 VALIDATION_ERROR naming the 2 MB
             ceiling, and the fileFilter Error to 400 VALIDATION_ERROR naming the accepted
             formats - the same errorResponse shape validateImageBytes already uses two lines
             away.
blocks:      no - images can still be authored with a compliant file; the audit's own fixtures
             were created successfully. It is a launch-quality defect on the operator path.
proven-on:   live stack (moon_store_audit)
```

### HIGH-6 — No test drives an oversized or wrong-type upload through the route, which is why HIGH-5 ships

```
[HIGH] The two configuration-level upload refusals are asserted as configuration, not behaviour
apps:        server  (identical on main)
files:       apps/server/tests/storage.test.ts:263 ("keeps the 2MB ceiling and the extension
             allowlist on the multer instance")
             apps/server/tests/productImages.test.ts:119 ("rejects bytes that are not an image
             with 400, writing nothing")
contract:    root CLAUDE.md -> Learnings: "Zod strips unknown keys, so a field missing from a
             request schema never reaches the service however carefully the service handles
             it... Test the boundary, not just the service."
repro:       read the two test names above. storage.test.ts:263 asserts the *configuration* of
             the multer instance - that the limit and the allowlist are set - never that a
             request carrying an oversized or .gif file receives a particular status.
             productImages.test.ts:119 covers the magic-byte path only, which is the one that
             works.
expected:    a boundary test per documented refusal, since each refusal is published in the
             OpenAPI beyondSchema text.
actual:      the two refusals that are configuration-level (size, extension) are asserted as
             configuration; the one asserted end-to-end is the one implemented as real
             middleware. The coverage gap maps exactly onto HIGH-5's defect.
impact:      the 500 has presumably shipped since the storage abstraction landed, and no suite
             will catch either a regression or a fix.
cause:       testing the multer options object rather than the HTTP response is exactly the
             service-versus-boundary substitution the repo's own Learnings warn against.
fix:         add two route-level cases to productImages.test.ts posting an oversized buffer and
             a .gif, asserting 400 and that nothing is stored, alongside the existing
             magic-byte case.
blocks:      no - a test gap, not a live defect.
proven-on:   code reading, corroborated by the live 500 in HIGH-5
```

---

## Medium

### MED-1 — The Silk Edit campaign asset breaks the editorial asset guard, so the storefront CI test job is red

```
[MEDIUM] apps/storefront test suite fails on this branch; next build still succeeds
apps:        storefront (branch-introduced; green on main)
files:       apps/storefront/assets/editorial/silk-edit-campaign.png
             apps/storefront/lib/editorial/assets.test.ts:53
             apps/storefront/lib/editorial/slots.ts
             apps/storefront/features/home/data/promo-banner.ts:29
contract:    apps/storefront/lib/editorial/assets.test.ts itself - the "real directory" guard:
             every file under assets/editorial/ must match a declared slot and be a .jpg. A
             repo-enforced convention, and the CI job "Storefront (typecheck, lint, test,
             build)" in root CLAUDE.md -> CI gates.
repro:
  1. cd apps/storefront
  2. npm test -- lib/editorial/assets.test.ts
  3. Observe FAIL: "contains exactly the files named by editorialSlots + catalogSlots" -
     unexpectedExtensions: ['silk-edit-campaign.png']
  4. Compare against main: git worktree add ../moon-store-main-cmp origin/main &&
     cd ../moon-store-main-cmp/apps/storefront &&
     npx vitest run lib/editorial/assets.test.ts -> 6/6 pass (the file does not exist there)
expected:    every file under assets/editorial/ is a .jpg named for a slot declared in
             editorialSlots or catalogSlots (lib/editorial/slots.ts), per the test's own
             assertion.
actual:      commit 373b85a "style(storefront): redesign silk edit around campaign image"
             (2026-09-21, this branch) added assets/editorial/silk-edit-campaign.png - a .png,
             and a filename absent from both slot lists - while leaving the guard test
             unchanged. promo-banner.ts:29 references the file directly by path rather than
             through the slots system, with the comment "No component change", so the author
             knew this bypassed the slot machinery.
impact:      the storefront unit suite, and therefore the CI job "Storefront (typecheck, lint,
             test, build)", fails on this branch as it stands. `next build` itself succeeds -
             the file loads fine as a plain import - so production is not broken; only the
             gate is.
cause:       the asset was added as a one-off outside the slot/aspect-ratio system the rest of
             assets/editorial/ uses, and the guard that keeps the directory in lockstep with
             slots.ts was neither updated nor given a documented exemption.
fix:         either (a) add 'silk-edit-campaign' to catalogSlots and rename the file to .jpg to
             fit the existing convention, or (b) if a .png is deliberate (transparency), extend
             checkEditorialAssets / slots.ts with an explicit named-exception allow-list rather
             than leaving the guard failing.
blocks:      yes - merging this branch as-is goes in red unless the check is overridden.
proven-on:   live test run on the working tree; confirmed absent on main by worktree re-run
```

### MED-2 — OPTIONS on the quote path is answered publicly cacheable, bypassing `no-store` (lead L5's failure class, live)

```
[MEDIUM] A non-POST method on the pricing endpoint ships public, max-age=60
apps:        server  (identical on main)
files:       apps/server/src/app.ts:118-139 (onlyForCartQuote(cors(...)))
             apps/server/src/modules/commerce/catalog/routes.ts:28-33 (POST-only handler + noStore)
             apps/server/src/modules/commerce/catalog/routes.ts:35-36 (createCatalogLimiter /
               publicCacheOnSuccess, registered after)
contract:    apps/server/CLAUDE.md -> Cart quote / The cart quote's edge chain: "Every status
             carries Cache-Control: no-store"; the same sentence in
             catalogRequestContracts.cartQuote beyondSchema,
             apps/server/src/modules/commerce/catalog/schemas.ts:222-226.
repro:
  1. curl -sD - -o /dev/null -X OPTIONS http://localhost:3001/api/v1/catalog/cart/quote \
       -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST"
     -> 204, ACAO: http://localhost:3000, NO Cache-Control (terminated inside cors() before
        the router - correct)
  2. curl -sD - -o /dev/null -X OPTIONS http://localhost:3001/api/v1/catalog/cart/quote
     (no Origin header at all - the simplest repro)
     -> HTTP/1.1 200 OK / Allow: POST / Cache-Control: public, max-age=60
  3. Same with -H "Origin: http://localhost:5173" (a non-allowlisted origin) -> identical.
expected:    every response on the quote path, any method, carries no-store.
actual:      when cors() does not short-circuit the OPTIONS request (no Origin, or an origin
             the quote's CORS does not allow), the request falls through the catalog router's
             POST-only handler on a method mismatch, passes router.use(createCatalogLimiter())
             (skipped via isCartQuotePath) and router.use(publicCacheOnSuccess(60)) (NOT
             skipped - it is a router.use, so it matches OPTIONS too), and is finally answered
             by Express's built-in per-route OPTIONS responder with 200 + Allow: POST. Because
             that 200 passed through publicCacheOnSuccess's writeHead hook, it ships
             Cache-Control: public, max-age=60.
impact:      the body is the literal string "POST", not pricing data, and a real browser
             preflight from a disallowed origin still fails (no ACAO header), so nothing leaks
             today. But it is a live, reproducible violation of the documented "every status is
             no-store" invariant on the pricing endpoint, and if a CDN or shared cache is ever
             placed in front of this API it becomes a publicly cacheable, path-keyed entry on
             that endpoint's own URL.
cause:       the quote's no-store guard is attached to the method
             (router.post('/cart/quote', noStore, ...)), so it never runs for any other method,
             and the fallthrough response is generated downstream of the cache middleware.
fix:         attach noStore to the path rather than the method - a router.all('/cart/quote',
             noStore, ...) guard, or an explicit OPTIONS handler - registered ahead of
             createCatalogLimiter and publicCacheOnSuccess, so no method on this path can reach
             the cache rewrite.
blocks:      no - inert today (constant "POST" body, no ACAO for browsers), but it should be
             fixed before any CDN or edge cache sits in front of the API.
proven-on:   live stack (re-verified on the corrected moon_store_audit instance)
```

### MED-3 — New Arrivals silently presents invented product names and prices as the catalogue (lead L4)

```
[MEDIUM] Mock product data reaches production whenever fewer than four products are photographed
apps:        storefront
files:       apps/storefront/features/home/api/load-new-arrivals.ts:20,62-65
             apps/storefront/features/home/components/new-arrivals/new-arrivals.tsx:28,40-42
contract:    R2 - "No mock data silently reaches production"; plan lead L4.
repro:
  1. Confirm the data condition: SELECT count(*) FROM product_images -> 0;
     SELECT count(*) FROM products WHERE image_url IS NOT NULL -> 0 of 34 (a freshly seeded
     database).
  2. curl -s http://localhost:3000/en | grep -oE '[0-9],[0-9]{3} EGP'
expected:    the rail shows real catalogue products, or is visibly marked as editorial.
actual:      the rail renders the 8 mocks. The prices on the page - 2,850 / 3,200 / 2,400 /
             1,650 / 4,500 / 1,950 / 2,750 / 1,800 - are the hard-coded mock figures, not
             catalogue prices. long-wool-cardigan reads 2,750 EGP on the homepage against the
             catalogue's 2,400 EGP on its own product page; the Learnings claim is confirmed
             live. Nothing on the page says the rail is not stock. This is not an error path:
             MIN_PHOTOGRAPHED = 4 counts *photographed* products, so a correctly seeded,
             fully-stocked catalogue with no images returns zero, and a real store with
             unphotographed inventory falls back permanently. Because the homepage is
             prerendered (SSG), the choice is frozen at `next build`: a production build run
             against an unphotographed or unreachable catalogue bakes the mocks into static
             HTML that stays served until the next deploy.
impact:      shoppers see a price the store does not charge, on its own homepage; a merchandiser
             looking at the homepage cannot tell the rail is not their catalogue. The mock cards
             carry no Quick Add (the action is composed only when a catalog DTO exists), so an
             invented price can never enter a cart quote - the exposure is display, plus the
             dead links in HIGH-1.
cause:       a deliberate quality gate ("a catalog with no photographs is not better data")
             whose trigger - image count - is the common production state, with no visible
             mock marker.
fix:         distinguish "the API answered with products" from "the products are photographed".
             With products but no photographs, render the real products over the placeholder
             frame - real names, real prices, working links. Keep the static set only for "the
             API cannot answer at all", and even then drop the hrefs.
blocks:      no - display-only, and it cannot corrupt a cart. It must be resolved before launch
             alongside HIGH-1, which shares its root data.
proven-on:   live stack + real PostgreSQL
```

### MED-4 — A repeated query parameter filters the grid but the controls show the default, and the next interaction discards it

```
[MEDIUM] The listing loader and the controls island disagree on a repeated key
apps:        storefront
files:       apps/storefront/features/catalog/search-params.ts:133-150 (firstValidValues)
             apps/storefront/features/catalog/components/catalog-controls.tsx:15,114,123,322-324
contract:    apps/storefront/CLAUDE.md -> URL grammar: "A repeated key resolves to its first
             valid value (?sort=best&sort=price-asc sorts), not nuqs's first occurrence."
repro:
  1. curl -s "http://localhost:3000/en/shop?sort=price-asc"
     -> grid: بندانة قطن, Plain Chiffon Hijab, Printed Silk Square
  2. curl -s "http://localhost:3000/en/shop?sort=best&sort=price-asc"
     -> grid identical (correctly sorted)
  3. In (2) the sort control renders <option value="newest" selected="">;
     in (1) it renders <option value="price-asc" selected="">.
expected:    the server loader and the controls island agree on the resolved value.
actual:      they do not. The server loader wraps nuqs in firstValidValues
             (search-params.ts:150); the island calls useQueryStates(catalogParsers) directly
             (catalog-controls.tsx:114), which takes nuqs's first occurrence (best -> invalid
             -> null -> route default). The same divergence applies to min, max, stock and
             page. Grid counts confirm the server side is right: ?min=abc&min=1000 -> 28 pieces
             (= ?min=1000); ?stock=xx&stock=in -> 30 pieces against 34 unfiltered.
impact:      the control state lies about the applied sort or filter. Worse, every control
             commit is built from `committed` (line 123), so the next interaction - changing
             Sort, removing a summary chip, applying the sheet - serializes the island's state
             and silently discards the repeated-key filter that was actually in effect.
cause:       the first-valid rule lives only in the loader path, not in the shared parser map
             the island consumes.
fix:         move first-valid resolution somewhere both consume - a parser that tolerates a
             repeated key, or have the server pass resolved params to the island and seed
             useQueryStates from them.
blocks:      no - reachable only via a hand-written URL with a duplicated key.
proven-on:   live stack (grid order and the `selected` attribute) + code reading
```

### MED-5 — The Quick Add wrapper re-creates the dead zone its own root was written to avoid (branch redesign)

```
[MEDIUM] A ~68px band across the bottom of every product photograph is inert
apps:        storefront (branch-introduced by the corner-disc commits)
files:       apps/storefront/app/globals.css:841
             apps/storefront/features/products/components/product-card.tsx:316-326
             apps/storefront/features/cart/components/quick-add.tsx:201-211
contract:    none - observation, graded against the authors' own stated intent at
             quick-add.tsx:204-206: "it is `pointer-events-none` for exactly that reason: a
             full-width strip over the photograph would otherwise swallow the clicks the card
             link's overlay is there to take".
repro:
  1. Open http://localhost:3000/en/shop
  2. Click the photograph of any card in the ~68px band along its bottom edge, to the inline
     end of the 44px disc (the lower-right quadrant of the image in LTR).
  3. Observe whether the product page opens. (Matrix row 44 / 46 / 52.)
expected:    the whole tile except the 44px disc opens the product page - the card carries
             "one link, one overlay" (product-card.tsx:114-121).
actual:      QuickAdd's root is pointer-events-none (quick-add.tsx:210), which correctly lets
             clicks fall through - but the *wrapper* <div data-card-action="overlay"> that
             product-card.tsx:316 renders around it is a plain div with default
             pointer-events: auto, z-index: 10 (globals.css:843) and justify-self: stretch, so
             its border box is the full card width by (44px disc + 2 x 0.75rem padding) =
             ~68px tall, sitting above the title link's after:absolute after:inset-0 overlay.
             Hit-testing resolves to that wrapper, which has no handler, so the click does
             nothing.
impact:      a band across the bottom of every product photograph - on every listing, the New
             In grid, the related rail and the homepage rail - is inert. A shopper tapping the
             hem of a garment gets no response; on a phone that reads as a broken tile.
cause:       the pointer-events-none mitigation was written on the inner root, before the outer
             [data-card-action='overlay'] wrapper existed; the wrapper was added by the later
             corner-disc commits and inherits none of it.
fix:         move pointer-events: none onto [data-card-action='overlay'] in globals.css (the
             disc and the panel already re-enable it with pointer-events-auto), or drop the
             wrapper's padding and size it to the disc.
blocks:      no - it degrades one tap target; the card link, the disc and the caption all still
             work.
proven-on:   code reading only (CSS hit-test reasoning). One click in the owner's browser
             settles it - Appendix A rows 44, 46 and 52.
```

### MED-6 — A Quick Add panel opened inside the New Arrivals rail will be clipped by the rail's scroller

```
[MEDIUM] The rail's overflow-x makes the in-card disclosure unusable there
apps:        storefront
files:       apps/storefront/app/globals.css:886-898
             apps/storefront/features/home/components/new-arrivals/new-arrivals.tsx:103
             apps/storefront/features/home/components/new-arrivals/product-rail.tsx:273
             apps/storefront/features/cart/components/quick-add.tsx:258
contract:    none - observation.
repro:
  1. Point the storefront at an API serving four or more photographed products so
     load-new-arrivals returns DTOs rather than the mock fallback.
  2. Open http://localhost:3000/en and press the disc on a rail card that needs a size.
expected:    the disclosure panel opens over the caption, as it does in the shop grid.
actual:      [data-rail] sets overflow-x: auto (globals.css:893). Per the CSS overflow spec a
             non-visible value on one axis computes the other to auto, which the file's own
             comment at :891-892 acknowledges. The panel is absolute ... top-full, anchored to
             a root at the photograph's bottom edge, so it extends past the rail's content box
             and is clipped - or turns the rail into a vertical scroller. The shop grid
             (product-grid.tsx:133, a plain <li> in a <ul> with no overflow) is unaffected, as
             is related-products.tsx:93.
impact:      on the homepage a shopper cannot choose a size from a rail card at all - the one
             affordance the tile carries is unusable for any product with options.
cause:       QuickAdd was designed for a grid cell; the rail's scroll-snap scroller was not
             revisited when the card gained an in-card disclosure.
fix:         render the panel in a portal or popover layer anchored to the disc, or open it
             upward and give the rail overflow: clip + overflow-clip-margin so the panel
             survives.
blocks:      no - the rail currently renders the mock fallback (no DTO, so no QuickAdd is
             emitted: grep data-card-action on the live /en returns nothing), so this is
             latent. It becomes live the moment MED-3 is fixed.
proven-on:   live stack (absence of QuickAdd on the rail confirmed) + code reading (the
             clipping itself)
```

### MED-7 — The storefront has zero component tests, so no Quick Add or purchase-panel behaviour is guarded

```
[MEDIUM] Every interactive contract in the cart surfaces is unguarded by any automated test
apps:        storefront
files:       apps/storefront/features/cart/components/quick-add.tsx
             apps/storefront/features/products/components/purchase-panel.tsx
             apps/storefront/features/cart/components/add-to-bag-button.tsx
contract:    root CLAUDE.md -> CI gates, "Storefront (typecheck, lint, test, build)";
             apps/storefront/CLAUDE.md -> Cart -> Surfaces, which states the interactive
             contract; plan AD-3.
repro:       find apps/storefront -name '*.test.tsx' -not -path '*/node_modules/*' -> no results.
expected:    the interactive contract in apps/storefront/CLAUDE.md -> Cart -> Surfaces has some
             automated evidence.
actual:      the storefront has **zero** component tests. Every pure rule is well covered -
             variant-selection.test.ts, quick-add-model.test.ts, add-to-bag-action.test.ts,
             cart-lines.test.ts, product-card-model.test.ts, 24 named cases in
             variant-selection alone - but nothing exercises the panel opening, `askFor` moving
             focus to the first unanswered group, Escape or outside-pointerdown closing and
             restoring focus, the sold-out disc staying focusable, the disc's RTL mirroring, or
             that one press never adds a default silently.
impact:      the three commits that rewrote this control on this branch changed behaviour no
             suite can regression-check, and there is no storefront E2E either.
cause:       the slice's testing convention is pure-function-only; composition is verified by
             owner screenshots.
fix:         add a jsdom component suite for QuickAdd (readiness x press x focus). It is the
             one client island whose behaviour, not just its model, is the contract.
blocks:      no - a coverage gap, not a defect.
proven-on:   code reading only
```

### MED-8 — The quote response guard checks shape, slug and index, but never the quote's arithmetic

```
[MEDIUM] "A wrong price must fail, not render" overstates what the guard does
apps:        storefront
files:       apps/storefront/features/cart/api/quote-cart.ts:79-145
contract:    apps/storefront/CLAUDE.md -> Cart -> Quote: "a wrong price must fail, not render".
repro:
  1. Read parseLine / parseCartQuote.
  2. npx vitest run features/cart/api/quote-cart.test.ts (12 tests) and note what is asserted.
expected:    on the doc's plain reading, a response whose money does not add up is refused.
actual:      parseLine pins index (:82), slug (:83), the status vocabulary (:84), product shape
             (:90-95), option shape (:96), unitPrice finiteness with null allowed only for an
             unavailable line (:100), integer counts (:103) and a finite lineTotal (:106). It
             never checks lineTotal === unitPrice x quantity, nor subtotal === sum(lineTotal),
             nor that the returned options correspond to the requested ones. A server that
             returned unitPrice 2750 with lineTotal 1 and subtotal 1 would render as
             authoritative.
impact:      the client can detect an ill-typed response but not a *wrong* one. The contract
             sentence promises more than the code delivers; a server-side pricing regression
             would render rather than fail.
cause:       the guard was written as a shape validator and the arithmetic invariants were
             never added.
fix:         add two cheap invariant checks - per-line lineTotal, and the subtotal against the
             sum of priced lines - and either tighten the guard or reword the CLAUDE.md
             sentence to say "malformed".
blocks:      no - the server is the authority and this audit found its arithmetic correct on
             every probe; this is a missing second line of defence, not a live wrong price.
proven-on:   code reading only (the live server answered consistently on every probe)
```

### MED-9 — Cross-tab storage sync is the one store path no test covers

```
[MEDIUM] The documented last-write-wins cross-tab rule is entirely unguarded
apps:        storefront
files:       apps/storefront/features/cart/store/cart-store.ts:156-171,186-203
contract:    apps/storefront/CLAUDE.md -> Cart -> Store: "A `storage` event from another tab
             re-reads (last write wins)"; plan U5 scenario "a second tab's write is picked up".
repro:
  1. grep -n "storage'|StorageEvent|dispatchEvent"
       apps/storefront/features/cart/utils/cart-storage.test.ts
  2. Observe: no match. The 25 store tests exercise mutations, hydration and hints only.
expected:    the documented cross-tab rule is guarded by something.
actual:      unguarded. attachStorageEvents (:156) runs only for the first subscriber, is
             detached when the last unsubscribes (:198-201), and treats event.key === null as
             another tab's localStorage.clear(). None of that - including the
             subscribe/unsubscribe lifecycle, which is exactly where a listener leak or a
             missed re-attach would live - is asserted anywhere.
impact:      a regression in cross-tab sync, or a lost listener after a route change that
             unmounts every bag surface, would ship green.
cause:       the suite is deliberately DOM-free (the storefront has no DOM harness), and a
             `storage` event needs a window.
fix:         the store already accepts an injected GetCartStorage; a jsdom-backed test could
             dispatch a StorageEvent. Otherwise fold it into the owner's manual pass
             permanently.
blocks:      no - the code reads correct.
proven-on:   code reading only
```

### MED-10 — The upload limiter is 10 per 15 minutes and IP-keyed, so one gallery cannot be filled in one sitting

```
[MEDIUM] Cataloguing a season is the exact workload this limit obstructs
apps:        server  (identical on main)
files:       apps/server/middleware/upload.ts:136-143 (uploadRateLimit: windowMs 15 min,
             max 10, default IP key generator)
contract:    apps/server/CLAUDE.md -> "Rate-limit bucketing": "The global limiter is keyed on
             the authenticated user, not on the IP. Several tills behind one shop router share
             one address, so an IP-keyed budget is a per-shop budget and one busy till can push
             a colleague into a RATE_LIMITED mid-checkout." The upload limiter never received
             that treatment.
repro:
  1. With a fresh window, POST 1 primary image + 8 gallery images to one product - 9 uploads,
     the documented maximum a single product can hold.
  2. Observed live: after 10 requests from one address, every further upload is 429
     {"error":{"code":"RATE_LIMITED","message":"Too many uploads. Please try again later."}} -
     including the ones the server itself refused.
  3. Confirmed IP-keyed, not user-keyed: the same Admin token continued uploading immediately
     against http://127.0.0.1:3001 after http://localhost:3001 (::1) was exhausted. Same user,
     same token, fresh budget.
expected:    an operator can photograph and upload a full product gallery in one sitting.
actual:      a full gallery is 9 uploads against a ceiling of 10, and *rejected* attempts spend
             the budget too. Two mistyped files - or, given HIGH-5, two phone photos over 2 MB -
             and the operator is locked out for 15 minutes partway through one product. Because
             the key is the IP, a second admin on the same shop network shares that budget.
impact:      the failure arrives as a bare "try again later" with no indication of how long.
             Combined with HIGH-5, an operator whose photos are too big spends their whole
             budget learning nothing about why.
cause:       uploadRateLimit predates the user-keyed bucketing decision and was never revisited;
             it still uses express-rate-limit's default IP key.
fix:         key it on the authenticated user like the global limiter (the key generator already
             exists), and raise the ceiling above the per-product maximum of 9 - the limit
             should bound abuse, not ordinary authoring of one product.
blocks:      no - workable with patience; it slowed this audit's own fixture work.
proven-on:   live stack (moon_store_audit)
```

### MED-11 — `PUT /api/v1/products/:id` silently resets `cost_price`, `min_stock` and `barcode` when they are omitted

```
[MEDIUM] Omitting a field substitutes a Zod default over stored financial data
apps:        server  (identical on main)
files:       apps/server/validators/productSchema.ts:24 (cost_price ... .default(0)),
             :29 (min_stock ... .default(5)), :22 (barcode optional/nullable)
             apps/server/src/modules/inventory/products/schemas.ts:178-184 (beyondSchema)
contract:    the published update contract lists exactly which fields survive omission - "A
             full replacement, not a merge: the required fields stay required. Except `slug`,
             `name_en`, `description`, `description_en`, `material`, `material_en`, `care`,
             `care_en`, `fit` and `fit_en`: absent leaves the stored value". cost_price,
             min_stock and barcode are not in that list, so full-replacement semantics are
             technically documented - but the note says nothing about omission substituting a
             *default* rather than merely replacing, and cost_price is financial data.
repro:
  1. POST a product with cost_price 444, min_stock 9, barcode "8888880201" -> created, all
     three echoed back correctly.
  2. PUT the same product with only {name, sku, price, stock} - a body that is entirely valid
     and returns 200.
  3. Read the response.
expected:    the operator is either told these fields are mandatory on update, or they survive.
actual:      cost_price 444 -> 0, min_stock 9 -> 5, barcode "8888880201" -> null. HTTP 200, no
             warning, no indication anything was discarded.
impact:      cost_price is the product's cost basis and feeds margin reporting; silently
             zeroing it makes every margin on that product read as 100%. The dashboard's own
             form is safe - getEditFormValues (ProductFormDialog.tsx:519-541) always sends all
             three - so this is not reachable by clicking, but it is reachable by any other
             caller: the bulk import path, a script, or a partial body assembled anywhere else.
cause:       .default(0) / .default(5) on a schema shared between create (where a default is
             right) and update (where it silently overwrites stored data).
fix:         either split the update schema from the create schema so these three follow the
             same absent-leaves-stored rule the text fields already have, or - if full
             replacement is genuinely intended - make them required on update so an omission is
             a 400 rather than a silent reset, and say so in beyondSchema.
blocks:      no - not reachable from the dashboard UI today.
proven-on:   live stack (moon_store_audit)
```

### MED-12 — Variant price, stock and attributes have no client-side validation, and bad stock input is silently zeroed

```
[MEDIUM] Number(x) || 0 discards an operator's stock entry before the request is built
apps:        dashboard  (identical on main)
files:       apps/dashboard/src/features/inventory/components/inventory/VariantManagerDialog.tsx
               (plain <Input> throughout: no react-hook-form, no zodResolver, no
               isInvalid/errorMessage wiring on any field)
             apps/dashboard/src/features/inventory/hooks/useVariantManagement.ts:86-108
contract:    none - observation, measured against the pattern ProductFormDialog uses in the
             same directory (zodResolver + per-field errorMessage).
repro:
  1. Open Manage Variants, enter "-5" as the price. handleVariantSubmit sends price: -5; the
     server correctly refuses it (confirmed live: variant price 0 and negative both return 400
     too_small), and the operator sees only the generic variants.createFailed toast with no
     field highlighted.
  2. Enter "abc" as the stock. Number("abc") || 0 makes it 0 client-side; a perfectly valid
     request is sent, 201 is returned, and the variant is created with stock 0. The operator is
     never told their input was discarded.
expected:    inline validation mirroring variantSchema, as the product form does.
actual:      no client schema; the only client-side guard is "at least one non-blank attribute
             pair" (useVariantManagement.ts:94-97). Everything else is server-only, and step 2
             is not even server-visible because the coercion happens before the request is
             built.
impact:      step 2 is silent data loss on a stock figure, on the column that actually governs
             sale for a variant product. Step 1 is a worse error experience than every other
             authoring surface in the feature.
cause:       the dialog was written without the react-hook-form pattern the rest of the slice
             uses.
fix:         bind the variant fields with react-hook-form plus a zod schema mirroring
             variantSchema, and parse stock rather than coercing it.
blocks:      no - the server stays authoritative on everything except the silently-zeroed stock.
proven-on:   live stack (the server-side refusals) + code reading (the client coercion)
```

### MED-13 — Manual stock adjustments cannot touch a variant at all

```
[MEDIUM] The one audited manual-correction path writes the dead column
apps:        server | db  (identical on main)
files:       apps/server/src/modules/inventory/stockAdjustments/repository.ts:71-78
             apps/server/src/modules/inventory/stockAdjustments/service.ts:26-51
contract:    none - observation; the direct corollary of R13.
repro:       POST /api/v1/products/:id/adjust-stock takes {delta, reason} and no variant_id;
             applyDelta issues `UPDATE products SET stock = stock + $1::int`. The
             stock_adjustments table has no variant_id column (introspected: id, product_id,
             previous_qty, new_qty, delta, reason, user_id, created_at).
expected:    the one audited manual-correction path reaches the column that governs sale.
actual:      for a variant product the only audited manual path writes products.stock, which no
             sale path reads (HIGH-4). Correcting a miscount on size S requires either a full
             stock count or the unaudited product form.
impact:      shrinkage, damage and receiving corrections on variant products have no audited
             route at all.
cause:       stockAdjustments predates variants and was never extended.
fix:         add variant_id to the adjustment request, the service branch and the
             stock_adjustments table (a migration), mirroring the stockCounts branch.
blocks:      no
proven-on:   real PostgreSQL (schema introspection) | code reading
```

### MED-14 — Stock-count and sale audit rows record variant quantities against the product id

```
[MEDIUM] The stock-adjustment ledger cannot be reconciled for a variant product
apps:        server | db  (identical on main)
files:       apps/server/src/modules/inventory/stockCounts/service.ts:110-127
             apps/server/src/modules/pos/sales/service.ts (the Sale adjustment rows)
contract:    none - observation.
repro:
  1. POST /api/v1/stock-counts {category_id:2} -> count 1, item 2 = (product 4, variant 4),
     expected_qty 4.
  2. PUT /api/v1/stock-counts/1/items/2 {counted_qty:7} -> variance 3.
  3. POST /api/v1/stock-counts/1/complete {apply_adjustments:true} -> 200.
  4. product_variants(id 4).stock 4 -> 7; products(id 4).stock unchanged at 6 (correct).
     Catalog and quote follow: quote {size:"S", quantity:10} -> maxQuantity 7.
  5. SELECT * FROM stock_adjustments -> {product_id:4, previous_qty:4, new_qty:7, delta:3,
     reason:'Stock Count'}. The earlier variant sale wrote {product_id:4, previous_qty:4,
     new_qty:3, delta:-1, reason:'Sale'}.
expected:    an audit row identifies the row whose stock changed.
actual:      both rows claim product 4 went 4 -> 3 and then 4 -> 7, while products.stock was 6
             the entire time. Three variants of one product all write rows that look identical.
impact:      the ledger cannot be reconciled against either column for a variant product, and
             cannot attribute a change to a size.
cause:       stock_adjustments has no variant_id column (see MED-13).
fix:         the same migration; write variant_id on every variant-sourced adjustment row.
blocks:      no
proven-on:   real PostgreSQL | live stack
```

### MED-15 — Every product update writes two spurious `price_history` rows

```
[MEDIUM] A NUMERIC string is compared against a JS number, so the change test is always true
apps:        server | db  (identical on main)
files:       apps/server/services/productService.ts:341-356
contract:    none - observation; root CLAUDE.md -> Learnings: "pg-mem returns NUMERIC as a JS
             number where node-postgres returns a string".
repro:       PUT /api/v1/products/3 with price 1950 (unchanged) and cost_price 900 (changed)
             -> 200. SELECT * FROM price_history -> two new rows, including
             {product_id:3, field:'price', old_value:'1950', new_value:'1950'}. Identical pairs
             appear for products 4, 35 and 36 across every edit this audit made.
expected:    a history row only when the value actually changed.
actual:      `old.price !== price` compares the node-postgres NUMERIC **string** '1950' against
             the request's **number** 1950, which is always true, so both rows are always
             written.
impact:      price_history is noise; any "when did this price change" query or report is wrong.
             Two extra inserts per product edit.
cause:       the exact pg-mem / node-postgres NUMERIC divergence the repo's own Learnings
             document. On pg-mem the comparison is number-vs-number and behaves correctly, so
             no unit test catches it - this is an AD-5 case in the wild.
fix:         coerce with Number() on both sides of both comparisons, or compare in minor units.
blocks:      no
proven-on:   real PostgreSQL | live stack
```

### MED-16 — No on-demand invalidation exists, so a dashboard correction cannot be published faster than the TTL

```
[MEDIUM] The shop window is not correctable on demand
apps:        storefront | dashboard | server
files:       apps/storefront/lib/api/catalog.ts:26-43 (no `tags`)
             apps/storefront - no revalidateTag / revalidatePath anywhere in application code
contract:    none - observation against R12 ("the intended cache delay documented and no
             unexpected staleness"). KD-9 chose a time-based TTL deliberately; what is missing
             is an escape hatch, not the TTL.
repro:
  1. grep -rn "revalidateTag\|revalidatePath" apps/storefront --include=*.ts --include=*.tsx
     (excluding .next/) -> no application matches.
  2. Change any price through the dashboard API and poll /en/shop: the new figure appears only
     when the 60 s entry expires - 68 s observed in Scenario A.
expected:    an operator who publishes a wrong price, or withdraws a piece, can make the
             storefront reflect it now.
actual:      the only lever is waiting out CATALOG_REVALIDATE, or restarting Next. The money is
             safe (the quote is no-store), but the shop window is not correctable on demand.
impact:      a pricing error or an urgent withdrawal stays visible for at least one TTL plus one
             page view, with no operator action that shortens it.
cause:       catalogFetch passes only next: { revalidate } and no tags, so there is nothing to
             target even if a revalidation endpoint existed.
fix:         tag catalog fetches (products, product:{slug}, collection:{slug}) and add a
             token-guarded POST /api/revalidate route the server calls after a catalog write.
             Small, and it is also the cleanest fix for HIGH-2.
blocks:      no - browsing staleness alone is within the documented design; it becomes blocking
             only through HIGH-2, with which it shares a fix.
proven-on:   live stack + code reading
```

---

## Low

### LOW-1 — L7 confirmed as latent only: `||` instead of `??` for the variant-price fallback (merged, U6 + U7)

```
[LOW] The wrong operator is real, unreachable today, and unguarded by the schema
apps:        dashboard | db  (identical on main)
files:       apps/dashboard/src/features/inventory/components/inventory/VariantManagerDialog.tsx:142
               `formatCurrency(Number(variant.price || variantsProduct?.price || 0))`
             apps/dashboard/src/features/pos/pages/POS.tsx:195 (the same shape)
             apps/server/validators/productSchema.ts:37 (variantSchema.price)
contract:    none - observation; plan lead L7 - "a variant deliberately priced at 0 displays the
             product price".
repro:
  1. POST /api/v1/products/4/variants with price: 0 -> 400 VALIDATION_ERROR, field price, code
     too_small. PUT /api/v1/products/4/variants/6 {price: 0} -> 400, same. price: -5 -> 400,
     same. variantSchema.price is z.number().positive().optional().nullable(), and positive
     excludes zero.
  2. Schema introspection of product_variants: price is `numeric` NULLABLE with **no CHECK
     constraint** - the only check is product_variants_stock_non_negative, NOT VALID. The only
     INSERT/UPDATE paths are productService.ts:619/654 (Zod-guarded) and seed.ts:873 (writes no
     price at all).
expected:    L7 as filed implies a reachable display bug.
actual:      the wrong operator is genuinely in the code at both sites, but the server-side
             .positive() makes it unreachable through the API today, so `||` and `??` cannot
             diverge on the values that exist. A 0 *is* representable in the schema, however,
             and could arrive from a future importer, a data-migration backfill, a restored dump
             or a manual SQL fix. If one ever did: VariantManagerDialog would show the *product*
             price and POS.tsx:195 would charge the *product* price, while the server's SQL
             COALESCE and the catalog's `??` would both correctly honour 0 - a three-way
             disagreement in which the till charges more than the shopper was quoted.
impact:      none today. A latent till-versus-storefront price divergence if a 0 is ever
             introduced, and nothing would connect a future schema relaxation to this display.
cause:       `||` treats 0 as absent; `??` and SQL COALESCE do not.
fix:         change both `||` to `??` (a two-character change with no behaviour change today),
             and add CHECK (price IS NULL OR price > 0) to product_variants so the schema states
             the rule the Zod schema already enforces.
blocks:      no - unreachable through the API today.
proven-on:   real PostgreSQL | live stack (the API refusal) | code reading (the display
             consequence)
```

### LOW-2 — L8 confirmed: no tests for `VariantManagerDialog`, `useVariantManagement` or `Categories`

```
[LOW] The two dashboard surfaces that author variant price and category slug are unguarded
apps:        dashboard  (identical on main)
files:       no VariantManagerDialog.test.tsx in
               apps/dashboard/src/features/inventory/components/inventory/ (only
               ProductGalleryManager.test.tsx exists there)
             no useVariantManagement.test.ts in apps/dashboard/src/features/inventory/hooks/
             no Categories.test.tsx in apps/dashboard/src/features/inventory/pages/
               (Bundles, Collections, Inventory and StockCount all have one)
contract:    plan lead L8, verbatim.
repro:       ls apps/dashboard/src/features/inventory/components/inventory/*.test.tsx and
             ls apps/dashboard/src/features/inventory/pages/*.test.tsx
expected:    per L8, these are expected missing; this records precisely what is unguarded.
actual:      confirmed. The specific unguarded behaviours are:
             - the blank-price -> price: null conversion (useVariantManagement.ts:101) - the
               seam the entire `variant.price ?? product.price` contract rests on, proven live
               in this audit but pinned by no dashboard test;
             - the silent Number(stock) || 0 coercion (MED-12);
             - the `||` vs `??` display bug at line 142 (LOW-1);
             - attribute authoring: the non-blank-pair guard, and duplicate-key behaviour (last
               write wins, untested);
             - Categories.tsx entirely - category slug authoring, validation and CRUD - despite
               category slugs driving storefront category URLs, verified live in U6.
impact:      a regression in variant pricing, variant stock entry or category slugs ships with
             no automated signal; the server suites cannot see a dashboard-side regression.
cause:       never written.
fix:         add the two test files; the blank-price-to-null path and the stock coercion are the
             two highest-value cases.
blocks:      no
proven-on:   code reading
```

### LOW-3 — L11 confirmed: the seed authors no `inactive` product and no priced variant override (merged, U2 + U8)

```
[LOW] Two publication and pricing paths are unreachable from a seeded database
apps:        server | db  (identical on main)
files:       apps/server/src/database/seed.ts:823-883
contract:    none - observation; plan lead L11.
repro:
  1. SELECT status, count(*) FROM products GROUP BY status -> active 33, discontinued 1. No
     `inactive` row exists.
  2. SELECT count(*) FROM product_variants WHERE price IS NOT NULL -> 0 (8 variants, 3 distinct
     product SKUs: MN-DRS-001 S/M/L stock 0/3/0; MN-KNT-001 S/M/L stock 4/0/2; MN-DRS-004 S/M
     stock 0/0 - every row price = NULL).
  3. SELECT count(*) FROM product_images -> 0;
     SELECT count(*) FROM products WHERE image_url IS NOT NULL -> 0 of 34.
expected:    a seed that can exercise every publication state, both variant-price cases, and the
             photographed-product path.
actual:      `inactive` is unreachable from a seeded database, so the unknown/inactive/
             discontinued identity check could only be proven two ways of three live (the third
             by code: repository.ts:259's `WHERE p.slug IN (...) AND p.status = 'active'`
             excludes inactive and discontinued by one predicate, landing both on the same
             `product === undefined` branch in mappers.ts). No variant carries an explicit
             price, so the override case is untestable from a seed. And no images means a
             seeded database always serves zero photographed products, which is the exact
             condition MED-3 fires on.
impact:      a future regression treating `inactive` differently from `discontinued` would not
             be caught by a seeded manual pass; R14's override scenario and Scenario E both
             required a variant to be priced by hand first. This audit authored that fixture
             (cashmere-pullover variant S = 2750) through the dashboard API; it exists only in
             moon_store_audit.
cause:       seed coverage gap, not a schema defect - the schema fully supports a non-null
             variant price and a populated product_images table (U8 confirmed both).
fix:         add one `inactive` product, one explicitly-priced variant and a handful of
             product_images rows to the seed, so publication state, the price-override seam and
             the photographed-product path are all reachable without hand-editing.
blocks:      no - but any future unit running an override or inactive scenario must author the
             fixture first.
proven-on:   real PostgreSQL (read-only SELECT on moon_store_audit and on a freshly seeded
             moon_store_audit_migcheck)
```

### LOW-4 — No test covers any non-POST method's cache header on the quote path

```
[LOW] MED-2 can regress silently even after a fix
apps:        server  (identical on main)
files:       apps/server/tests/catalogCartQuote.test.ts:480 (covers GET only)
contract:    none - observation; the test gap feeding MED-2.
repro:       grep -n "OPTIONS" apps/server/tests/catalogCartQuote.test.ts -> no matches.
expected:    the file that pins "GET on the quote path -> 404 no-store" would also pin OPTIONS.
actual:      only GET is covered; the OPTIONS case in MED-2 has no regression test.
impact:      MED-2 can regress silently after it is fixed.
cause:       test coverage gap.
fix:         add an OPTIONS case (no Origin, and a foreign Origin) beside
             catalogCartQuote.test.ts:480.
blocks:      no
proven-on:   code reading
```

### LOW-5 — A whitespace path segment is rewritten away, serving the parent listing with 200 at a child URL

```
[LOW] An unbounded family of soft-200 URLs per listing
apps:        storefront
files:       apps/storefront/proxy.ts (the next-intl proxy)
             apps/storefront/app/[locale]/(catalog)/shop/[category]/page.tsx:26
contract:    catalog plan KD-10 - an unknown category slug must be a real 404. The page code is
             correct; the request never reaches it.
repro:
  1. curl -s -D - -o /dev/null "http://localhost:3000/en/shop/%20"
     -> HTTP/1.1 200 OK, x-middleware-rewrite: /en/shop/, <title>Shop . Moon Fashion</title>
  2. Same for /en/shop/%20%20, /ar/shop/%20 (-> /ar/shop/), /en/collections/%20.
  3. /en/shop/dresses%20 -> 200, rewritten to /en/shop/dresses (the real Dresses page).
  4. /en/products/%20 -> 404 (that route has no parent page to fall back to).
expected:    /en/shop/<anything not a category slug> is a 404.
actual:      whitespace-only and trailing-whitespace segments are trimmed by the proxy before
             routing, so those URLs serve the parent listing with 200. Mitigation observed: the
             canonical is correct in both cases (http://localhost:3000/en/shop and
             .../shop/dresses). Every other malformed slug is a correct 404: /en/shop/Dresses,
             /en/shop/not-a-category, /en/collections/Evening, a 300-character collection slug.
impact:      analytics noise, and a crawler following a mistyped link gets 200 rather than 404.
             The correct canonical limits the SEO cost.
cause:       next-intl's proxy normalizes the pathname before Next's route match.
fix:         low priority. If it matters, normalize or reject empty-after-trim segments in
             proxy.ts - a check inside resolve() cannot help, because the rewrite happens first.
blocks:      no - cosmetic, canonical-protected.
proven-on:   live stack
```

### LOW-6 — A product-page 404 sends an empty, unlocalized body; the localized not-found renders only after hydration

```
[LOW] Correct status, correct content with JS, near-blank without it
apps:        storefront
files:       apps/storefront/app/[locale]/products/[slug]/page.tsx:36-40
             apps/storefront/app/[locale]/not-found.tsx
contract:    product-detail plan (2026-09-14-003) R1-R8 / KD-10 - an unknown slug is "a real 404
             with the localized not-found body".
repro:
  1. curl -s http://localhost:3000/en/products/nope-x  (status 404, correct)
  2. Strip <script> tags from the response: the visible body is "Moon Fashion" and nothing else.
  3. "Page not found" / "The page you're looking for doesn't exist yet." appear only inside the
     self.__next_f flight payload.
expected:    the localized not-found body in the server-sent HTML.
actual:      the document is <html id="__next_error__"> - Next's streaming-notFound shell. This
             was observed on a **production build** (x-nextjs-prerender: 1), not dev. `await
             connection()` (page.tsx:36) makes the route dynamic, and the shell flushes before
             notFound() is reached, so the localized UI is client-rendered from the payload.
             The same holds for /ar and for an unknown category slug.
impact:      correct status and correct painted content with JS; a near-blank page without JS,
             and the SSR'd HTML a crawler or a link preview fetches carries none of the copy.
cause:       notFound() thrown after the shell is flushed; inherent to the dynamic streaming
             route.
fix:         none urgent. Confirm in a browser that the painted 404 is the localized one
             (Appendix A, and U4's owner-pass item 5), then decide whether the not-found shell
             is worth a loading or static boundary.
blocks:      no
proven-on:   live stack (production build)
```

### LOW-7 — "Price updated" can be raised on a line that cannot be bought

```
[LOW] A sold-out line shows "Price updated" beside "Sold out"
apps:        storefront
files:       apps/storefront/features/cart/utils/reconcile.ts:306-315, :240
contract:    none - observation; CD-16 says only "the unit price differs from the one
             remembered".
repro:
  1. Quote silk-midi-dress size L (sold out): the live server answers status "soldOut" with
     unitPrice 2850, not null.
  2. Change the product price, then re-quote the same line.
expected:    a notice about a price the shopper cannot pay is noise.
actual:      price memory is recorded for any quoted line with a non-null unitPrice regardless
             of status (:306), and buildRow pushes the priceUpdated notice on the same
             condition (:240). A sold-out or reduced line therefore shows "Price updated"
             alongside "Sold out", and counts into issues.priceUpdated for the toast.
impact:      cosmetic; a slightly confusing double notice on a line excluded from the subtotal.
cause:       the price-memory gate is `unitPrice !== null`, not "status is purchasable".
fix:         gate price memory and the notice on status === 'ok' || status === 'reduced'.
blocks:      no
proven-on:   live stack (the soldOut response carrying unitPrice 2850)
```

### LOW-8 — A failed quote hides every row, so a persistently failing quote leaves the bag unmanageable

```
[LOW] Remove is unreachable while the quote fails
apps:        storefront
files:       apps/storefront/features/cart/utils/reconcile.ts:258-261, :270-277
             apps/storefront/features/cart/components/bag-view.tsx:80-99
             apps/storefront/features/cart/components/bag-drawer.tsx:170-189
contract:    apps/storefront/CLAUDE.md -> Cart -> Reconciliation: "`failed` (no rows ...)" -
             documented, hence filed as an observation rather than a contract violation.
repro:
  1. Stop the API, or misconfigure NEXT_PUBLIC_API_URL / STOREFRONT_ORIGINS.
  2. Open /en/bag with lines in the bag.
expected:    per the contract, the piece count, the error and Try again.
actual:      exactly that - and nothing else. `failed` carries no rows, so Remove is
             unreachable. `canEmpty` is true only for a 400 VALIDATION_ERROR (:259), so on a
             5xx or a network failure the shopper's only actions are Try again or clearing site
             data.
impact:      an environment misconfiguration - the CLAUDE.md note about a missing
             NEXT_PUBLIC_API_URL at build is exactly this - strands a shopper with a bag they
             cannot edit.
cause:       the failed view was designed around a transient failure.
fix:         consider offering Empty bag on any repeated failure, or rendering local-only rows
             with Remove enabled when a quote cannot be had.
blocks:      no - contract-conformant.
proven-on:   code reading only. Appendix A rows 106-108 exercise it live.
```

### LOW-9 — Try again is offered for `INVALID_RESPONSE`, which the retry policy refuses to retry

```
[LOW] The automatic policy says no, the manual button says yes
apps:        storefront
files:       apps/storefront/features/cart/utils/reconcile.ts:258-261
             apps/storefront/lib/query/get-query-client.ts:12-17
contract:    none - observation.
repro:
  1. Read shouldRetryQuery: INVALID_RESPONSE returns false, "repeating just delays the error".
  2. Read failure(): canRetry = !(VALIDATION_ERROR), so INVALID_RESPONSE -> canRetry true.
expected:    one policy on whether a deterministic failure is worth repeating.
actual:      the two disagree. Pressing Try again on an INVALID_RESPONSE re-runs the same
             request and fails the same way.
impact:      a dead button in a rare state.
cause:       canRetry keys on VALIDATION_ERROR alone rather than reusing the retry predicate.
fix:         make canRetry share shouldRetryQuery's judgement, or add INVALID_RESPONSE to the
             rejected set - which would also offer Empty bag, arguably the more useful escape.
blocks:      no
proven-on:   code reading only
```

### LOW-10 — Undo after the bag has refilled to 30 is a silent no-op, with no message

```
[LOW] An action that correctly does nothing, and says nothing
apps:        storefront
files:       apps/storefront/features/cart/utils/cart-lines.ts:134-147
             apps/storefront/features/cart/store/cart-store.ts:226-233
contract:    plan U5 scenario "Undo after the bag has refilled to 30 is a no-op rather than an
             error" - satisfied literally.
repro:       1. Remove a line. 2. Add distinct lines until the bag holds 30. 3. Press Undo on
             the toast.
expected:    no error.
actual:      restoreLine returns the same array (:140), the store returns early on
             `next === lines` (:230), and nothing is raised. The shopper presses Undo and
             observes nothing at all.
impact:      minor; an action that silently does nothing.
cause:       the guard is correct; there is simply no feedback branch.
fix:         raise the existing bag-full error toast when a restore is refused.
blocks:      no
proven-on:   code reading only (cart-lines.test.ts pins the pure no-op)
```

### LOW-11 — No database-level CHECK enforces the slug pattern on products, categories or collections

```
[LOW] The application is the only slug-shape guard, by documented design
apps:        db | server  (identical on main)
files:       apps/server/src/database/migrations/014_storefront_catalog.sql:9
             apps/server/src/modules/inventory/shared/slug.ts
             apps/server/src/modules/commerce/catalog/schemas.ts:26-30
contract:    apps/server/CLAUDE.md -> "Catalog slugs... 014 adds no CHECK because pg-mem has no
             regex" - documented as intentional, so this is a statement of fact rather than a
             defect.
repro:
  1. \d products / categories / collections shows only UNIQUE indexes on slug, no CHECK
     constraint referencing slug; confirmed by the absence of any regex CHECK in pg_constraint.
  2. INSERT INTO products (..., slug) VALUES (..., 'Not A Valid Slug!!') would succeed at the
     database layer.
expected:    per CLAUDE.md, the slug grammar (^[a-z0-9]+(?:-[a-z0-9]+)*$, 1-80 chars) is
             enforced only by Zod at the application boundary.
actual:      matches - only UNIQUE indexes constrain slug values, and they constrain uniqueness,
             not shape.
impact:      any path that writes a slug outside the Zod-validated create/update controllers -
             a raw migration backfill, an admin SQL fix, a future bulk import - can write a
             slug violating the pattern with no database guard. 014's own backfill constructs
             slugs procedurally and is the one place trusted to get this right without a CHECK.
cause:       a deliberate, documented trade-off: a pg-mem test-suite limitation drove a schema
             decision that also applies in production.
fix:         none required by contract. If a future migration bypasses the Zod boundary, add a
             regex CHECK NOT VALID at that time and validate separately.
blocks:      no - documented, and it matches CLAUDE.md exactly.
proven-on:   real PostgreSQL
```

### LOW-12 — The product detail read uses `CATALOG_REVALIDATE.list`, not `.entity`

```
[LOW] A constant's name mis-budgets the PDP's staleness by 5x
apps:        storefront
files:       apps/storefront/features/products/api/get-catalog-product.ts:108
             apps/storefront/lib/api/catalog.ts:5-8
contract:    none - observation. This audit plan describes the storefront's revalidation as
             "{ list: 60, entity: 300 }" and treats the PDP as the entity; the code does not.
repro:       read get-catalog-product.ts:108 - CATALOG_REVALIDATE.list. Confirmed live:
             Scenario A's PDP moved at 68 s, Scenario D's at 74 s, Scenario E's at 28 s - all
             inside a 60 s window, never 300 s.
expected:    the constant's name matches the TTL a reader would budget for.
actual:      nothing is broken - the shorter TTL is the safer of the two. But only collections,
             categories and store policies use entity: 300, and a reader of the constant's
             comment ("entities rarely change") would mis-budget every PDP number by 5x.
impact:      documentation/comprehension only.
cause:       the call site chose the shorter TTL deliberately; the constant's name did not
             follow.
fix:         rename to what it means (e.g. churning: 60 / stable: 300), or leave the values and
             add one line at the call site saying why the PDP is on the list TTL.
blocks:      no - no behaviour is wrong.
proven-on:   live stack + code reading
```

### LOW-13 — Full-suite dashboard and server unit-test flakiness under parallel worker contention

```
[LOW] A local resource-contention artifact, not a suite defect
apps:        dashboard | server
files:       apps/dashboard/vitest.config.ts:14 (testTimeout: 20000)
             apps/server/tests/database/seed.test.ts, seedCatalogKeys.test.ts
             apps/server/tests/verification/endpointHealth.test.ts
             apps/dashboard/src/features/fulfillment/components/delivery/DeliveryFormDialog.test.tsx
             apps/dashboard/src/features/pos/components/CartPanel.test.tsx
             apps/dashboard/src/features/inventory/pages/Inventory.test.tsx
contract:    none - observation. AD-9 classification: **environment-dependent**, not
             branch-introduced.
repro:
  1. cd apps/server && npm test -> first attempt: 3 files failed on hook/test timeouts
     (10000 ms / 5000 ms).
  2. Re-run immediately, nothing else changed -> all 94 files pass, and the real-PG suites
     correctly skip with the loud message.
  3. cd apps/dashboard && npm test -> two separate full-suite runs failed 7 and 9 tests
     respectively, always 20000 ms timeouts, in a different mix of files each run.
  4. npx vitest run --no-file-parallelism <that file> -> all 8 tests pass in 1.2-4.8 s each.
expected:    a deterministic suite result independent of what else runs concurrently.
actual:      whenever a suite ran while other heavy work was in flight - this audit's own
             concurrent commands and the live dev stack on ports 3000/3001/5173 - a shifting
             set of tests hit their fixed timeouts and failed; the identical file run alone
             passes with a wide margin.
impact:      none to code correctness. Every failure reproduced only under contention and
             disappeared on an isolated re-run. It does mean a local CI-equivalent run on this
             machine is noisy when other work is happening alongside it.
cause:       fixed per-test/per-hook timeouts sized for an uncontended run, combined with
             vitest's default file-level parallelism, on a shared machine.
fix:         no code fix recommended. If this recurred on a dedicated CI runner it would be a
             different and more serious finding; nothing here suggests it does.
blocks:      no - not reproducible in isolation; not a code defect.
proven-on:   live stack (Windows dev machine); re-run 2-3x per app as prescribed for a
             suspected flake
```

---

## Observations (no contract behind them — filed as observations, not defects, per AD-3)

- **`sanitizeBody` widens the quote's option-matching equivalence class.**
  `apps/server/middleware/sanitize.ts:4-11` runs app-wide (`app.ts:184`) ahead of the router, so
  `{"size":"<b>M</b>"}` and `{"size":"<script>alert(1)</script>M"}` both arrive at the matcher as
  the plain string `M` and quote **`ok`** at 2850 with `maxQuantity` 3, echoing the canonical `M`.
  This **closes the cart plan's deferred question with a definitive answer**. Server authority is
  intact — the price comes from the product row, the cap from real stock — but several distinct
  client strings collapse onto one variant, and `schemas.ts:227-231` documents matching only as
  "keys trimmed and lower-cased, values compared case-insensitively". *Recommended: documentation
  only.* `proven-on: live stack`.
- **`__proto__` as an option key is silently dropped, not rejected, and does not pollute.**
  JSON.parse semantics mean `__proto__` never becomes an own-enumerable property, so
  `Object.keys(options).length` is 0 and the line is evaluated as if no options were sent — on a
  no-variant product, status `ok`. `constructor` *is* an ordinary own key, is counted, and yields
  `variantUnavailable`. No pollution either way; the process stayed up. The safe outcome, but a
  third, previously undocumented one. `proven-on: live stack`.
- **`displayedPrice` takes `Math.min` over every variant price including sold-out ones**
  (`variant-selection.ts:65-74`), so a product whose cheapest size is sold out advertises a price
  nothing can be bought at. The card and the PDP's initial render do the identical thing, so the
  two surfaces never disagree — which is what R24 asks. Pinned by `variant-selection.test.ts`
  → *"is from the minimum, sold-out variants included…"*. AD-10 files it as a deliberate rule with
  a named guard. "From" is literally true as a lower bound. `proven-on: code reading only`.
- **The Quick Add panel discloses no price for the size being chosen.** Choosing L on
  `cashmere-pullover` adds a 3,200 EGP piece while the card still reads "From 2,750 EGP"; the PDP,
  by contrast, updates its price inside an `aria-live` region. `quick-add.tsx:66-67` states the
  owner decision ("the panel carries the required options only: it is not a small PDP"). The add
  hint carried into the bag is correct (exact 3,200) and the quote is authoritative, so nothing
  wrong is ever charged. `proven-on: live stack`.
- **No listing route became a Client Component during the redesign.** The only `'use client'`
  under `app/` is `app/[locale]/(catalog)/error.tsx`, the sanctioned KD-14 exception. The
  directive appears in 21 files storefront-wide, matching the documented twenty-one.
  `proven-on: code reading only`.
- **`check:client-paths` does not cover the storefront** — see *Repository state → Ratchets*.
  Architectural, not a bug; named here because the plan asked for it explicitly.
- **The API's `public, max-age=60` contributed exactly zero to every observed delay**, because
  nothing caches between Next and the API in this stack and Next's data cache governs that hop
  from its own `revalidate`. It is not inert in production: any shared cache in front of the API,
  or a browser calling the catalog GETs directly, holds its own 60 s copy that **stacks** on
  Next's 60 s → budget ~120–135 s. Nothing in the code would announce that.
  *Recommended: record the 120 s figure in `apps/storefront/CLAUDE.md` beside the existing "can
  linger up to 60s" sentence.* `proven-on: live stack + code reading`.
- **The auth login limiter cost U9 about nine minutes of wall clock** (~10 `POST /auth/login`
  calls in 6 minutes from one IP → 429, `RateLimit-Reset: 547`). Correct in production; recorded
  because any scripted cross-app probe that re-authenticates per step will hit it. Future runs
  should log in once and reuse the 15-minute access token. `proven-on: live stack`.
- **The dashboard bundle-budget gate passes** (404/414, 38/42, 37/37, 128/134, 32/35). The first
  reading of this audit was corrupted by running `npm run budget` concurrently with `npm run
  build`, i.e. budget read a `dist/` mid-write; recorded here for the audit's own auditability,
  not as a codebase finding.

---

## Confirmed correct

This section matters as much as the findings: it is what the owner does **not** need to
re-check. Every item names the evidence that verified it.

### Server authority and the cart quote (R6, R7, R17, R18, R19)

- **CC-1 — A NULL variant price resolves to the product price, exactly, on real PostgreSQL.**
  `mappers.ts` computes `toNumber(variant.row.price ?? productPrice)`; the `??` resolves *before*
  `toNumber`, so a NULL can never become `0`. Live: `silk-midi-dress` `products.price = '2850'`
  (NUMERIC-as-string from node-postgres), variant M NULL/stock 3 → quote `unitPrice 2850`,
  `lineTotal 5700`; the detail DTO carries `price: 2850` on all three variants, none `0` or
  `null`; `silk-slip-dress` (6750, both variants NULL and stock 0) quotes `unitPrice 6750` even
  while `soldOut`. The pg-mem divergence caveat is closed. `proven-on: real PostgreSQL`.
- **CC-2 — The status ladder behaves exactly as contracted.** One request, two lines on
  `silk-midi-dress`: size S (stock 0) → `soldOut`, unitPrice 2850 still shown, quantity 0,
  max 0, lineTotal 0; size M (stock 3) asked 7 → `reduced`, quantity 3, lineTotal 8550;
  `subtotal 8550`, `itemCount 3` — the sold-out line contributes nothing and the reduced line
  contributes its *allowed* quantity. `{"size":"XXL"}` → `variantUnavailable`, unitPrice null,
  options `[]` — **no silent substitution**. `{"SIZE":"m"}` → `ok` with canonical
  `{"key":"size","value":"M"}` echoed, proving CD-5 at the boundary.
  `proven-on: real PostgreSQL`.
- **CC-3 — Per-line stock caps are independent, never cumulative, and never disclose stock above
  10.** 30 lines all naming one stock-3 variant, each asking 10: distinct `maxQuantity` across
  all 30 = `{3}`, distinct `quantity` = `{3}`, subtotal 256500, itemCount 90 — the honest sum of
  30 independently-capped lines. A no-variant product with real stock 22 returns `maxQuantity`
  **10, not 22**. A regex scan of both full responses for `stock` finds nothing: `maxQuantity` is
  the only stock-derived number on the wire. `proven-on: real PostgreSQL`.
- **CC-4 — The quote is no existence oracle.** An unknown slug and a `discontinued` product
  return **byte-identical** lines (`{"status":"productUnavailable","product":null,"options":[],
  "unitPrice":null,"requestedQuantity":1,"quantity":0,"maxQuantity":0,"lineTotal":0}`; string
  comparison with index and slug removed: IDENTICAL). Both detail routes 404 with byte-identical
  bodies (`cmp -s` identical). The `inactive` leg takes the same predicate
  (`repository.ts:259 … AND p.status = 'active'`) and is `proven-on: code reading` only, because
  the seed authors no inactive product (LOW-3).
- **CC-5 — L5's `no-store` invariant holds on every status a shopper reaches, but nothing pins
  the registration order.** Live: quote 200, 400 (extra field), 400 (malformed JSON), 413 and GET
  (404) all carry `no-store`; 429 and 503 are proven by code (`rateLimits.ts:286-288` sets
  `no-store` inside the limiter's own handler; the quote's `noStore` middleware runs ahead of the
  handler, so it is already set when `service.ts:60` raises the 503). Eight `no-store` assertions
  exist in `catalogCartQuote.test.ts`, **every one on the resulting header**; a grep for
  `router.stack` / `routes[0]` / `stack[0]` across `apps/server/tests` finds nothing. Moving the
  POST handler below `router.use(createCatalogLimiter())` / `publicCacheOnSuccess(...)` would
  ship per-bag pricing as `public, max-age=60` with no type error and no failing test. Today's
  behaviour is correct; the exposure is purely to a future edit. **Recommended: a test that
  imports the router, walks `router.stack`, and asserts the `/cart/quote` POST layer's index is
  lower than those two `router.use` layers.** MED-2 is a live instance of exactly this class.
- **CC-6 — L6 dismissed: the quote spends exactly its own bucket and the server token grants
  nothing there.** Live matrix: catalog GET no token → `RateLimit-Limit 300`; valid token →
  **20000** (trusted bucket); wrong token → 300; token sent twice → 300 (the `headersDistinct`
  guard treats a repeated header as no token); quote POST with a valid token → 300, same series
  as an untokened quote; GET, HEAD and OPTIONS on the quote path all carry the *quote* limiter's
  headers, not the catalog limiter's. The quote series (Reset 837) and catalog series (Reset
  ~695) count down independently, proving separate stores. `createCatalogLimiter`'s
  `skip: isCartQuotePath` is deliberate and correct. `proven-on: live stack, every leg`.
- **CC-7 — `.strict()` rejects `price`, `unitPrice` and `total`, and the server's price does not
  move.** A line carrying `price` → 400 `unrecognized_keys` on `lines.0`; a body-root `total` →
  400 on `""`; a clean follow-up quote still returns 2750/2850 unchanged.
  `proven-on: live stack`.
- **CC-8 — Bounds are exact at every documented edge, with no off-by-one either way.** 30 lines
  → 200 / 31 → 400 `too_big`; quantity 10 → 200 / 11 → 400; six options → 400; a 41-character
  option key → 400; an uppercase slug → 400 `invalid_string` *before* the repository, so a
  malformed slug is not an existence probe. `proven-on: live stack`.
- **CC-9 — Body-size and malformed-JSON handling.** ~20 KB body → 413 "Request body is too
  large" with `no-store`, refused by the 16 KB parser before the schema; `{bad` → 400 "Request
  body is not valid JSON" with `no-store`, never a 500 — which is exactly why
  `cartQuoteBodyErrors` exists. `proven-on: live stack`.
- **CC-10 — Column allowlists hold on every route, including variant-bearing products.** Eight
  responses (`/products?page=1`, `?page=2`, two product details, `/categories`, `/collections`,
  `/store-policies`, and a two-line quote naming two variant products) were scanned for
  `id|sku|barcode|stock|cost_price|product_id|variant_id|min_stock|supplier*|reorder*`:
  **zero matches on all eight**. A variant-bearing detail exposes variants as
  `{options, price, inStock}` with **no variant id** — PD-3 holds on the wire. The full per-route
  key table is in Appendix B. `proven-on: live stack`.
- **CC-11 — Cache headers.** Every catalog GET 2xx carries `public, max-age=60` (five routes
  verified); the quote carries `no-store` on every observed status. The one exception is MED-2.
  `proven-on: live stack`.
- **CC-12 — CORS on the quote.** `OPTIONS` with `Origin: http://localhost:3000` → 204 with ACAO,
  `Access-Control-Allow-Methods: POST,OPTIONS`, `Max-Age: 600`, and **no
  `Access-Control-Allow-Credentials` anywhere**. The dashboard dev origin gets no ACAO on either
  preflight or POST, so a compliant browser blocks the calling page from reading it. The server
  still executes the POST — expected, since `cors()` sets or omits a header rather than gating
  server-side execution, and this is unauthenticated public catalog data (KD-1) with no
  credentials attached. `proven-on: live stack`.

### Storefront listings (R2)

- **CC-13 — Every listing state behaves.** `/en/shop` 200, 24 cards on page 1 / 10 on page 2,
  newest first, "34 pieces", pagination targeting `#catalog-results`. A known category with zero
  active products (`kimonos`) is **200 with "This edit is being restocked"**, not a 404; an
  unknown category slug is a real 404; `winter-tailoring` (upcoming) and `summer-2025` (archived)
  are both 404s with the shared body, so unreleased slugs cannot be probed. `/en/new-in` renders
  exactly the 30-day window (16 cards; SQL confirms 8/12/16 at 14/21/30 days).
  `/en/collections` shows exactly the three active collections. `proven-on: live stack`.
- **CC-14 — The URL grammar falls back everywhere and 500s nowhere.** `?page=0` → page 1;
  `?page=9999` → page 1; `?page=3` past last → "This page is empty"; `?min=37` → floored to 50;
  `?min=900&max=100` → swapped; `?sort=nonsense` → `newest`; `?sort=curated` outside a collection
  → normalized away, honoured inside one; an unknown parameter ignored; `?min=10000001` above
  `CATALOG_PRICE_MAX` dropped. **Eastern-Arabic digits normalize correctly**: `?page=٢` →
  canonical `?page=2`; `?min=١٠٠&max=٩٠٠` → identical result to ASCII. The one divergence is
  MED-4. `proven-on: live stack`.
- **CC-15 — Metadata is exactly as specified.** `/en/shop` and `/en/shop?page=2` indexable with a
  self-canonical; `?sort=`, `?min=` and `?stock=` all `noindex, follow`; `/en/bag` and
  `/en/checkout` `noindex, nofollow`; `hreflang` alternates emitted as `Link` headers for both
  locales plus x-default. `proven-on: live stack`.
- **CC-16 — EN and AR both render every listing cleanly.** No `MISSING_MESSAGE`, `IntlError` or
  raw `catalog.*` key text in any listing's HTML in either locale. `/ar/*` renders
  `<html lang="ar" dir="rtl">` with no untranslated chrome. Arabic product names on EN listings
  carry `lang="ar" dir="auto"` — `localizedName`'s documented fallback, not a missing
  translation. The grid mirrors via CSS grid + `dir`; pagination arrows mirror via
  `rtl:-scale-x-100` and nudge in the correct direction; no physical `ml-`/`mr-`/`left-`/`right-`
  utilities in the pagination or grid modules. `proven-on: live stack`.

### ProductCard, Quick Add and Product Detail (R3, R4, R16, R24)

- **CC-17 — There is exactly one cart store, one readiness function and one price function, and
  Quick Add is not a second cart.** `cart-store.ts:293` is the only `createCartStore()` call and
  `useCartActions` (`:324`) the only way in; the four consumers are `add-to-bag-button.tsx:12`,
  `quick-add.tsx:18`, `bag-drawer.tsx:8`, `bag-trigger.tsx:7`, `use-bag-controller.ts:7`.
  `purchaseReadiness` (`variant-selection.ts:86`) is called from exactly two places —
  `purchase-panel.tsx:72` and `quick-add.tsx:86` — and `quickAddPress` / `addToBagIntent` both
  *consume* a readiness rather than re-deriving it. `displayedPrice` (`variant-selection.ts:65`)
  serves PDP, the card's add hint and the card caption. Both surfaces write through the same
  `addToBagIntent(readiness, slug, quantity)` and the same `actions.add(intent.identity, …)`, and
  `cartLineKey` sorts option entries by key, so the same product + options yields a
  byte-identical key from either surface and merges in place. Named guards:
  `variant-selection.test.ts` → *"ready options equal the variant DTO options object (the Cart
  line identity)"*; `cart-lines.test.ts` → *"ignores option key order"*, *"merges the same slug
  and options"*; `add-to-bag-action.test.ts` → *"adds the ready options for a variant product"*.
  **No duplication is reportable under R24/AD-10 for this half.** `proven-on: code reading + 231
  green cart tests`.
- **CC-18 — The listing DTO and the detail DTO agree, so a card can never offer a size the
  product page refuses.** All 33 active products were fetched both ways and compared field by
  field: `options`, `variants`, `description`, `descriptionEn`, `price`, `inStock`, `isNew`,
  `name`, `nameEn` are **byte-identical for every product**. The single divergence is `images`,
  capped at `CATALOG_LIST_IMAGE_COUNT` vs `CATALOG_DETAIL_IMAGE_COUNT` by design (2 vs 8 on
  `embroidered-evening-gown`) — the one field the card does not need parity on.
  `proven-on: live stack`.
- **CC-19 — No surface renders `0 EGP`, in any price case.** A grep for `0 EGP` across every
  fetched page returns nothing. No variants (`linen-summer-dress`): 1,950 on both. Variants
  sharing one price (`silk-midi-dress`): exact 2,850, not "From". Variants differing
  (`cashmere-pullover`): **"From 2,750 EGP"** on card and PDP, with `data-readiness=
  "needsSelection"`. Explicit override selected: 2,750. NULL-priced variant: 3,200, the product
  price. The DTO's `variant.price` is already effective, and `get-catalog-product.ts:34,61-69`
  rejects any variant whose `price` is not a finite number — so a NULL reaching the client would
  fail the page rather than render. `proven-on: live stack + real PostgreSQL`.
- **CC-20 — Readiness renders correctly in every state, and availability is never colour alone.**
  *Needs selection*: `quickAddPress` returns `choose`, `onTrigger` opens the panel and calls
  `askFor(readiness.keys[0])` on the next frame, focusing the first radio of that group and
  raising one error toast; `addToBagIntent` returns `focusSelection`, never `add`. A
  single-valued option is preselected by `initialSelection` and adds on the first press — the
  documented intent, not a silent default. *Sold out*: `purchaseReadiness` returns `soldOut` both
  when `!product.inStock` and when a full selection matches no in-stock variant; rendered with
  `aria-disabled="true"` and **no `disabled` attribute** on both surfaces, so both stay
  focusable. *Unavailable option value*: the radio stays enabled, the label gets `border-dashed`,
  the text is `line-through` + `aria-hidden`, and an `sr-only` span carries "{value}, sold out" —
  live proof on `/en/products/cashmere-pullover`: `line-through">M<` immediately followed by
  `sr-only">M, sold out<`. `proven-on: live stack`.
- **CC-21 — Image degradation (R16) holds in every configuration.** Zero images → the
  `ProductImagePlaceholder` (`moon-fashion-mark.png`, `aria-hidden`, `opacity-15`) on card and
  PDP, with `product-gallery.tsx:22-28` returning the 4:5 placeholder frame before reaching the
  viewer. One image → `galleryLayout` returns `kind:'single'`, `data-gallery-thumbs` is **not
  emitted**, and the page carries 1 `role="tablist"` (the details tabs) and 0 thumbnails — no
  empty strip; on the card, `secondary` is null so no hover-swap node renders at all. Full
  gallery → `data-gallery-thumbs` once, 8 thumb buttons, 2 tablists. **Touch: the second image is
  never fetched** — `.hover-alt-image` is `display:none` outside `(hover: hover) and
  (min-width: 768px)`, the wrapper renders only when both images exist, and `loading` is never
  `eager` on the secondary. `proven-on: live stack`.
- **CC-22 — 404 versus error semantics are correct, and a transient failure can never become a
  404.** Live: unknown slug 404, malformed slug `NOT__a..slug` 404, discontinued
  `printed-cotton-kimono` 404. `get-catalog-product.ts:112-115` maps **only** `NOT_FOUND` and
  `VALIDATION_ERROR` to `null` (→ `notFound()`); every other error — a timeout, a 503,
  `INVALID_RESPONSE` — rethrows to `app/[locale]/(catalog)/error.tsx`. The `inactive` leg is
  proven by the repository predicate, not a live probe (LOW-3). `proven-on: live stack`.
- **CC-23 — L9's premise is false, and the disc has no touch-width fallback.**
  `globals.css:841` carries **no `@media (hover: hover)`, no `(pointer: fine)`, no `min-width`** —
  grepping the region confirms the only three media guards nearby wrap other rules and close
  before `:841`. The disc is grid-overlaid onto the photograph at *every* width and *every*
  pointer type, in both LTR and RTL; `globals.css:844-847` records this as the owner's
  2026-09-21 decision. The disclosure panel is **not** clipped by the photograph — the action div
  is a sibling of the `overflow-hidden` frame sharing its grid cell, so the panel escapes it. All
  24 cards on `/en/shop` render `data-card-action="overlay"` and zero render any other value.
  RTL mirrors without a second rule (`justify-start`, `inset-x-0`, `end-2`, `start-3`, symmetric
  `padding: 0.75rem`), and AR labels are fully localized. `proven-on: live stack`.

### The bag: persisted state, reconciliation, surfaces (R5, R8, R9, R10)

- **CC-24 — The browser holds intent only, and one serializer proves it.** `serializeCart`
  (`cart-storage.ts:29-39`) is a projection, not a copy: it maps `({ slug, options, quantity })`
  and nothing else, and `CartLine` (`cart-lines.ts:10-14`) declares only those three fields — a
  price, name, image, stock, SKU or availability field has no place to live. The reader is
  symmetric: `parsePersistedCartLine` returns a **freshly built** object, so an extra key in
  storage is never read and vanishes on the next rewrite. The in-memory Add-to-Bag hint
  (`{name, imageUrl, unitPrice}`) lives only in `CartSession` and is never passed to `writeCart`.
  Pinned by `cart-storage.test.ts:195` ("keeps drawer and session memory out of storage") and
  `:243` ("keeps an Add to Bag hint in memory only, and drops it with its line"). The request
  body is the same projection (`quote-cart.ts:23-31`, pinned at `quote-cart.test.ts:67`), and the
  server's `.strict()` rejected a body carrying `price` live. `proven-on: code reading + live
  400 + 231 green tests`.
- **CC-25 — Every storage recovery path is covered by a test.** `null` → empty bag, no write;
  malformed JSON → reset and rewrite; bad envelope → reset; `version: 2` → reset (L10);
  `quantity: "2"` → that line dropped, the rest kept; six options → line dropped; `__proto__`
  option key → line dropped, no pollution; 31 lines → first 30 distinct kept; a duplicate line
  key → merged into the first occurrence, capped at 10; storage throwing (private mode) →
  in-memory bag for the session, nothing thrown to the shopper. **Nothing here is unguarded.**
  `proven-on: vitest (22 cart-storage + 13 persisted-cart tests)`.
- **CC-26 — Reconciliation joins by line key, never by position, and CD-15 is honoured.**
  `reconcile.ts:288-292` builds a `Map<lineKey, CartQuoteLine>` from `result.lineKeys` captured
  with the request, and every row looks itself up by `cartLineKey(line)`. `displayQuantity` on a
  `reduced` row is display only — the **stored** quantity stays at the requested figure until the
  shopper acts — and `bag-view-model.ts:91-93` forces both stepper buttons enabled on a reduced
  row so either press commits an allowed quantity. Pinned at `bag-view-model.test.ts:205` and
  `reconcile.test.ts:269` ("writes nothing, and says so again next quote"). The full status
  matrix is in Appendix C. `proven-on: live quote probes + vitest`.
- **CC-27 — The only store write reconciliation performs is the canonical option rewrite, and it
  is a fixed point.** Gated at `reconcile.ts:317-320` (only when `current` exists **and**
  `quoteLine.options.length > 0`, so an empty-options `variantUnavailable` can never wipe stored
  options), applied once by `use-bag-controller.ts:120-126` behind
  `appliedCorrection.current === correction.quoteKey`, and `applyCanonical` short-circuits when
  the rewritten key equals the old one. Fixed point pinned twice (`reconcile.test.ts:431`, `:471`,
  including the merge case). Live: sending `size: "s"` and receiving `size: "S"` performs exactly
  one rewrite. `proven-on: live stack + vitest`.
- **CC-28 — Subtotal and counts only ever come from the quote.** `reconcile.ts:329-341`; the
  client never sums. `localPieces` (Σ stored quantities) is carried separately for the header
  badge and the failed view, so the header count is the local sum including sold-out lines and
  **never reads the quote** (`bag-trigger.tsx:70-71`, `totalPieces(cart.lines)`, guarded by
  `cart.hydrated`; the trigger imports nothing from the quote). `proven-on: code reading +
  vitest`.
- **CC-29 — Bounds, merge, remove and undo all behave as specified.** `−` disabled at 1 with
  removal explicit; `+` capped at `min(maxQuantity, 10)` with a `stockLimit` or `capped`
  description; adding 8 then 5 merges to 10 and returns outcome `merged` with `addedQuantity 2`,
  which the toast rules render as the "up to 10" message; a line already at 10 is `capped` with
  no change; a 31st distinct line is `full`, leaving `lines` untouched. Remove reads the line,
  its index and its hint out of the live store before removing, and Undo restores all three at
  that index. `proven-on: vitest (38 cart-lines + 11 quantity-control tests)`.
- **CC-30 — The checkout gate and locale preservation conform.** `checkoutReadiness` returns
  `blocked` with separate unavailable/limited counts whenever any row is unavailable or
  `reduced`; `CheckoutEntry` then renders an `aria-disabled`, focusable button described by the
  stated reason instead of a `Link`, and only `ready` yields a real `Link`. **A price change alone
  does not block** (`checkout-readiness.test.ts:122`). The drawer has no checkout entry at all —
  only the reserved `data-checkout-action` slot — so the flow is drawer → View bag → Checkout.
  Locale: the entry uses `Link` from `@/i18n/navigation` with `CHECKOUT_HREF '/checkout'`, so it
  resolves to `/en/checkout` or `/ar/checkout`. `proven-on: code reading + vitest (7/5/3 tests)`.
  **The production-build 404 leg is reasoned, not run** — see *Manual QA gaps*.

### Dashboard authoring (R11, R15, R16)

- **CC-31 — Slug rules, price and stock bounds, and clear-vs-keep semantics all hold live.** A
  full-field create round-trips `name`, `name_en`, `slug`, `description(+en)`, `material(+en)`,
  `care(+en)`, `fit(+en)`, `price`, `cost_price`, `stock`, `category_id`, `min_stock` exactly. A
  colliding slug (against another audit product *and* against the seeded `silk-midi-dress`) is a
  409 `SLUG_TAKEN` shown inline, never a silent rename; "Audit Bad Slug" is a 400 with "Slug must
  be lowercase letters and digits separated by single hyphens". `price: 0` → 400 `too_small`;
  `price: -10` → 400; `stock: -1` → 400. **Clear vs keep, all three cases:** omitting
  `name_en`/`description_en`/`material`/`care`/`fit` on PUT leaves every stored value untouched
  (verified by SELECT before and after); sending `null` clears to NULL; sending `""` *also*
  clears to NULL. The third case matters because `getEditFormValues` maps every nullable field to
  `''`, so the dashboard always sends strings and never omits — the "omitted keeps" branch is
  API-only and unreachable from the UI, while "operator empties the box" correctly clears.
  `proven-on: live stack`.
- **CC-32 — The gallery cap, the reorder permutation and image deletion are all correct.** The
  9th image is a 409 `GALLERY_FULL`. Reorder `[8,1,2,3,4,5,6,7]` → 200 with dense positions 0–7
  in the submitted order; a short list `[8,1,2]` and a list containing a foreign id are both 400
  `IMAGE_SET_MISMATCH`, and a follow-up read shows the order **unchanged** by either. Deleting a
  gallery image → 204, then **0 orphaned `product_images` rows** (LEFT JOIN against products) and
  **0 duplicate `(product_id, position)` pairs**; remaining positions are not renumbered, exactly
  as the contract states. Uploaded objects serve correctly (`GET /uploads/products/<key>` returns
  bytes; `file` reports "PNG image data, 64 x 64"). `proven-on: live stack`.
- **CC-33 — `status` and collection membership are correctly off the product form, and both
  separate paths work.** Images are edit-only by design (`ProductFormDialog.tsx:486-501`, with
  the reason in a comment: "Images address the product by id, so they appear once it exists").
  `PUT /api/v1/products/35/status {"status":"inactive"}` → 200, and
  `GET /api/v1/catalog/products/audit-u6-dress` immediately became **404**; setting it back to
  active restored the 200. An invalid value is a 400 `invalid_enum_value`.
  `PUT /api/v1/collections/3` with a stale `expected_updated_at` → **409 CONFLICT**,
  `details[].code COLLECTION_MODIFIED`, and nothing written; with the correct token, membership
  is replaced wholesale, `collection_products` holds dense positions in the submitted order, and
  the public catalog follows immediately. `proven-on: live stack`.
- **CC-34 — Category authoring and reassignment work end to end.** Slug "Bad Slug Here" → 400;
  a slug colliding with the seeded `shoes` → 409 `SLUG_TAKEN`; a valid category is created;
  reassigning a product to it makes it appear at `?category=audit-cat` and disappear from
  `?category=knitwear` immediately; deleting a category still referenced by a product → 409.
  `proven-on: live stack`.
- **CC-35 — The magic-byte upload guard works.** A `.png` whose bytes are JPEG → 400 "File
  extension (.png) does not match actual content (image/jpeg)"; a `.png` containing plain text →
  400 "File content does not match a supported image format". (The size and extension refusals do
  *not* — that is HIGH-5.) `proven-on: live stack`.

### Stock and pricing across all apps (R13, R14, R24)

- **CC-36 — The source of truth for stock is settled and correct on every sale path.** For a
  product with `has_variants = 1`, `product_variants.stock` is the only column any sale, refund,
  exchange, online order, PO receipt, stock count or the public catalog reads or writes; every
  writer branches on `variant_id` and writes one column XOR the other. The catalog reads
  `hasVariants ? variants.some(inStock) : products.stock > 0` (`mappers.ts:353`) and the quote
  reads the matched variant's stock. The full 13-writer / 10-reader table is in Appendix D. The
  defect is not in the write paths — it is that `products.stock` is dead state the dashboard
  still presents (HIGH-4). `proven-on: real PostgreSQL | live stack`.
- **CC-37 — The negative-stock guard refuses and writes nothing.** Variant L stock 2; a sale of 5
  → 400 `INSUFFICIENT_STOCK {productId:4, variantId:6, requested:5, available:2}`. SELECT after:
  `products.stock` unchanged, variants unchanged, `count(*) FROM sales` unchanged (no partial
  row), and the catalog's variant array byte-identical to before. The refusal even reports the
  true available quantity via a separate read. `proven-on: real PostgreSQL`.
- **CC-38 — Refund, exchange and stock count each write the column the sale took from.** A refund
  of a variant sale moved variant 4 from 3 → 4 with `products.stock` untouched. An exchange
  returning a non-variant line and taking a variant line moved `products(3).stock` 30 → 31 and
  variant 6 from 2 → 1 — each side in its own column. A stock count applied to variant 4 moved it
  to 7 with `products(4).stock` still 6. The catalog and quote reflected every change on the next
  request. `proven-on: real PostgreSQL | live stack`.
- **CC-39 — The parallel price implementations are guarded, not duplication to remove (AD-10).**
  `sales.variantPrice.realpg.test.ts` pins the SQL `COALESCE` side on real PostgreSQL ("charges
  the product price for a variant with no price of its own", "charges a priced variant its own
  price"); `catalogCartQuote.realpg.test.ts:82` pins the `??` side ("prices a NULL-price variant
  at the NUMERIC product price, as a number", asserting `typeof raw.rows[0].price === 'string'`
  first). This audit proved them equal live on one fixture: POS charged 2750 for variant 4 and
  the quote returned 2750 for the same variant. **Reported as confirmed correct with a named
  guard.** The one gap — no single test asserts the two *against each other* — is in *Test gaps*.
  `proven-on: real PostgreSQL | live stack`.
- **CC-40 — The client cannot influence price.** A quote body carrying `price: 1, unitPrice: 1`
  → 400 `unrecognized_keys`; the following clean quote returned `unitPrice 2750`, unchanged.
  `proven-on: real PostgreSQL | live stack`.

### Database and migrations (R20)

- **CC-41 — `verify:migrations` PASSES for all 17.** All 17 applied cleanly to an empty database,
  then each was individually rolled back (017 down to 001, cumulatively) and re-applied, with
  column/constraint/index snapshots compared at each step. Output: `All 17 migrations
  round-trip.` No `.down.sql` left residue, and none was a silent no-op outside the declared
  `002` case ("Intentionally a no-op."). `proven-on: real PostgreSQL`.
- **CC-42 — The schema underpins the price contract exactly.** `products.price` NUMERIC **NOT
  NULL**; `product_variants.price` NUMERIC **nullable** — the override seam, confirmed by
  `information_schema`. The full six-table schema map is in Appendix E. `proven-on: real
  PostgreSQL`.
- **CC-43 — Both stock CHECKs are still `NOT VALID`, as documented.** `products_stock_non_negative`
  and `product_variants_stock_non_negative` both report `convalidated = false` with definition
  `CHECK ((stock >= 0)) NOT VALID`, preserved through 014's lift/backfill/restore. `NOT VALID`
  skips validating *existing* rows only; future writes are still checked. `proven-on: real
  PostgreSQL`.
- **CC-44 — Every constraint and cascade behaves.** Duplicate slug on products, categories and
  collections → 23505 on `idx_products_slug` / `idx_categories_slug` / `idx_collections_slug`;
  duplicate `(collection_id, position)` → 23505 on `collection_products_position_unique`;
  duplicate `(product_id, position)` → 23505 on `product_images_position_unique`; deleting a
  product cascades to its variants, gallery rows and collection memberships with **no orphans**;
  deleting a category sets `products.category_id` NULL for its four products and **deletes no
  product** (all 34 survive). All run inside rolled-back transactions.
  `proven-on: real PostgreSQL`.
- **CC-45 — 017's index exists; its value is neither confirmed nor refuted at this scale.**
  `idx_collection_products_product_id` is present in `pg_indexes`. `EXPLAIN (ANALYZE, BUFFERS)`
  of `listProductCollections` at 21 `collection_products` rows shows the planner choosing a seq
  scan (post-ANALYZE) rather than the index — both plans cost ~2–23, trivially cheap either way.
  This reproduces the documented caveat exactly: CLAUDE.md itself records that the KD-17 index
  candidates were measured on 8,000 products. **Not a defect**; re-verifying 017's value needs a
  comparably sized dataset. `proven-on: real PostgreSQL, at 21-row scale only`.

### Cross-app propagation (R12, R23, R15)

- **CC-46 — The number the owner wants: a price changed in the dashboard is charged correctly
  within 5 seconds, and displayed correctly within ~90 seconds.**

  | Hop | Worst case observed | Which layer |
  | --- | --- | --- |
  | Dashboard `PUT` → database | 20 ms | none |
  | Database → API catalog GET | **≤ 5 s** — no server-side cache | none |
  | Database → **the price the shopper is charged** (`POST /cart/quote`) | **≤ 5 s** | none — the quote is `no-store`, verified live |
  | API → storefront listing | 68 s (A), 54 s (C), 52 s (C.2), 42 s (E), 69 s (collection), 87 s (category) | Next `revalidate: 60` |
  | API → storefront product page | 68 s (A), 74 s (D), 28 s (E), 89 s (F) | Next `revalidate: 60` |

  **The right way to state it is not "60 seconds" but "60 seconds plus one more page view."**
  Scenario F shows why: `patch-fetch.js` serves the **stale** body to the first request after the
  TTL expires and revalidates in the background, so the *second* request is the first fresh one.
  A busy page settles near 60 s; a page nobody visits stays stale until somebody visits it twice.
  **The window never touches money** — everything a shopper is charged comes from the `no-store`
  quote, under 5 seconds behind the dashboard in every scenario, and when display and price
  disagree `reconcile.ts` tells the shopper ("Price updated") rather than quietly charging the
  new figure. `proven-on: live stack`.
- **CC-47 — Scenario A (price changed).** The next quote returned the new price
  (`unitPrice 3100`, `lineTotal 6200`) in ≤5 s; the listing and PDP followed at 68 s. The shopper
  is told by construction: `reconcile.ts` compares against `session.previousPrices` for the same
  line key, pins the change to the quote key so it does not vanish on re-render, and emits
  "Price updated" plus one live-region announcement, marked by `issueMarkKey` so an identical
  re-quote stays silent. **Checkout is not blocked by a price change alone** (CO-5).
- **CC-48 — Scenario B (stock reduced below quantity).** The quote **echoes the requested 5 back**
  and reports what it will sell (2) alongside it: `status reduced`, `requestedQuantity 5`,
  `quantity 2`, `maxQuantity 2`, `lineTotal 3900`. `maxQuantity` is `min(stock, 10)` and discloses
  nothing beyond the cap. The shopper sees "Only 2 available"; `displayQuantity` is 2 while
  `row.line.quantity` stays **5** — the stored intent is untouched until they act. `checkout
  Readiness` returns `blocked` with `limited: 1`.
- **CC-49 — Scenario C (inactive, then discontinued).** The bag half is exactly the contract: the
  line is **kept at its index** with its `requestedQuantity`, flagged `productUnavailable`,
  excluded from the subtotal, never removed — and identical for an unknown slug, so the bag is no
  existence oracle either. The listing dropped both products correctly (54 s, 52 s). `inactive`
  and `discontinued` are indistinguishable on every public surface, as intended. **The product
  page is the exception — HIGH-2.**
- **CC-50 — Scenario D (variant removed): no substitution, and no restart needed.** The removed
  line did not acquire `S` or `M`; it kept its own index and `requestedQuantity`, lost its price
  and options, and was excluded from the subtotal. The surviving `S` line was untouched. The
  shopper is told ("This option is no longer available"), and checkout blocks. **The plan's open
  question is answered:** no second API instance and no Next restart were needed — the removal is
  a change in the shared database, so the running storefront picks it up on its own revalidate;
  the only limitation is the 60 s data-cache window.
- **CC-51 — Scenario E (variant price → NULL): nothing renders `0 EGP`.** The detail moved to the
  product base 3200 in ≤1 s via `variant.row.price ?? productPrice` before `toNumber`; the quote
  returned 3200. `grep -oE '(^|[^0-9,])0 EGP'` over the rendered PDP → **0 matches**; the only
  prices were 1,200 / 2,400 / 3,200 EGP, and `/ar` rendered the same figures with the Arabic
  currency suffix. Confirmed on real PostgreSQL where NUMERIC arrives as the string `"3200"`.
- **CC-52 — Scenario F (new gallery image) and the cache arithmetic.** The API showed the new
  image in ≤1 s (primary first, then gallery by `position`); the PDP and the card's hover image
  both followed at 89 s. That 89 s is the measurement that explains the whole cache: the entry
  went stale at ~02:54:49, the request at 02:55:05 was served the **stale** body and triggered a
  background revalidation, and the *next* request got the refreshed entry. Correctly, no notice
  fires — a new photograph does not change a shopper's intent.
- **CC-53 — Collection membership and category reassignment both propagate cleanly.** Adding
  `cashmere-pullover` to `silk` appeared at 69 s and removing it disappeared at 32 s; a category
  reassignment moved the product **out of one page and into the other in the same render** at
  87 s, so a product is never briefly in two categories or in none. Membership rides
  `CATALOG_REVALIDATE.list` (60 s) because it is a product-list query; only the collection
  *entity* is on the 300 s TTL — a distinction that is not obvious from the constant.
- **CC-54 — Every mutation was restored through the same API and verified by SELECT.** Ten
  changes reverted: product price 3100 → 2850; stock 2 → 31; two statuses and a control status
  back to `active`; the variant override restored to 2750 (so the database's only explicit
  variant-price fixture survives); the deleted `MN-KNT-001-L` variant recreated; the added gallery
  image deleted (`product_images` for product 1 back to 0); the `silk` collection restored to its
  seeded six; and the category reassignment reverted. **One recorded caveat: the recreated
  `MN-KNT-001-L` carries id 10, not its original id 6** — a delete plus an insert is not an undo.
  Nothing public exposes a variant id (PD-3), so no storefront surface can tell, but any future
  work that pinned `variantId 6` must use 10. Separately, `linen-summer-dress` (id 3) still
  carries a test name and a NULL barcode from HIGH-3's probe, by design — that is the evidence.

### Dismissed leads

- **CC-55 — L6 dismissed.** See CC-6: proven correct live, end to end.
- **CC-56 — L10 dismissed.** `cart-storage.ts:59` reads
  `if (!envelope || envelope.version !== CART_VERSION) return { lines: [], repaired: true }` — a
  v2 envelope is discarded whole and rewritten as v1 empty. **The reader still matches its
  documentation exactly**: the `apps/storefront/CLAUDE.md` paragraph and the `constants.ts:10`
  comment ("A v2 adds a migration here, never a silent reset") both describe this behaviour, and
  `cart-storage.test.ts:50` pins it. The cost — a rollback after a v2 ships empties every v2
  shopper's bag — is documented and accepted, not a defect. When v2 is authored, add the
  migration branch in `parseCart` and ship the reader one release before the writer, as the doc
  already instructs. `proven-on: code reading only`.
- **CC-57 — L9's premise dismissed.** See CC-23: there is no media guard on the rule, therefore no
  touch fallback row exists and the lead assumed a state the code does not contain. A *different*
  real defect was found in the same area instead — MED-5, the wrapper's dead zone.

---

## L1–L11 disposition

Each pre-identified lead appears exactly once. A lead that quietly vanished would be a hole in
the audit.

| # | Lead | Disposition | Where |
| --- | --- | --- | --- |
| **L1** | `updateProduct` overwrites `products.stock` absolutely with no `stock_adjustments` row | **CONFIRMED, and worse than filed.** `stock` is a *required* field on `PUT /api/v1/products/:id`, so no edit can avoid asserting an absolute stock. Proven live: a unit sold between form-load and save was silently restored (29 → 30) with zero audit rows; the same PUT also wiped `barcode` and `distributor_id`. | **HIGH-3** |
| **L2** | `products.stock` is never decremented for a variant product, yet `Inventory.tsx` shows it as the Stock column and the form writes it | **CONFIRMED.** After one variant sale: `products.stock` 6, `SUM(variants.stock)` 5, per-size sellable 3/0/2. The dashboard column and the low-stock badge both render 6, and `stock: 99` from the form changed nothing a shopper can see. | **HIGH-4** |
| **L3** | `moon-selection.tsx` renders the `curatedEdit` mock unconditionally and `fromHomeMock` gives each tile a real href, two of which 404 | **CONFIRMED, and worse than documented — five 404s, not two.** Three of the five dead links are on the unconditional Moon Selection, so they ship in every build. | **HIGH-1** |
| **L4** | `NewArrivals` falls back to mocks when fewer than four *photographed* products are returned | **CONFIRMED.** A seeded database has `product_images = 0`, so the rail is always the mock; the homepage is prerendered, so the choice freezes at `next build`. Invented names and prices render with no mock marker; `long-wool-cardigan` reads 2,750 against the catalogue's 2,400. | **MED-3** (and the two link 404s it contributes are in HIGH-1) |
| **L5** | The quote's `no-store` survives only because its route is registered before `publicCacheOnSuccess` — does a test pin the ordering itself? | **CONFIRMED AS SUSPECTED.** The `no-store` outcome is correct and live-verified on 200/400/413/404, but **all eight assertions are on the resulting header; nothing pins the registration order.** A reorder would ship priced quotes as `public, max-age=60` with no type error and no failing test. Recommended: a `router.stack` index assertion. | **CC-5** (with MED-2 as a live instance of the same class) |
| **L6** | `createCatalogLimiter`'s `skip: isCartQuotePath` — the §18 quote-skip suspicion | **DISMISSED — proven correct live, end to end.** The skip is deliberate: the quote is charged once, by its own app-level limiter matching on path alone, so GET/HEAD/OPTIONS/POST are all charged there and must not also spend a catalog read. Valid token → 20000 on catalog, 300 on the quote (earning nothing); wrong or duplicated token → 300; the two series count down independently. | **CC-6 / CC-55** |
| **L7** | `VariantManagerDialog.tsx:142` and `POS.tsx:195` use `\|\|` rather than `??` | **CONFIRMED AS LATENT ONLY.** The server refuses `price: 0` and `price: -5` on both variant create and update (`.positive()`), so the branch is unreachable through the API. But `product_variants.price` carries **no CHECK constraint** — a 0 is representable and could arrive from an import, a backfill or a restored dump, at which point POS would charge the product price while the catalog honoured 0. | **LOW-1** |
| **L8** | No test for `VariantManagerDialog`, `useVariantManagement`, or `Categories` | **CONFIRMED,** with the specific unguarded behaviours enumerated — including the blank-price → `null` seam the entire effective-price contract rests on. | **LOW-2** |
| **L9** | The Quick Add disc is grid-placed by `[data-card-action='overlay']`; at touch widths the rule does not apply and the action falls to its own row | **PREMISE FALSE — DISMISSED.** The rule carries no `@media (hover: hover)`, no `(pointer: fine)` and no `min-width`, so the disc is overlaid at *every* width and pointer type; there is no touch fallback row to test. The panel is also not clipped by the photograph. **A different, real defect was found in the same area instead:** the wrapper div re-creates the dead zone the inner root was written to avoid. | **CC-23 / CC-57 — and MED-5** |
| **L10** | `cart-storage.ts` resets the bag on any `version` other than 1 | **DISMISSED.** The reader still matches its documentation exactly, the cost is documented and accepted, and `cart-storage.test.ts:50` pins it. | **CC-56** |
| **L11** | All 8 seeded variants have `price IS NULL`, so the seed cannot exercise the explicit override | **CONFIRMED, AND ACTED ON.** Confirmed at the wire (a blank price sends `price: null`, is accepted, stores NULL) and at the data layer (0 of 8 variants priced; also 0 `product_images`, 0 `image_url`, no `inactive` product). U6 authored the missing fixture — `cashmere-pullover` variant S = 2750 via `PUT /api/v1/products/4/variants/4` — which is the only explicit override in the database and is what made R14's override case and Scenario E possible at all. | **LOW-3**, fixture in *Repository state*; U6 authored it |

---

## Test gaps

### The headline gap: there is no storefront E2E at all

`e2e/playwright.config.ts` starts **only the API and the Vite dashboard — no Next process** —
and `e2e/specs/` is thirteen POS/dashboard specs. Nothing in CI ever loads a storefront page.
Every drawer focus rule, RTL layout, toast, reconciliation state and hydration behaviour
documented in `apps/storefront/CLAUDE.md` is verified by **pure-function unit tests and owner
screenshots only**. The §22 journey is never re-run by anything.

The compensation is Appendix A: a 120-row owner-run matrix across 11 passes, ≈2 h 40 m. It is a
manual pass, not coverage — a row that passes today proves nothing about tomorrow's commit. The
natural follow-on is a storefront Playwright project alongside `pos-parallel` and `pos-settings`,
scoped in its own plan.

Two corollaries make the gap wider than it looks:

- **The storefront has zero component tests** (MED-7). `find apps/storefront -name '*.test.tsx'`
  returns nothing. The three commits on this branch that rewrote Quick Add changed behaviour no
  suite can regression-check.
- **`check:client-paths` gates the dashboard's API calls only.** A storefront call to a route the
  server stopped serving would ship green through typecheck, lint, test and `next build` alike.

### Dashboard (L8 and its neighbours)

1. **No `VariantManagerDialog.test.tsx`, no `useVariantManagement.test.ts`** — the blank-price →
   `price: null` seam (`useVariantManagement.ts:101`) that the entire
   `variant.price ?? product.price` contract rests on is pinned by no dashboard test. Also
   unguarded: the silent `Number(stock) || 0` coercion (MED-12), the `||` vs `??` display bug
   (LOW-1), and attribute authoring including duplicate-key behaviour.
2. **No `Categories.test.tsx` at all**, though category slugs drive storefront category URLs —
   `Bundles`, `Collections`, `Inventory` and `StockCount` each have one.
3. `Collections.test.tsx` is a known flake (issue #169).

### Server

4. **No route-level test for an oversized upload or a disallowed extension** (HIGH-6).
   `storage.test.ts:263` asserts the multer *options object*; `productImages.test.ts:119` covers
   only the magic-byte path — the one that works. The gap maps exactly onto HIGH-5's defect.
5. **No test covers `PUT /products/:id` omitting `cost_price` / `min_stock` / `barcode`**, so
   MED-11's silent default-substitution is unguarded in both directions.
6. **`uploadRateLimit` has no test** asserting its ceiling or its key, so MED-10's IP-vs-user
   divergence from the documented bucketing rationale has nothing watching it.
7. **No test pins the quote's route registration order** (CC-5 / L5) — only the resulting header.
8. **No test covers any non-POST method's cache header on the quote path** (LOW-4), so MED-2 can
   regress silently after a fix.
9. **No single test asserts the two effective-price implementations against each other.** Each
   side has a named real-PG guard, but nothing proves POS's SQL `COALESCE` and the catalog's `??`
   agree on one fixture. This audit proved it live once; nothing re-proves it per commit.
   Recommended: one real-PG test that sells a variant through POS and quotes the same variant
   through the catalog, asserting identical unit prices.
10. **No live fixture exists for the barcode-lookup price surface** — every seeded
    `product_variants.barcode` is NULL, so that surface is confirmed by code reading only.
    Recommended: seed at least one variant barcode.
11. **The seed cannot reach three paths at all** (LOW-3): no `inactive` product, no explicitly
    priced variant, no `product_images` rows.

### Storefront

12. **Cross-tab `storage` sync is entirely unguarded** (MED-9) — including the
    subscribe/unsubscribe lifecycle where a listener leak would live.
13. **The quote response guard has no arithmetic assertions** (MED-8), so a per-line or subtotal
    invariant regression would render rather than fail.
14. **Nothing relates a homepage mock slug to the catalogue** (HIGH-1). `home-products.test.ts`
    asserts shape only; the five 404s have been invisible to CI since the mocks were written.
15. **`drawer-close-focus.test.ts` pins the *decision*, not the DOM effect** — the
    double-microtask ordering in `AfterTrapUnmount` is untested.
16. **The editorial asset guard is the only thing standing between the slot system and an ad-hoc
    asset — and it is currently red** (MED-1).

### Behaviours only a manual pass covered

Every item in *Manual QA gaps* below is, by definition, a test gap as well: the focus trap, page
inerting, Escape/backdrop, focus restore, browser Back, real `localStorage` including private
mode, `aria-busy` staleness presentation, the 300 ms quantity debounce, the remove fade and its
reduced-motion branch, RTL rendering, 200 % zoom, throttled-network states, and the
production-build `/checkout` 404. None of these has any automated evidence in the repository.

---

## Manual QA gaps

Browser-only behaviours that no automated evidence in this audit could settle. Each is
`proven-on: code reading only` unless stated. They are specified as runnable rows in Appendix A;
until that pass is run they must **not** be read as passing.

| # | Behaviour | Why no automated evidence exists | Matrix rows |
| --- | --- | --- | --- |
| Q1 | **Drawer focus trap and page inerting.** `bag-drawer.tsx:95-106` manually inerts `.skip-link`, `#main-content` and the footer because Headless UI inerts only `header`. Whether the page behind is truly unreachable by Shift+Tab and by a screen reader, and whether inert is released correctly on close. | DOM-only; the storefront has no DOM harness and no E2E. | 85, 86 |
| Q2 | **Focus restore on dismissal vs navigation.** `AfterTrapUnmount` (`bag-drawer.tsx:45-61,108-117`) queues a microtask inside a microtask so it runs after Headless UI's restore. Only the *decision* function is tested (`drawer-close-focus.test.ts`, 4 tests); the ordering is not. | Timing-dependent DOM behaviour. | 26, 82, 83, 90 |
| Q3 | **Escape and backdrop close**, and that the toaster stays operable outside the trap. | DOM-only. | 26, 37, 38, 89 |
| Q4 | **Browser Back with the drawer open**, and the pathname-change close (`bag-drawer.tsx:119-125`). **Not gradeable from source** — the drawer is not a history entry, so the correct behaviour is whatever the owner accepts. Record it, do not grade it. | No spec exists to grade against. | 116, 117 |
| Q5 | **Cross-tab `storage` events** — see MED-9. Entirely unguarded in code *and* unobserved here. | Needs two real tabs. | (add a second tab to any pass) |
| Q6 | **Real `localStorage` round-trips, including private mode** where the accessor throws, and the quota path. The in-memory fallback is unit-tested with an injected storage; the real browser accessor is not. | Needs a real browser storage partition. | 24, 108 |
| Q7 | **`aria-busy` and stale presentation.** That the previous subtotal visibly stays, dimmed, with the visually hidden "Updating", rather than blanking or being presented as final (`cart-line.tsx:60-92`, `bag-drawer.tsx:230-235`). | Rendering and ARIA state. | 23, 102, 103, 104 |
| Q8 | **The 300 ms quantity debounce** coalescing real stepper presses. | Timing in a real event loop. | 104 |
| Q9 | **Remove fade and focus hand-off** (`REMOVE_FADE_MS`, and the `prefers-reduced-motion` branch at `use-bag-controller.ts:225-228`). | DOM + media query. | 29, 88, 98 |
| Q10 | **EN/AR and RTL rendering of both bag surfaces**, including the drawer's `rtl:data-closed:-translate-x-full` and the disc's mirroring. Static HTML was verified (CC-16, CC-23); *painted* RTL was not. | Requires a rendering engine. | 49–52, 65–78 |
| Q11 | **`/checkout` 404 in a production build with `NEXT_PUBLIC_CHECKOUT_ENABLED` unset.** The audit stack's `.env.local` sets it to `true`, so this leg could not be shown. Reasoned only: `resolveCheckoutEnabled(nodeEnv, flag)` returns `nodeEnv !== 'production'` when the flag is absent, and `app/[locale]/checkout/page.tsx` calls `notFound()` on `!CHECKOUT_ENABLED` in both `generateMetadata` and the page; `checkout-availability.test.ts` (3 tests) pins the resolver, but the 404 itself is unproven. | The audit stack could not turn the flag off without disrupting other units. | — (needs a separate `next build` with the flag unset) |
| Q12 | **MED-5's dead zone.** One click in the lower band of a card photograph settles it in either direction. | CSS hit-testing cannot be proven by reading. | 44, 46, 52 |
| Q13 | **MED-6's rail clipping.** Latent until MED-3 is fixed, since the rail currently renders the mock fallback and emits no Quick Add at all. | Needs ≥4 photographed products. | — (re-test after MED-3) |
| Q14 | **The painted 404 body** (LOW-6): whether the localized not-found actually paints after hydration. | The SSR'd HTML is empty by design; only a browser shows the painted result. | 15, plus `/en/products/nope-x` |
| Q15 | **The catalog error screen after hydration** (U3): no legitimate upstream failure could be induced without stopping the API, which was out of bounds for that unit. `apps/storefront/CLAUDE.md` records this as still open. | Requires the API down. | 109, 110 |
| Q16 | **200 % zoom, reduced motion, throttled network, console and hydration errors, horizontal overflow at 320.** None is reachable by any unit test in this repository. | Browser-only conditions. | 53, 66, 91–105, 113–115 |
| Q17 | **HIGH-2 under a production build.** The single most important re-run: `next build && next start`, then repeat the Scenario C probe. | The audit's storefront ran `next dev` for the propagation unit. | — |

**Every unrun Appendix A row belongs here.** The matrix has 120 rows; none was run by the agent
(AD-7). A row left unrun is recorded as *not run*, never as passing.

---

## Nine verdicts (R26)

Each cites a specific test, probe or code path. None is a general impression.

### 1. Storefront Shop — **Issues found**

Every listing state, URL-grammar fallback, metadata rule and locale render is correct
(CC-13/14/15/16): `kimonos` with zero products is a 200 empty state and not a 404, unknown slugs
and upcoming/archived collections are real 404s with the shared body, `?page=0`/`9999`/`min=37`/
`min=900&max=100`/`sort=nonsense` all fall back without a single 500, Eastern-Arabic digits
normalize, and `noindex, follow` lands on exactly the refined URLs. Two defects sit against that:
**MED-4**, where `search-params.ts:150`'s `firstValidValues` and `catalog-controls.tsx:114`'s
direct `useQueryStates` disagree on a repeated key — proven by `?sort=best&sort=price-asc` sorting
the grid while rendering `<option value="newest" selected="">`, with the next control commit
discarding the filter — and **LOW-5**, where the next-intl proxy trims `/en/shop/%20` into a
soft-200 at a child URL. Neither is reachable without a hand-written URL, so the surface is sound
for ordinary traffic.

### 2. Product Detail — **Issues found**

The page itself is correct: PD-3 holds on the wire (no variant id in any DTO, CC-10), the
listing and detail DTOs are byte-identical across all 33 active products (CC-18), effective price
is `variant.price ?? product.price` with a NULL never becoming `0` and no surface rendering
`0 EGP` (CC-1, CC-19, CC-51), sold-out and unavailable-option states are conveyed with `sr-only`
text rather than colour (CC-20), image degradation holds at zero, one and eight images (CC-21),
and a transient API failure can never become a 404 because `get-catalog-product.ts:112-115` maps
only `NOT_FOUND` and `VALIDATION_ERROR` to `null` (CC-22). The verdict is Issues-found on one
count: **HIGH-2** — a withdrawn product's PDP served 74 consecutive 200s over 28 minutes with
zero non-200s and never healed, because Next writes the fetch data cache only on `res.status ===
200` (`patch-fetch.js:696`). **LOW-6** (an empty unlocalized 404 body before hydration) is the
minor second item.

### 3. ProductCard / Quick Add — **Issues found**

The architectural question R3 asks is answered cleanly: **one store, one readiness function, one
price function, one line key** — `cart-store.ts:293` is the only `createCartStore()`,
`purchaseReadiness` is called from exactly two call sites, and both surfaces write through the
same `addToBagIntent` → `actions.add`, so the same product+options merges in place (CC-17, pinned
by named cases in `variant-selection.test.ts`, `cart-lines.test.ts` and `add-to-bag-action.test.ts`).
**There is no second cart.** The issues are presentational and structural: **MED-5** (the
`[data-card-action='overlay']` wrapper is `pointer-events: auto` with a ~68px border box above
the card link's overlay, re-creating the dead zone `quick-add.tsx:210` was written to avoid),
**MED-6** (the panel will be clipped by `[data-rail]`'s `overflow-x: auto` once the rail carries
real DTOs), and **MED-7** (zero component tests, so the three commits that rewrote this control
changed behaviour nothing can regression-check). L9 is dismissed — the CSS carries no pointer
guard at all (CC-23).

### 4. Cart quote backend — **Ready, with one non-blocking defect**

The strongest surface in the audit. Live-proven at the HTTP boundary (AD-6) on real PostgreSQL:
`.strict()` rejects `price`, `unitPrice` and `total` and the server's price does not move
(CC-7, CC-40); bounds are exact at every edge with no off-by-one (CC-8); a 20 KB body is a
pre-parse 413 and malformed JSON a 400, both `no-store`, never a 500 (CC-9); column allowlists
hold across eight responses with **zero** matches for `id|sku|barcode|stock|cost_price|
product_id|variant_id|min_stock` (CC-10); an unknown slug and a discontinued product return
byte-identical lines so the quote is no existence oracle (CC-4); per-line caps are independent
and never disclose stock above 10 (CC-3); and L6 is dismissed with a full live limiter matrix
(CC-6). The one defect is **MED-2** — OPTIONS with no or a foreign Origin falls through to
Express's auto-responder *below* `publicCacheOnSuccess` and ships `public, max-age=60` on the
pricing endpoint's URL. Inert today; it must be fixed before any CDN. **CC-5** records the
adjacent structural exposure: the `no-store` invariant lives entirely in file order and no test
pins it.

### 5. Bag drawer — **Issues found (none blocking); the browser half is unproven**

The state machine is right. Reconciliation joins by line key, never position
(`reconcile.ts:288-292`); a `reduced` line displays the allowed quantity while the **stored**
quantity is untouched until the shopper acts, with both stepper buttons forced enabled
(`bag-view-model.ts:91-93`, pinned at `bag-view-model.test.ts:205` and `reconcile.test.ts:269`);
the only store write is the canonical rewrite, gated so an empty-options `variantUnavailable` can
never wipe stored options, and proven a fixed point twice (CC-26, CC-27); the header badge is the
local sum of stored quantities and imports nothing from the quote (CC-28); and the drawer
correctly carries **no** checkout entry, only the reserved slot. Issues: **MED-8** (the response
guard checks shape but not arithmetic, so the CLAUDE.md sentence "a wrong price must fail, not
render" overstates it), **MED-9** (cross-tab sync unguarded), **LOW-7/8/9/10**. Crucially, the
entire browser half of R9 — focus trap, page inerting, Escape, backdrop, focus restore, browser
Back — is `proven-on: code reading only` and sits in *Manual QA gaps* Q1–Q4.

### 6. Bag page — **Issues found (none blocking); the browser half is unproven**

R5 is proven at the code level and confirmed by the live 400: the browser holds **intent only**,
and `serializeCart` (`cart-storage.ts:29-39`) is a projection that cannot carry a price, name,
image, stock or SKU because `CartLine` has nowhere to put one (CC-24). Every hostile storage
value — malformed JSON, `version: 2`, `quantity: "2"`, six options, `__proto__`, 31 lines,
duplicate keys, a throwing accessor — has a named test (CC-25). The subtotal always comes from
the quote; the client never sums (CC-28). The checkout gate blocks on unavailable and limited
lines with separate counts, opens only when clean, is a focusable `aria-disabled` button rather
than a `Link` when blocked, and preserves locale (CC-30). Issues: **LOW-8** (a persistently
failing quote hides every row, so Remove is unreachable) and the same MED-8/MED-9. The
production-build `/checkout` 404 with the flag unset (Q11) and the `aria-busy` staleness
presentation (Q7) are both unproven here.

### 7. Dashboard catalog management — **Issues found**

Authoring is broadly correct and was probed live end to end: full-field create round-trips every
storefront field; slug collisions are 409 `SLUG_TAKEN` shown inline and malformed slugs are 400s;
`price: 0`, `price: -10` and `stock: -1` are all refused; clear-vs-keep works in all three cases
(omit keeps, `null` clears, `""` clears); the gallery caps at 8 with a 409 `GALLERY_FULL`,
reorder commits a dense permutation and refuses a mismatched set with 400 `IMAGE_SET_MISMATCH`
without changing the order, and deletion leaves zero orphans and zero duplicate positions;
`status` and collection membership are correctly off the product form and both separate paths
work, including optimistic concurrency's 409 `COLLECTION_MODIFIED` (CC-31 to CC-35). Against
that: **HIGH-5** (an oversized or `.gif` upload is a 500, not the documented 400 — the single
most likely operator action answers "Internal server error"), **HIGH-6** (the test gap that lets
it ship), **MED-10** (10 uploads per 15 minutes, IP-keyed, against a 9-upload product gallery),
**MED-11** (an omitted `cost_price` is silently reset to 0), **MED-12** (no client validation on
the variant dialog; `Number(stock) || 0` silently discards a stock entry), and **LOW-2** (L8: no
tests for the variant dialog, its hook, or Categories).

### 8. Database consistency — **Ready**

The only unqualified Ready in this list. `verify:migrations` passes for all 17 with every
`.down.sql` reversing its `.sql` and a clean re-apply round-trip (CC-41). Introspection confirms
the commerce contract: `products.price` NOT NULL and `product_variants.price` nullable — the
override seam (CC-42); both stock columns NOT NULL with non-negative CHECKs still correctly
`NOT VALID` (CC-43); three unique slug indexes, `product_images` unique on
`(product_id, position)`, `collection_products` unique on `(collection_id, position)`, and 017's
`idx_collection_products_product_id` present (CC-42, CC-45). Every constraint and cascade was
exercised in rolled-back transactions: duplicate slugs and positions raise 23505, deleting a
product cascades to variants, gallery rows and memberships with no orphans, and deleting a
category sets `products.category_id` NULL without deleting a single product (CC-44). Two
qualifications, neither a schema defect: **LOW-11** (no database-level slug-pattern CHECK — the
application is the only guard, exactly as `apps/server/CLAUDE.md` documents) and **LOW-3** (the
seed's three coverage gaps). 017's *value* is neither confirmed nor refuted at 21 rows (CC-45).

### 9. Cross-app contracts — **Issues found**

Five of six scenarios behave exactly as contracted, with the shopper told every time.
**A** — the next quote returns the new price in ≤5 s, "Price updated" fires once per session via
`issueMarkKey`, and checkout is not blocked by a price change alone (CC-47). **B** — the quote
echoes the requested quantity back alongside what it will sell, and the stored intent is
untouched (CC-48). **D** — **no substitution**: the removed line keeps its index and
`requestedQuantity`, loses its price and options, and the surviving sibling line is undisturbed
(CC-50). **E** — every surface falls back to the base price and `grep -oE '(^|[^0-9,])0 EGP'`
over the rendered PDP returns **0 matches**, in both locales (CC-51). **F** — the gallery and the
card's hover image both update, and correctly no notice fires (CC-52). Collection membership and
category reassignment both propagate cleanly, moving out of one page and into another in the same
render (CC-53). The propagation budget is settled and usable: **charged correctly within 5
seconds, displayed correctly within ~90 seconds — "60 seconds plus one more page view"**, of
which the API's `max-age=60` contributed exactly zero here but will stack to ~120–135 s behind a
CDN (CC-46). **Scenario C is the failure**: HIGH-2, with MED-16 (no on-demand invalidation
anywhere in `apps/storefront`) as the missing lever that would fix it.

---

## What the audit could NOT prove

**pg-mem-only, therefore not evidence (AD-5).** Nothing in this report rests on a pg-mem green
for a price or stock claim — every such claim was re-run with `TEST_DATABASE_URL` set or against
the live `moon_store_audit`. MED-15 is the inverse case and worth noting: the spurious
`price_history` rows are invisible on pg-mem, because there the NUMERIC comparison is
number-vs-number and behaves correctly. Any suite that only ever ran on pg-mem would have
reported that code as fine.

**Blocked by the environment or by scope.**

- **HIGH-2 under a production build.** The single most consequential unproven item. The route has
  no `generateStaticParams`, so which `patch-fetch` branch it takes under `next build && next
  start` is not decidable from a dev run. **Re-run this before settling the severity.**
- **The `inactive` publication leg.** The seed authors no `inactive` product (LOW-3), so
  unknown-vs-inactive-vs-discontinued was proven live two ways of three; the third takes the same
  `p.status = 'active'` predicate and is `proven-on: code reading`.
- **The quote's 429 and 503 cache headers.** 429 would require burning the 300/15 min bucket the
  other audit units shared; 503 would require forcing a 2000 ms statement timeout against a
  database this unit must not mutate. Both are proven by code reading only
  (`rateLimits.ts:286-288`; `service.ts:44-62` catching SQLSTATE `57014` and raising a
  `PublicError` through the same error handler, with `noStore` already set).
- **The barcode-lookup price surface.** Every seeded `product_variants.barcode` is NULL, so there
  is no variant barcode to scan; confirmed by code reading only.
- **The production-build `/checkout` 404** with `NEXT_PUBLIC_CHECKOUT_ENABLED` unset (Q11).
- **The catalog error screen after hydration** — no legitimate upstream failure could be induced
  without stopping the API, which was out of bounds for the unit that owned it (Q15).
- **017's index value.** Present and correct, but 21 `collection_products` rows is far too small
  a dataset to confirm or refute it (CC-45).
- **MED-6's clipping.** Latent: the rail currently renders the mock fallback and emits no Quick
  Add at all, so it becomes observable only after MED-3 is fixed.
- **Everything in *Manual QA gaps* Q1–Q17**, and every one of Appendix A's 120 rows. The agent
  did not drive a browser (AD-7). **Not run is not passed.**

**Out of scope by the plan.** Payment gateway, IPN/webhooks, order creation, COD strategy,
shipping fees, tax engine, customer accounts, wishlist, search; checkout beyond the gate smoke;
performance and load; WCAG conformance beyond what the journey touches.

---

## Recommended fix sequence

Ordered by the blocking column, then by whether one fix closes several findings.

### Tier 0 — before anything else (a decision, not a fix)

0. **Decide on the `apps/storefront/AGENTS.md` `## Learnings` deletion.** Two 2026-09-21 entries
   about the exact CSS this branch rewrote. `git checkout -- apps/storefront/AGENTS.md` restores
   them. Continuing on this branch will commit or discard it either way.

### Tier 1 — blocking (`blocks: yes`)

1. **MED-1 — unbreak the storefront CI gate.** Smallest change, and nothing else can merge
   cleanly until it lands: rename `silk-edit-campaign.png` to `.jpg` and declare the slot, or
   give `checkEditorialAssets` an explicit named exception.
2. **HIGH-1 — stop the homepage publishing five dead product links.** Drop the hrefs from
   `home-products.ts` / `fromHomeMock`. Fastest correct fix, and it removes the defect class
   rather than the instances.
3. **HIGH-2 — re-run Scenario C against `next build && next start` first**, then fix. If the
   production build also serves a stale purchasable 200, this is the highest-priority code change
   in the report. The fix is shared with MED-16: tag the catalog fetches and add a token-guarded
   revalidation route the server pings on a status write. **One change closes HIGH-2 and MED-16
   together.**

### Tier 2 — before an operator is given the dashboard in production

4. **HIGH-3 + HIGH-4 together** — they are one problem seen from two ends. Make `stock` optional
   on `PUT /products/:id` with absent-keeps-stored for `stock`, `barcode`, `distributor_id` and
   `min_stock`; route intentional stock changes through `applyDelta`; add `expected_updated_at`;
   and make the dashboard Stock column and the low-stock badge read
   `has_variants ? variant_stock : stock` (POS.tsx:204 already does), hiding the Stock field for
   variant products. **This also fixes MED-11**, which is the same absent-field defect on
   `cost_price` and `min_stock`.
5. **HIGH-5 + HIGH-6 together** — map `MulterError LIMIT_FILE_SIZE` and the `fileFilter` Error to
   400 in the same commit that adds the two route-level tests. Add **MED-10**'s user-keyed
   limiter with a ceiling above 9 while in the same file; the three are one operator-path
   workstream.
6. **MED-3 — separate "the API answered" from "the products are photographed"** in New Arrivals.
   It shares HIGH-1's root data, so sequence it right after. Note it also makes **MED-6** live,
   so fix the panel's clipping in the same change.

### Tier 3 — correctness and second lines of defence

7. **MED-2 + CC-5's recommendation** — attach `noStore` to the quote *path* rather than the
   method, and add the `router.stack` index assertion plus **LOW-4**'s OPTIONS test in the same
   commit. One change, three items closed.
8. **MED-15** — coerce both sides of the `price_history` comparison. Two-line fix; makes the
   table trustworthy again.
9. **MED-13 + MED-14** — one migration adding `variant_id` to `stock_adjustments`, plus the
   service branch. They are the same defect.
10. **MED-5 and MED-4** — the dead-zone wrapper (confirm with Appendix A rows 44/46/52 first) and
    the repeated-key divergence.
11. **MED-8, MED-12** — the quote's arithmetic invariants, and react-hook-form on the variant
    dialog with `stock` parsed rather than coerced.

### Tier 4 — coverage, which is what stops all of this recurring

12. **A storefront Playwright project** alongside `pos-parallel` and `pos-settings`, scoped in its
    own plan. This is the single highest-leverage item in the report: it is what turns Appendix A
    from a 2 h 40 m manual ritual into a gate.
13. **A jsdom component suite for `QuickAdd`** (MED-7) and **the two missing dashboard test
    files** (LOW-2).
14. **Seed coverage** (LOW-3): one `inactive` product, one explicitly priced variant, one variant
    barcode, a handful of `product_images` rows. Cheap, and it unlocks three paths that are
    currently untestable from a seeded database.
15. **One real-PG test asserting the two effective-price implementations agree on one fixture**
    (test gap 9), and **MED-9**'s cross-tab `StorageEvent` test.
16. **LOW-1** — `||` → `??` at both sites, plus `CHECK (price IS NULL OR price > 0)` on
    `product_variants`. Two characters and one constraint close a latent till-vs-storefront
    divergence permanently.

### Not recommended as fixes

**LOW-11** (no slug CHECK) and **CC-56 / L10** (the v2 bag reset) are documented, argued
decisions that match their contracts. **LOW-13** (suite flakiness under contention) is a local
artifact with no code fix. **CC-39**'s parallel price implementations are guarded by named
real-PG tests and should not be refactored into one — doing so would remove a guard (AD-10).

---

# Appendix A — The owner-run browser QA matrix

This is the **documented compensation for the absent storefront E2E**. Nothing in it is re-run
by CI. Per AD-7 the agent did not drive a browser; every expected value below was derived from
the live API and the source on 2026-09-22. **120 rows, 11 passes, ≈2 h 40 m.** Any row left
unrun goes into *Manual QA gaps* with its reason — never assumed passed.

## How to run this

**Prerequisite stack (already running — do not reprovision):**

| Piece | State |
| --- | --- |
| API | `http://localhost:3001`, `tsx watch index.ts` in `apps/server`, `DATABASE_URL` → **`moon_store_audit`**, `MEDIA_LOCAL_ROOT=C:\Users\opggh\.claude\jobs\711044f5\tmp\audit-media` |
| Storefront | `http://localhost:3000`, `next dev` in `apps/storefront`, `.env.local` with `NEXT_PUBLIC_API_URL`, `CATALOG_SERVER_TOKEN`, `MEDIA_ORIGIN`, `NEXT_PUBLIC_CHECKOUT_ENABLED=true` |
| Database | `moon_store_audit` — 35 active-listing products, 12 categories, 3 live collections, 10 uploaded images |

**Never point this at `moon_store` or `moon_store_sf_smoke`.** `MEDIA_LOCAL_ROOT` must stay on
the scratch path above, or the API's orphan-media sweep deletes tracked `apps/server/uploads`
images (#170).

- **Browser:** Chrome, DevTools open on the **Console** tab for the whole run (Pass K reads it).
- **Widths:** set with the DevTools device toolbar (Ctrl+Shift+M), responsive mode, exact px.
- **Between passes:** clear the bag via DevTools → Application → Local Storage →
  `http://localhost:3000` → delete key `moon-fashion-cart`, then reload. Rows say when to.
- **Dev-mode caveat:** this is `next dev`, so React logs extra warnings and hydration diffs are
  verbose. "No console error" means no *error*-level entry; Fast Refresh and `<link rel=preload>`
  notices are not failures.
- **Dashboard login** (only if a row asks you to change data — none here do):
  `admin@moon.com` / `admin123`.
- **Screenshot naming:** `U10-<row#>-<short>.png`. Only rows marked **Y** need one.
- **Timing:** Passes A–C ≈ 45 min, D ≈ 40 min, E ≈ 25 min, F–K ≈ 50 min. A, B, C and F–K are
  single-pass; D and E are the repeats.

**Reference fixtures** (verified against the API on 2026-09-22):

| Slug | Price | Options | Notes |
| --- | --- | --- | --- |
| `silk-midi-dress` | 2,850 EGP | size S/M/L | **S and L sold out, M in stock ×3** — 1 image |
| `cashmere-pullover` | base 3,200, S overridden **2,750** | size S/M/L | card reads **"From 2,750 EGP"**; S ×4, M sold out, L ×2; no image |
| `embroidered-evening-gown` | 4,500 EGP | none | **2 images** — the hover-swap fixture |
| `satin-off-shoulder-blouse` | 1,550 EGP | none | **no image** — placeholder fixture |
| `silk-slip-dress` | 6,750 EGP | size S/M | **entirely sold out** |
| `cotton-bandana` | 180 EGP | none | cheapest piece |

Counts: `/en/shop` = **35 pieces, 24 per page, 2 pages**; `inStock` only = **29**;
`priceMin=1000&priceMax=2000` = **11**; `/shop/dresses` = **4**; `/new-in` = **16**;
`/collections` = 3 (Evening 6, Linen 5, Silk 2).

## Pass A — Full journey, `/en`, 1440 px (single pass)

| # | URL | Width | Locale | Action | Expected | Shot? | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/en/shop` | 1440 | en | Load with an empty bag | `h1` "Shop", context line "All pieces", count "35 pieces", 24 cards, category row with "All" + 12 names, pagination "Page 1 of 2". Header Bag link shows **no** badge. | Y | |
| 2 | `/en/shop` | 1440 | en | Look at the `satin-off-shoulder-blouse` card | Frame is a 4:5 sand rectangle with the no-photograph placeholder, 12px corners, name + 1,550 EGP on one baseline, two lines of description, **an ivory 44px bag disc at the photograph's bottom-left** | Y | |
| 3 | `/en/shop` | 1440 | en | Hover `embroidered-evening-gown`'s photograph | The second image swaps in, the frame scales ~1.03, the name gains a gold underline. Corners never square off. | N | |
| 4 | `/en/shop` | 1440 | en | Look at `silk-slip-dress` (page 2, or via price-desc) | "Sold out" badge in ink at the photograph's top-left, price **still shown** (6,750 EGP), photograph **not** greyed, disc still present and inert | Y | |
| 5 | `/en/shop` | 1440 | en | Sort select → "Price: low to high" | URL becomes `/en/shop?sort=price-asc`, first card is **Cotton Bandana 180 EGP**, still 35 pieces, the grid does not flash a skeleton (old grid dims, then swaps) | N | |
| 6 | `/en/shop?sort=price-asc` | 1440 | en | Ctrl+U, find `<meta name="robots">` | `noindex, follow` — a refined URL is not indexable | Y | |
| 7 | `/en/shop` | 1440 | en | Sort → "Price: high to low" | First card **Embroidered Evening Gown 4,500 EGP** | N | |
| 8 | `/en/shop` | 1440 | en | Filter → "In stock only" → "Show results" | URL carries `stock=in`, count reads **29 pieces**, `silk-slip-dress` is gone, an "Active filters" chip row appears with a Clear control | Y | |
| 9 | `/en/shop` | 1440 | en | Filter → Minimum 1000, Maximum 2000 → Show results | Count reads **11 pieces**; chip reads "1,000–2,000 EGP" | N | |
| 10 | `/en/shop` | 1440 | en | Filter → Minimum 900, Maximum 100 → Show results | No 500 and no crash: values swapped/floored to the 50-step, a valid listing renders | N | |
| 11 | `/en/shop` | 1440 | en | "Clear all" | Back to 35 pieces, URL back to `/en/shop` with no query | N | |
| 12 | `/en/shop?page=2` | 1440 | en | Load | **11 cards**, "Page 2 of 2", Next disabled/absent, canonical in source is `...?page=2`, robots **not** noindex | N | |
| 13 | `/en/shop?page=9999` | 1440 | en | Load | Empty state "This page is empty" / "This listing has fewer pages than the link expected." / "Go to page 1" — **never a 404, never a blank grid** | Y | |
| 14 | `/en/shop/kimonos` | 1440 | en | Load (a real category with 0 products) | `h1` "Kimonos", empty state "This edit is being restocked" + "Shop all pieces". **HTTP 200, not 404.** | Y | |
| 15 | `/en/shop/not-a-category` | 1440 | en | Load | The real localized 404 page (HTTP 404 in the Network tab) | N | |
| 16 | `/en/shop/dresses` | 1440 | en | Load | `h1` "Dresses", context line links back to "Shop", **4 cards** | N | |
| 17 | `/en/shop/dresses` | 1440 | en | Click the **name** of Silk Midi Dress | Navigates to `/en/products/silk-midi-dress` | N | |
| 18 | `/en/products/silk-midi-dress` | 1440 | en | Read the purchase panel | Name, **2,850 EGP**, three 44px size cells S / M / L. **S and L are dashed, struck through and keep a screen-reader "sold out"**; M is plain. Nothing is preselected. | Y | |
| 19 | same | 1440 | en | Press **Add to Bag** with no size chosen | Focus jumps to the first size radio, "Choose a size" appears in garnet under the legend with an alert icon, **and** the same text arrives as an error toast. Nothing is added; the header badge stays absent. | Y | |
| 20 | same | 1440 | en | Choose **M** | The inline prompt and the toast clear; price stays 2,850 EGP; the quantity stepper beside the button reads 1 | N | |
| 21 | same | 1440 | en | Press **+** twice, then **Add to Bag** | Stepper reads 3. Toast "Added to your bag: Silk Midi Dress (3)" with a **View bag** action. **The drawer does not open.** Stepper resets to 1. Header badge reads **3**. | Y | |
| 22 | same | 1440 | en | Click the header **Bag** link | Drawer slides in from the right, full height, ≤26rem wide, backdrop behind. Title "Bag" is focused. One row: Silk Midi Dress, 2,850 EGP, quantity 3, line total **8,550 EGP**. Subtotal **8,550 EGP**, "3 pieces". Footer has "View bag" and "Continue shopping" and **no Checkout button**. | Y | |
| 23 | drawer open | 1440 | en | Press **+** on the row | Quantity goes to 4 → the quote returns `reduced`: the row shows **"Only 3 available"**, quantity displayed as 3, line total 8,550 EGP. Both stepper buttons stay enabled. The figure dims and says "Updating" while in flight rather than blanking. | Y | |
| 24 | drawer open | 1440 | en | DevTools → Application → Local Storage → `moon-fashion-cart` | Value is exactly `{"version":1,"lines":[{"slug":"silk-midi-dress","options":{"size":"M"},"quantity":4}]}` — **no price, name, image or stock**. (The stored 4 is correct: CD-15 says a `reduced` line only changes when the shopper acts.) | Y | |
| 25 | drawer open | 1440 | en | Press **−** once | Stored quantity becomes 3, the "Only 3 available" notice clears, subtotal 8,550 EGP | N | |
| 26 | drawer open | 1440 | en | Press **Escape** | Drawer closes and **focus returns to the header Bag link** (check DevTools → Elements → `:focus`, or press Tab and see where you land) | N | |
| 27 | `/en/shop` | 1440 | en | Reopen the drawer, click **View bag** | Navigates to `/en/bag`; the drawer closes; focus lands on the main content region | N | |
| 28 | `/en/bag` | 1440 | en | Observe | 8/4 grid: rows on the left, a summary sticky under the header on the right with "Subtotal 8,550 EGP", "3 pieces", **and a Checkout button** (the drawer has none — the flow is drawer → View bag → Checkout) | Y | |
| 29 | `/en/bag` | 1440 | en | Press **Remove** on the row | The row fades over ~180 ms and unmounts, focus moves to the empty-state heading, toast "Silk Midi Dress removed from your bag" with an **Undo** action. Summary/empty state updates. | Y | |
| 30 | `/en/bag` | 1440 | en | Press **Undo** in the toast | The line comes back at the same index with quantity 3; the summary re-quotes to 8,550 EGP; the header badge returns to 3 | Y | |
| 31 | `/en/bag` | 1440 | en | Reload the page (F5) | Before hydration, a single reserved skeleton row + the summary in its final shape — **never the empty state flashing** — then the row and 8,550 EGP arrive from the quote | Y | |
| 32 | `/en/bag` | 1440 | en | Click **Checkout** | Navigates to `/en/checkout`, locale preserved, the contact/delivery form renders. Come back with browser Back — the bag is intact. | N | |

## Pass B — The same journey via Quick Add, `/en`, 1440 (single pass)

Clear `moon-fashion-cart` and reload before row 33.

| # | URL | Width | Locale | Action | Expected | Shot? | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 33 | `/en/shop` | 1440 | en | Click the bag disc on **Satin Off-Shoulder Blouse** (no options) | One piece added straight away, toast "Added to your bag: Satin Off-Shoulder Blouse" with **View bag**. **No panel opens, no page navigation.** Badge reads 1. | Y | |
| 34 | `/en/shop` | 1440 | en | Click the disc on **Silk Midi Dress** | A panel opens **below the disc**, the width of the photograph, with a hairline and the warm surface, an X at its top-right, one "Choose a size" fieldset (S/M/L, S and L struck through) and a full-width **Add to Bag**. **The grid around it does not reflow.** Focus is on the first size radio. | Y | |
| 35 | panel open | 1440 | en | Press the panel's **Add to Bag** with nothing chosen | Focus returns to the size group, garnet "Choose a size" under the legend **and** an error toast. Nothing added. | N | |
| 36 | panel open | 1440 | en | Choose **M**, press **Add to Bag** | Exactly **one** piece is added (a card never adds more than one), toast "Added to your bag: Silk Midi Dress", panel closes, focus returns to the disc. Badge reads 2. | Y | |
| 37 | `/en/shop` | 1440 | en | Open a panel, then press **Escape** | Panel closes, focus returns to the disc, the "Choose a size" toast is dismissed | N | |
| 38 | `/en/shop` | 1440 | en | Open a panel, then click the page background | Panel closes; focus is **not** forced back to the disc | N | |
| 39 | `/en/shop` | 1440 | en | Click the disc on **Silk Slip Dress** (sold out) | Nothing happens — no add, no panel, no toast. The disc is still focusable (Tab reaches it) and drawn in disabled ink; the "Sold out" badge carries the word. | Y | |
| 40 | `/en/shop` | 1440 | en | Add Silk Midi Dress M **again** from a card | It **merges** into the existing line (one row, quantity 2), not a second row — proof Quick Add and the product page write the same store | Y | |
| 41 | `/en/shop` | 1440 | en | Open the drawer | Two rows: Silk Midi Dress ×2 (2,850 each) and Satin Off-Shoulder Blouse ×1 (1,550). Subtotal **7,250 EGP**, "3 pieces". | Y | |
| 42 | `/en/products/cashmere-pullover` | 1440 | en | Compare card and page price | The card in `/en/shop` reads **"From 2,750 EGP"**; the page reads 3,200 EGP until a size is chosen, then **S → 2,750 EGP**, M/L → 3,200 EGP. **Nothing anywhere reads 0 EGP.** | Y | |

## Pass C — L9: the Quick Add disc placement (**flagged — this branch's redesign**)

A regression in any row 43–52 is attributable to the three in-scope commits (corner disc, reveal
on the photograph, anchor bag icon inside product image) and to nothing on `main`. The rule under
test is `[data-card-action='overlay']` in `apps/storefront/app/globals.css:841`, whose inner root
is `pointer-events-none`.

> **Audit note.** As read on this branch, that CSS rule carries **no `@media (hover: hover)` and
> no pointer guard** — it applies at every width, so lead L9's assumed touch-width fallback does
> not exist (CC-23). Rows 45 and 47 confirm it in the browser; record what you see verbatim.
> **Rows 44, 46 and 52 are the ones that settle MED-5** — the wrapper's inert band.

| # | URL | Width | Locale | Action | Expected | Shot? | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 43 | `/en/shop` | 1440 | en | Look at any supporting card | The disc sits **inside** the photograph, bottom-**left**, 12px in from both edges, with a soft shadow, above the badge column. It is **not** below the caption. | Y | |
| 44 | `/en/shop` | 1440 | en | Click the photograph **anywhere except the disc** — especially the lower band beside it | The product page opens. **If a ~68px band along the photograph's bottom edge does nothing, that is MED-5 confirmed — record exactly where.** | N | |
| 45 | `/en/shop` | 375 | en | Same look, DevTools device toolbar in touch mode | Record: is the disc still on the photograph, or has it dropped to its own row under the caption? Either is a valid observation; **write down which**. | Y | |
| 46 | `/en/shop` | 375 | en | Tap the photograph away from the disc | The product page opens (MED-5's touch leg) | N | |
| 47 | `/en/shop` | 375 | en | Tap the disc on **Silk Midi Dress** | The panel opens and is **fully visible** — not clipped by the photograph's rounded frame, not cut off by the card below, not causing the grid to reflow | Y | |
| 48 | `/en/shop` | 1440 | en | Open the panel on a card in the **last** grid row | The panel opens downward past the card and is **not clipped** by the grid or the page; if it would leave the viewport, the page scrolls rather than hiding it | Y | |
| 49 | `/ar/shop` | 1440 | ar | Look at any supporting card | The disc is **mirrored to the bottom-right** of the photograph; the "New"/"Sold out" badge is top-right; the photograph itself is **not** mirrored | Y | |
| 50 | `/ar/shop` | 375 | ar | Same, touch width | Disc mirrored to the right, in whichever placement row 45 recorded | Y | |
| 51 | `/ar/shop` | 1440 | ar | Open the panel on Silk Midi Dress | Panel is the photograph's width, RTL: the X sits at the **left**, legends and cells read right-to-left, unclipped | Y | |
| 52 | `/ar/shop` | 1440 | ar | Click the photograph away from the disc | The product page opens (MED-5's RTL leg — the pointer-events seam must hold in RTL too) | N | |

## Pass D — Width sweep (**repeat rows 53–64 at each of 320, 375, 768, 1024**, `/en`)

Clear the bag before each width. Record four results per row.

| # | URL | Width | Locale | Action | Expected | Shot? | Result (320 / 375 / 768 / 1024) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 53 | `/en/shop` | each | en | Load, then scroll the page fully | **No horizontal scrollbar and no horizontal overflow at any width.** Console: `document.documentElement.scrollWidth <= window.innerWidth` must be `true`. | Y (320) | |
| 54 | `/en/shop` | each | en | Read the grid | 1 column at 320/375, 2 at 768, 3 at 1024 (or whatever the layout gives — record it); no card clipped; every price and name readable, nothing truncated mid-character | Y (320) | |
| 55 | `/en/shop` | each | en | Open the Filter sheet | It opens as a panel/sheet, its controls are reachable, "Show results" is visible without the sheet scrolling off-screen | N | |
| 56 | `/en/shop` | each | en | Apply "In stock only" | 29 pieces; the active-filter chip row wraps rather than overflowing | N | |
| 57 | `/en/products/silk-midi-dress` | each | en | Load | Gallery above the panel below 1024; size cells stay ≥44px and wrap; the stepper and Add to Bag wrap onto separate lines when narrow rather than shrinking below 44px | Y (320) | |
| 58 | same | each | en | Choose M, Add to Bag | Toast is fully visible and does not cover the button it refers to | N | |
| 59 | header | each | en | Open the drawer | **Below ~26rem the drawer is full width**; at 768/1024 it is a ≤26rem panel from the right. Title "Bag" focused, close X reachable. | Y (320) | |
| 60 | drawer | each | en | Press **+** then **−** | Stepper targets are ≥44px and never overlap the Remove control | N | |
| 61 | drawer | each | en | Read the footer | Subtotal, "View bag", "Continue shopping" all visible without horizontal scroll | N | |
| 62 | `/en/bag` | each | en | Load | Below 1024 the summary is **below** the rows in one column; at 1024 it is beside them and sticky | Y (1024) | |
| 63 | `/en/bag` | each | en | Remove the line | Row fades out, toast with Undo appears, the empty state is fully visible | N | |
| 64 | `/en/shop` | each | en | DevTools console, after the whole width pass | No red error entries introduced by this width | N | |

## Pass E — Arabic / RTL (`/ar`) — repeat rows 65–78 at **1440 and 375**

| # | URL | Width | Locale | Action | Expected | Shot? | Result (1440 / 375) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 65 | `/ar/shop` | both | ar | Load | `<html dir="rtl" lang="ar">`, Tajawal type, the grid reads right-to-left, the category row starts at the right, **no English string anywhere in the chrome**, prices are Western digits with **ج.م** trailing (e.g. `2,850 ج.م`) | Y | |
| 66 | `/ar/shop` | both | ar | Check overflow | `document.documentElement.scrollWidth <= window.innerWidth` is `true`; no element pokes past the left edge | Y (375) | |
| 67 | `/ar/shop` | both | ar | Read the pagination | Previous/Next **arrows are mirrored**; page numbers read right-to-left | N | |
| 68 | `/ar/shop` | both | ar | Look at any photograph | Photographs are **never** mirrored — only layout is | N | |
| 69 | `/ar/shop` | both | ar | Sort → "السعر: من الأقل إلى الأعلى" (price low→high) | First card is Cotton Bandana at `180 ج.م`; the select is not clipped at the inline edge | N | |
| 70 | `/ar/products/silk-midi-dress` | both | ar | Load | Arabic name (فستان حرير ميدي) and Arabic description; size cells read right-to-left; S and L struck through | Y | |
| 71 | same | both | ar | Press Add to Bag with no size | Arabic "choose a size" prompt inline and as a toast; the toast enters from the correct inline edge for RTL | Y | |
| 72 | same | both | ar | Choose M, +, Add to Bag | Arabic added-toast with an Arabic **View bag** action; badge shows the count | N | |
| 73 | header | both | ar | Open the drawer | **The drawer enters from the left** (inline end in RTL), backdrop behind, title Arabic, close X at the correct inline corner | Y | |
| 74 | drawer | both | ar | Press + past stock (4 of Silk Midi Dress M) | Arabic "Only 3 available" notice; numerals Western; the notice does not overlap the price | Y | |
| 75 | drawer | both | ar | Press Escape | Closes, focus back on the header Bag link | N | |
| 76 | `/ar/bag` | both | ar | Load | Arabic headings, summary on the **left** at 1024+, Checkout button present, subtotal `8,550 ج.م` shaped correctly | Y | |
| 77 | `/ar/bag` | both | ar | Remove, then Undo | Arabic removal toast with an Arabic Undo; the line returns | N | |
| 78 | `/ar/bag` | both | ar | Click Checkout | `/ar/checkout` — **the locale prefix survives**; the form is Arabic and RTL | Y | |

## Pass F — Keyboard only, 1440, `/en` (single pass; do not touch the mouse)

| # | URL | Width | Locale | Action | Expected | Shot? | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 79 | `/en/shop` | 1440 | en | Tab from the top of the page | Every stop shows a visible focus ring. Within one card the **name is reached before the disc** (DOM order is unchanged by the CSS grid placement). | Y | |
| 80 | `/en/shop` | 1440 | en | Tab to Silk Midi Dress's disc, press Enter | Panel opens and focus lands on the **first size radio** without any further key press | Y | |
| 81 | panel open | 1440 | en | Arrow-key through the radios, Space/Enter to pick M | Roving arrow keys move between S/M/L; the chosen cell shows an inset rule, not colour alone | N | |
| 82 | panel open | 1440 | en | Tab to the panel's Add to Bag, Enter | One piece added; panel closes; **focus returns to the disc** | Y | |
| 83 | panel open (reopen) | 1440 | en | Press Escape | Panel closes, **focus returns to the disc** | N | |
| 84 | `/en/shop` | 1440 | en | Tab to the header Bag link, Enter | The drawer opens and focus moves into it (the "Bag" title) | Y | |
| 85 | drawer open | 1440 | en | Tab repeatedly, ~15 stops | **Focus never leaves the drawer** — it cycles through close X, line name, stepper −/+, Remove, View bag, Continue shopping and back to the title | Y | |
| 86 | drawer open | 1440 | en | Try to reach anything behind the drawer with Tab / Shift+Tab | Impossible — the page behind is inert. Confirm in DevTools → Elements that the backdrop/parent carries `inert` or `aria-hidden`. | Y | |
| 87 | drawer open | 1440 | en | Tab to **+**, press Enter/Space twice | Quantity changes, the announcement region updates; the button stays focused | N | |
| 88 | drawer open | 1440 | en | Tab to **Remove**, press Enter | The row goes; **focus moves to the next row's name link**, or the previous row, or the empty-state heading if it was the last | Y | |
| 89 | drawer/toast | 1440 | en | After Remove, Tab to the toast's **Undo** and press Enter | The line is restored at its old position; the toast is reachable by keyboard while the drawer is open (toasts sit outside the inert subtree) | Y | |
| 90 | drawer open | 1440 | en | Press Escape | Closes and focus is **back on the header Bag link**, not lost to `<body>` | Y | |

## Pass G — 200 % browser zoom at 1024 (single pass, `/en`)

Ctrl+`+` to 200 % with the viewport at 1024 px.

| # | URL | Width | Locale | Action | Expected | Shot? | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 91 | `/en/shop` | 1024 @200 % | en | Load and scroll | Reflows to the narrow layout; **no horizontal scrolling of the page**; no text clipped or overlapping; the disc stays inside its photograph | Y | |
| 92 | `/en/products/silk-midi-dress` | 1024 @200 % | en | Choose M, add | Size cells, stepper and Add to Bag are all reachable and not overlapped; the toast is fully readable | Y | |
| 93 | drawer | 1024 @200 % | en | Open the drawer | The panel is usable: the footer (Subtotal, View bag, Continue shopping) is reachable by scrolling **inside** the drawer, not cut off | Y | |
| 94 | `/en/bag` | 1024 @200 % | en | Load | Summary and Checkout reachable; nothing clipped behind the sticky header | Y | |

## Pass H — Reduced motion (single pass, `/en`, 1440)

Windows Settings → Accessibility → Visual effects → Animation effects **off**, or DevTools →
Rendering → "Emulate CSS prefers-reduced-motion: reduce".

| # | URL | Width | Locale | Action | Expected | Shot? | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 95 | `/en/shop` | 1440 | en | Open a Quick Add panel | The panel **appears with no movement** — no slide/translate entrance (the `motion-safe:animate-quick-add` utility is off) | Y | |
| 96 | `/en/shop` | 1440 | en | Change a filter or sort | The grid swaps with **no entrance animation replaying** on the cards — no rise, no image wipe | Y | |
| 97 | `/en/shop` | 1440 | en | Scroll the page | No reveal animations fire; content is simply present | N | |
| 98 | drawer | 1440 | en | Open the drawer, then Remove a line | The drawer appears without a slide; the removed row disappears **instantly** rather than fading 180 ms; Undo still works | Y | |
| 99 | `/en/bag` | 1440 | en | Reload with a non-empty bag | The loading placeholders show at once and **hold still** (no breathing pulse) | Y | |

## Pass I — Throttled network (single pass, `/en`, 1440)

DevTools → Network → throttling preset **Slow 4G** (or custom 200 kbps / 600 ms RTT).

| # | URL | Width | Locale | Action | Expected | Shot? | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | `/en/shop` | 1440 | en | Hard-reload | The page shell and `h1` arrive first, then the grid streams in behind a skeleton — **never a blank page** | Y | |
| 101 | `/en/shop` | 1440 | en | Change the sort | The **old grid stays on screen, dimmed**, until the new one lands — it must not flash a skeleton | Y | |
| 102 | `/en/bag` | 1440 | en | Reload with 2 lines in the bag | A reserved `aria-busy` region one row tall + the summary in its final shape, with a visually hidden "Updating". **The empty state never flashes.** | Y | |
| 103 | `/en/bag` | 1440 | en | Press **+** on a line | The line total dims and keeps the **previous** figure while the quote is in flight — it must never blank to `—` or `0` | Y | |
| 104 | `/en/bag` | 1440 | en | Press + twice quickly, watch the summary | While the quote is stale the subtotal turns secondary-grey, is `aria-busy`, and carries a hidden "Updating". **A stale subtotal is never presented as the final figure** (grey + Updating is the tell). | Y | |
| 105 | `/en/bag` | 1440 | en | Wait for it to settle | Subtotal returns to full ink with the new figure and the pieces count agrees with the rows | N | |

## Pass J — API stopped mid-journey (single pass, `/en`, 1440)

**Stop the API** (PowerShell):
`Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001 -State Listen).OwningProcess -Force`

**Restart it** afterwards, from `C:\Users\opggh\Desktop\moon-store\apps\server`, in PowerShell:

```
$env:DATABASE_URL = 'postgresql://postgres:%23Mm3002571@localhost:5432/moon_store_audit'
$env:MEDIA_LOCAL_ROOT = 'C:\Users\opggh\.claude\jobs\711044f5\tmp\audit-media'
npm run dev
```

Both variables are mandatory: without `DATABASE_URL` it points at the dev database, and without
`MEDIA_LOCAL_ROOT` its media sweep deletes tracked `apps/server/uploads` images.

| # | URL | Width | Locale | Action | Expected | Shot? | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 106 | `/en/bag` | 1440 | en | With 2 lines in the bag, stop the API, then press **+** | The bag shows its **failed** state: no rows, "{n} pieces in your bag", **"We couldn't update your bag"** and a **"Try again"** button. No stack trace, no HTTP code, no `ECONNREFUSED`. (This is also LOW-8's evidence: note that Remove is unreachable.) | Y | |
| 107 | `/en/bag` | 1440 | en | Press **Try again** while still down | It retries and lands back on the same failed state — it does not fall through to the global error page | Y | |
| 108 | `/en/bag` | 1440 | en | Check localStorage | `moon-fashion-cart` is **unchanged** — a failed quote never deletes a shopper's lines | Y | |
| 109 | `/en/shop?sort=price-desc&page=2` | 1440 | en | Load an uncached listing while down | The catalog error screen: "We couldn't load this page" / "Something went wrong on our side. Please try again in a moment." / **"Try again"**. Not the global `/error` route, no digest or code on screen. | Y | |
| 110 | `/en/shop/dresses` | 1440 | en | Load while down | The same error screen — a failed entity lookup must **not** masquerade as a 404 | Y | |
| 111 | — | — | — | Restart the API with the command above | Wait for it to log ready on 3001 | N | |
| 112 | `/en/bag` | 1440 | en | Press **Try again** | The rows and the subtotal come back with the same quantities as before the outage | Y | |

## Pass K — Console, history and locale (single pass; keep the Console open throughout)

| # | URL | Width | Locale | Action | Expected | Shot? | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 113 | `/en/shop` | 1440 | en | Hard-reload with the Console filtered to **Errors** | Zero error entries. In particular **no "Hydration failed" / "server rendered HTML didn't match"**. | Y | |
| 114 | `/en/bag` | 1440 | en | Hard-reload with a **non-empty** bag | No hydration mismatch — the server renders `hydrated: false` and must not pretend to know the bag | Y | |
| 115 | `/ar/shop` → `/ar/products/silk-midi-dress` → `/ar/bag` | 1440 | ar | Walk the journey with the Console open | Zero errors, zero hydration warnings in Arabic/RTL too | Y | |
| 116 | `/en/shop` | 1440 | en | Open the drawer, then press browser **Back** | Record the behaviour precisely: does Back close the drawer, or navigate away with the drawer still mounted? **Either way the bag contents must survive and focus must not be lost.** Record, do not grade — the drawer is not a history entry in the code, so the correct behaviour is whatever the owner accepts. | Y | |
| 117 | `/en/bag` | 1440 | en | Navigate to `/en/bag` from the drawer, then press **Back** | Returns to the listing you came from, at the same scroll position where possible; the header badge still shows the same count | N | |
| 118 | `/ar/shop` | 1440 | ar | Click a card → product → drawer → View bag → Checkout | **Every URL keeps the `/ar` prefix**, including `/ar/checkout`. No step drops to `/en`. | Y | |
| 119 | `/en/shop` | 1440 | en | Use the header locale toggle on a **filtered** listing (`?sort=price-asc&stock=in`) | Switches to `/ar/shop` keeping the same path **and query**, and the Arabic listing shows the same 29 pieces | Y | |
| 120 | `/en/bag` | 1440 | en | Switch locale from `/en/bag` | Lands on `/ar/bag` with the **same lines** (localStorage is locale-independent) and Arabic copy | Y | |

## Coverage notes

- Rows **43–52** are the L9 rows and are attributable to this branch's three Quick Add /
  product-card commits and to nothing on `main`.
- Rows **44, 46, 52** settle **MED-5**; rows **45, 47** settle L9's premise (already dismissed by
  code reading in CC-23 — confirm in the browser).
- Rows **53–64** are the only per-width repeats (×4) and **65–78** the only per-locale repeats
  (×2 widths). Everything else is a single pass.
- Rows **24 and 108** are the two that prove R5 from the browser: the browser holds intent only,
  and a failure never mutates it.
- **Not gradeable from source, so record rather than grade:** row 45/47 (the CSS as written has
  no pointer guard, contradicting lead L9) and row 116 (browser Back with the drawer open).
- **Not covered by this matrix and needing a separate run:** the production-build `/checkout` 404
  with `NEXT_PUBLIC_CHECKOUT_ENABLED` unset (gap Q11), and the HIGH-2 re-run against
  `next build && next start` (gap Q17).
- **Any row left unrun goes into *Manual QA gaps* with its reason, never assumed passed.**

---

# Appendix B — Public catalog: per-route allowlist, cache and limiter

Every body below was scanned for `id`, `sku`, `barcode`, `stock`, `cost_price`, `product_id`,
`variant_id`, `min_stock`, supplier and reorder fields: **zero matches on all eight responses**,
including variant-bearing products and multi-line quotes. `proven-on: live stack`.

| Route | Observed keys | Leaked internal fields | Cache-Control (2xx) | Limiter bucket spent |
| --- | --- | --- | --- | --- |
| `GET /catalog/products` | slug, name, nameEn, description, descriptionEn, price, images[{url}], isNew, inStock, options, variants | none | `public, max-age=60` | catalog (300/IP, or 20000 shared with a valid token) |
| `GET /catalog/products/:slug` | the above + material(En), care(En), fit(En), category{slug,name,nameEn}, collections[]; variants as `{options, price, inStock}` — **no variant id** (PD-3) | none | `public, max-age=60` | catalog |
| `GET /catalog/categories` | slug, name, nameEn, description, descriptionEn, productCount | none | `public, max-age=60` | catalog |
| `GET /catalog/collections` | slug, name, nameEn, description, descriptionEn, season, year, imageUrl, isFeatured, productCount | none | `public, max-age=60` | catalog |
| `GET /catalog/collections/:slug` | the same DTO shape as the list | none | `public, max-age=60` | catalog |
| `GET /catalog/store-policies` | delivery, deliveryEn, returns, returnsEn — no other `settings` key | none | `public, max-age=60` | catalog |
| `POST /catalog/cart/quote` | lines[{index, slug, status, product{slug,name,nameEn,image}, options, unitPrice, requestedQuantity, quantity, maxQuantity, lineTotal}], subtotal, itemCount, maxLineQuantity | none — no raw `stock`; `maxQuantity` is the only stock-derived number and is capped at 10 | `no-store` (**except OPTIONS — MED-2**) | quote-only (300/IP; a valid token grants nothing here) |

## Hostile-input results

| Input | Status | Body shape | Server authority held? |
| --- | --- | --- | --- |
| `price` on a line | 400 | `VALIDATION_ERROR` / `unrecognized_keys` on `lines.0` | yes |
| `total` at body root | 400 | `VALIDATION_ERROR` / `unrecognized_keys` on `""` | yes |
| `__proto__` option key | 200 | line `ok` (key invisible to `Object.keys`; no pollution) | yes — see Observations |
| `constructor` option key | 200 | `variantUnavailable` | yes |
| 31 lines | 400 | `too_big` on `lines` | yes |
| 30 lines | 200 | 30 lines returned | yes (boundary exact) |
| quantity 11 | 400 | `too_big` on `lines.0.quantity` | yes |
| quantity 10 | 200 | line returned | yes |
| 6 options | 400 | `custom` on `lines.0.options` | yes |
| 41-char option key | 400 | `too_big` on the key's path | yes |
| body > 16 KB | 413 | "Request body is too large", `no-store` | yes (pre-parse) |
| malformed JSON | 400 | "Request body is not valid JSON", `no-store` | yes (not a 500) |
| uppercase/malformed slug | 400 | `invalid_string` | yes (no existence probe) |
| unknown slug | 200 | `productUnavailable`, `product: null` | yes |
| **discontinued product** | 200 | `productUnavailable` — **byte-identical to unknown** | yes (no existence oracle) |
| inactive product | — | no seed fixture; same `status='active'` predicate | code reading |
| **variant with NULL price** | 200 | `ok`, `unitPrice` 2850 == `products.price` exactly | yes (never 0) |
| **variant stock 0** | 200 | `soldOut`, unitPrice still 2850, qty 0, max 0 | yes |
| **stock 3, ask 7** | 200 | `reduced`, qty 3, lineTotal 8550, subtotal counts 3 not 7 | yes |
| **30 lines, one stock-3 variant, ask 10 each** | 200 | every line max 3 / qty 3 independently; subtotal 256500, itemCount 90 | yes (never cumulative) |
| **no-variant product, real stock 22** | 200 | `maxQuantity` 10, never 22 | yes (stock above the cap undisclosed) |
| **nonexistent size on a real variant product** | 200 | `variantUnavailable`, unitPrice null, options [] | yes (no silent substitution) |
| **`{"SIZE":"m"}` (case variance)** | 200 | `ok`, canonical `{"key":"size","value":"M"}` echoed | yes |
| **`<b>M</b>` / `<script>…</script>M`** | 200 | `ok` — sanitized to `M`, matches the real variant | yes — see Observations |
| OPTIONS, no or foreign Origin | 200 | `Allow: POST`, `public, max-age=60` | **no** — MED-2 |
| GET / HEAD on the quote path | 404 | shared `NOT_FOUND` body, `no-store` | yes |
| POST from a foreign origin | 200 | quote data, **no ACAO header** | yes (public data; CORS is a browser control) |

---

# Appendix C — Reconciliation matrix

Live quote probes against `moon_store_audit`, all `Cache-Control: no-store`. Fixtures:
`cashmere-pullover` (base 3200; S override 2750 stock 7, L NULL stock 1, M NULL stock 0),
`silk-midi-dress` (2850; M stock 3, S/L stock 0). The join is **by line key, never by position**
(`reconcile.ts:288-292`, `:301-302`).

| Server status (live evidence) | Row status | Drawer + `/bag` display | Subtotal | Store write |
| --- | --- | --- | --- | --- |
| `ok` — S ×2 → unitPrice 2750, lineTotal 5500, max 7 | `ok` | priced, stepper 1..7 | counted (5500) | none |
| `ok`, NULL-priced variant — L ×1 → unitPrice **3200** (product price, never 0) | `ok` | priced 3200 | counted | none |
| `reduced` — midi M ×8 → quantity 3, max 3, lineTotal 8550 | `reduced` | shows **3**, "Only 3 available"; **stored stays 8**; both stepper buttons enabled | counted at 3 (8550) | **none** |
| `soldOut` — midi L ×1 → quantity 0, max 0, unitPrice 2850 | `soldOut` | kept, flagged "Sold out", `lineTotal` null, stepper disabled, Remove enabled | excluded | none |
| `variantUnavailable` — size XXL → options `[]`, unitPrice null | `variantUnavailable` | kept, flagged, **stored options shown** (`reconcile.ts:248`) | excluded | none |
| `productUnavailable` — unknown slug → product null | `productUnavailable` | placeholder image, "A piece that is no longer available", stored options, Remove only (stepper suppressed, `cart-line.tsx:210`) | excluded | none |
| Inactive / discontinued / gone | identical `productUnavailable` bytes | as above | excluded | none |
| Canonical drift — sent `size: "s"`, server answered `size: "S"` | `ok` | priced normally | counted | **the one write**: `applyCanonical` |
| Quote failed (5xx / network) | — | `failed` view: piece count, error text, **Try again** | not shown | none |
| Quote rejected (400 `VALIDATION_ERROR`, e.g. qty 11) | — | `failed` view: piece count, error, **Empty bag**, no Retry | not shown | none (until Empty bag) |
| Quantity changed, verdict not back yet | `pending` | previous line total dimmed + `aria-busy`, `+` holds at `knownMaxQuantity` | summary `stale`, previous figures kept dimmed | none |

## Storage recovery paths

| Stored value | Behaviour on reload | Pinned by |
| --- | --- | --- |
| `null` (never written) | empty bag, **no write** | `cart-storage.test.ts:42` |
| Malformed JSON | reset to empty, rewrite | `:46` |
| Bad envelope (no `lines` array / non-number `version`) | reset to empty, rewrite | `:57`, `persisted-cart.test.ts:119` |
| `version: 2` | **reset to empty, rewrite** (`cart-storage.ts:59`) | `cart-storage.test.ts:50` |
| Line with `quantity: "2"` | that line dropped, the rest kept | `persisted-cart.test.ts:28`, `cart-storage.test.ts:65` |
| Line with six options | that line dropped | `persisted-cart.test.ts:55` |
| `__proto__` option key | that line dropped, no prototype pollution | `persisted-cart.test.ts:77`, `:89` |
| 31 lines | first 30 distinct kept, rewrite | `cart-storage.test.ts:99` |
| Duplicate line key | merged into the first occurrence, sum capped at 10, rewrite | `cart-storage.test.ts:84` |
| Storage throws (private mode) | in-memory bag for the session, never throws to the shopper | `cart-storage.test.ts:125`, `:178` |

## What the cart suites genuinely pin

`npx vitest run features/cart` — **17 files, 231 tests, all passing, 1.69 s.**

| File | Tests | Genuinely pins |
| --- | --- | --- |
| `schemas/persisted-cart.test.ts` | 13 | every rejection rule, prototype-key safety, fresh-object rebuild, key stripping |
| `utils/cart-storage.test.ts` | 22 | the whole read policy incl. the v2 reset; hydration; hint in-memory-only; restore-at-index |
| `utils/cart-lines.test.ts` | 38 | identity, merge, caps, bag-full, restore, canonical rewrite |
| `utils/reconcile.test.ts` | 25 | every status, stale summaries, CD-15's "writes nothing", both fixed-point cases, announce-once, the 400 path |
| `api/quote-cart.test.ts` | 12 | the body projection and every *shape* rejection (**no arithmetic** — MED-8) |
| `api/use-cart-quote.test.ts` | 15 | freshness overrides, enablement, the retry policy, the debounce, the status mapping |
| `utils/bag-view-model.test.ts` | 20 | stepper rules incl. the reduced-row both-presses case, focus targets, toasts |
| `utils/checkout-readiness` / `checkout-entry-model` / `checkout-availability` | 7 / 5 / 3 | the gate, its reasons, the flag resolver |
| `utils/drawer-close-focus.test.ts` | 4 | the *decision*, **not** the DOM effect |

**Unguarded:** cross-tab `storage` sync (MED-9); quote arithmetic invariants (MED-8); every DOM
behaviour in *Manual QA gaps*.

---

# Appendix D — Stock writers and readers

`proven-on: real PostgreSQL | live stack`. `apps/server/src/modules/pos/stockWriteOrder.ts`
`sortForStockWrites` is a lock-ordering helper only — products before variants, then ascending
id — and writes nothing.

## Writers

| # | Path | Column | Shape | Branches on | Audit row |
| --- | --- | --- | --- | --- | --- |
| W1 | `apps/server/services/productService.ts:298` `updateProduct` | `products.stock` | **absolute** `stock=$6` | **neither** — always writes | **none** (HIGH-3) |
| W2 | `services/productService.ts:205` `createProduct` | `products.stock` | absolute INSERT | neither | none |
| W3 | `src/modules/inventory/products/repository.ts:240` `update` | `products.stock` | absolute | neither | none (dead twin of W1; the mounted route uses W1) |
| W4 | `src/modules/inventory/stockAdjustments/repository.ts:73` `applyDelta` | `products.stock` **only** | guarded relative `stock+$1::int >= 0` | **no variant support at all** (MED-13) | yes, `stock_adjustments` |
| W5 | `src/modules/pos/sales/repository.ts:641/679` `decrementProduct/VariantStock` | one **XOR** the other | guarded relative | `service.ts:806` `isVariantLine` | yes, reason `Sale` |
| W6 | `src/modules/pos/sales/repository.ts:664/694` (refund) | one XOR the other | unguarded relative (correct — addition) | `service.ts:1106` `if (item.variant_id)` | yes |
| W7 | `src/modules/pos/exchanges/repository.ts:262/270` `restockVariant/Product` | one XOR the other | unguarded relative | `variant_id` | via sale/exchange records |
| W8 | `src/modules/pos/exchanges/repository.ts:289/304` `deductVariant/ProductStock` | one XOR the other | guarded relative | `variant_id` | — |
| W9 | `src/modules/commerce/onlineOrders/repository.ts:161/167` `deductStock` | one XOR the other | guarded relative | `variantId ? … : …` | — |
| W10 | `src/modules/commerce/onlineOrders/repository.ts:253/258` (restore) | one XOR the other | unguarded relative | `variant_id` | — |
| W11 | `src/modules/inventory/stockCounts/repository.ts:246/252` | one XOR the other | **absolute** (correct: a count asserts an observed total) | `service.ts:110` | yes, reason `Stock Count` (but see MED-14) |
| W12 | `src/modules/fulfillment/purchaseOrders/repository.ts:228/240` | one XOR the other | unguarded relative | `variant_id` | — |
| W13 | `src/database/seed.ts:878` | `products.stock = SUM(variants.stock)` | absolute | — | — (seed only; this is why the two columns *start* agreeing) |

## Readers

| # | Path | Column read | Branches on |
| --- | --- | --- | --- |
| R1 | `src/modules/commerce/catalog/mappers.ts:353` | `hasVariants ? variants.some(inStock) : products.stock > 0` | **`has_variants`** — correct |
| R2 | `catalog/mappers.ts:304,440-460` (quote) | `variant.stock` when a variant matched, else `products.stock` | variant match — correct |
| R3 | `inventory/products/repository.ts:101` `findVariantByBarcode` | `v.stock` | variant row only — correct |
| R4 | dashboard product list (`GET /api/v1/products`) | serves **both** `stock` and `variant_stock` | — |
| R5 | `apps/dashboard/.../Inventory.tsx:519-531` Stock column | `row.original.stock` (= `products.stock`) | **nothing** — HIGH-4 |
| R6 | `Inventory.tsx:486-493` critical/low badge | `row.original.stock` vs `min_stock` | nothing — HIGH-4 |
| R7 | `Inventory.tsx:603` Variants column | `p.variant_stock` (a small parenthetical) | `has_variants && variant_count` |
| R8 | `apps/dashboard/.../POS.tsx:204` `getEffectiveStock` | `has_variants && variant_count > 0 ? variant_stock : stock` | **correct** |
| R9 | sales/exchanges/onlineOrders refusal paths | the matching column | `variant_id` — correct |
| R10 | `inventory/stockCounts/service.ts:56` snapshot | `variant_id ? variant_stock : stock` | correct |

**Verdict.** For a product with `has_variants = 1`, `product_variants.stock` is the only column
any sale, refund, exchange, online order, PO receipt, stock count or the public catalog reads or
writes. `products.stock` on such a product is **write-only dead state** — except that two
dashboard surfaces still present it as *the* Stock number (R5/R6) and the product form still
writes it (W1).

## Price: eight surfaces × three cases

A = `linen-summer-dress` (no variants, `products.price` 1950). B = NULL-priced variant,
`cashmere-pullover` size L (`products.price` 3200). C = explicit override,
`cashmere-pullover` size S (`product_variants.price` 2750).

| # | Surface | Rule in code | A | B | C | Proven on |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Dashboard product list | serves `products.price` only | 1950 | 3200 | 3200 (the list has no variant price) | real PostgreSQL, live |
| 1b | `VariantManagerDialog.tsx:142` | `Number(variant.price \|\| product.price \|\| 0)` | n/a | 3200 | 2750 | code reading (LOW-1) |
| 2 | POS add-to-cart `POS.tsx:195` | `variant.price \|\| variantProduct.price` | 1950 | 3200 | 2750 | code reading |
| 2b | POS server pricing `pos/sales/repository.ts:612` | SQL `COALESCE(pv.price, p.price)` | 1950 (sale total `"1950"`) | — | **2750** (sale total `"2750"`) | real PostgreSQL, live |
| 3 | Barcode lookup `inventory/products/repository.ts:108` | SQL `COALESCE(v.price, p.price)` | — | 3200 | 2750 | **code reading only** — every seeded variant barcode is NULL |
| 4 | Public catalog listing `catalog/mappers.ts:303` | `toNumber(variant.row.price ?? productPrice)` | 1950 | 3200 | 2750 | real PostgreSQL, live |
| 5 | Public catalog detail | the same mapper | 1950 | 3200 | 2750 | live: `variants:[{S,2750},{M,3200},{L,3200}]` |
| 6 | ProductCard `variant-selection.ts:65` `displayedPrice` | reads the DTO's already-effective price; no NULL reaches the client | 1950 | — | `/en/shop` rendered **"From 2,750 EGP"** | live stack |
| 7 | Cart quote `catalog/mappers.ts:459` | `unitPrice = variant.price` (already `??`-resolved) else `product.row.price` | 1950 | **3200** | **2750** | real PostgreSQL, live |
| 8 | Bag / PDP | the same DTO, the same `displayedPrice` | — | — | PDP rendered "From 2,750 EGP"; payload `2750,3200,3200` | live stack |

**No surface produced `0` for any case.** The `??` resolves before `toNumber` in the catalog and
`COALESCE` resolves inside SQL in POS, barcode lookup, exchanges and online orders, so a NULL
override can never be coerced to `0`.

---

# Appendix E — Commerce schema (live, post-017)

Introspected against a scratch database with all 17 migrations applied and seeded.
`proven-on: real PostgreSQL`.

| table | column | type | nullable | default | constraints / indexes |
| --- | --- | --- | --- | --- | --- |
| products | id | integer | NO | nextval | PK |
| products | name | text | NO | — | NOT NULL |
| products | sku | text | NO | — | UNIQUE (`products_sku_key`), idx `idx_products_sku` |
| products | barcode | text | YES | — | UNIQUE (`products_barcode_key`), idx `idx_products_barcode` |
| products | price | numeric | **NO** | — | NOT NULL |
| products | cost_price | numeric | YES | 0 | |
| products | stock | integer | NO | 0 | CHECK `stock >= 0`, **NOT VALID** (`products_stock_non_negative`) |
| products | category_id | integer | YES | — | FK → categories(id) **ON DELETE SET NULL**, idx `idx_products_category_id` |
| products | distributor_id | integer | YES | — | FK → distributors(id) ON DELETE SET NULL |
| products | status | text | YES | 'active' | CHECK IN ('active','inactive','discontinued'), validated; idx `idx_products_status`, `idx_products_status_created` |
| products | slug | text | YES | — | **UNIQUE** idx `idx_products_slug` (nullable + unique: multiple NULLs allowed) |
| products | image_url, name_en, description(_en), material(_en), care(_en), fit(_en) | text | YES | — | 015/016 additions |
| product_variants | id | integer | NO | nextval | PK |
| product_variants | product_id | integer | NO | — | FK → products(id) **ON DELETE CASCADE**, idx `idx_product_variants_product_id` |
| product_variants | sku | text | NO | — | UNIQUE |
| product_variants | barcode | text | YES | — | UNIQUE |
| product_variants | price | numeric | **YES** | — | nullable — the override seam. **No CHECK** (LOW-1) |
| product_variants | cost_price | numeric | YES | 0 | |
| product_variants | stock | integer | NO | 0 | CHECK `stock >= 0`, **NOT VALID** |
| product_variants | attributes | text | NO | '{}' | JSON-as-text, no database-level JSON validation |
| categories | id / name / code | — | NO | — | PK; name UNIQUE; code UNIQUE |
| categories | slug | text | YES | — | UNIQUE idx `idx_categories_slug` |
| collections | id / name | — | NO | — | PK; name UNIQUE |
| collections | slug | text | YES | — | UNIQUE idx `idx_collections_slug` |
| collections | status | text | YES | 'active' | **no CHECK found** — free text |
| collections | is_featured, year | integer | YES | 0 / — | |
| collection_products | collection_id | integer | NO | — | PK part 1, FK → collections(id) ON DELETE CASCADE |
| collection_products | product_id | integer | NO | — | PK part 2, FK → products(id) ON DELETE CASCADE, idx `idx_collection_products_product_id` (017) |
| collection_products | position | integer | NO | — | **UNIQUE (collection_id, position)** |
| product_images | id | integer | NO | nextval | PK |
| product_images | product_id | integer | NO | — | FK → products(id) ON DELETE CASCADE |
| product_images | image_url | text | NO | — | |
| product_images | position | integer | NO | — | **UNIQUE (product_id, position)** |

---

# Appendix F — Automated suites and gates, as run

`proven-on: live runs on this machine, 2026-09-22`. Per AD-9 every failure was re-run on an
`origin/main` worktree or established as byte-identical so a `main` re-run was redundant.

| Suite / gate | Pass/Fail | Notes |
| --- | --- | --- |
| server `typecheck` (`tsc --noEmit`) | PASS | clean |
| server `lint` (`eslint . --max-warnings 384`) | PASS | **384 warnings, 0 errors — exactly at the ratchet** |
| server `check:api-docs` | PASS | 209/209 served routes documented + manifested + contracted (206 derived, 3 excused) |
| server `check:route-auth` | PASS | 206 manifest entries agree with route middleware; 0 under-protected |
| server `check:client-paths` | PASS | 185 dashboard calls map to served routes, 14 resolved dynamically, 0 postponed exceptions — **covers `apps/dashboard` only** |
| server `verify:migrations` (no DB var) | FAIL (expected) | refuses to run without `TEST_DATABASE_URL` / `MIGRATION_TEST_DATABASE_URL` — correct guard behaviour, not a defect |
| server `verify:migrations` (with the var) | PASS | all 17 apply; every `.down.sql` reverses; re-apply round-trips clean |
| server `npm test`, no `TEST_DATABASE_URL` | PASS (after re-run) | real-PG suites skip **loudly** each time; the first attempt's 3 failures were timeout contention (LOW-13) |
| server `npm test`, with `TEST_DATABASE_URL` | PASS | 94/94 files, 1236/1236 tests |
| server `assertRealPostgresSuitesRan.mjs` | PASS | `230 real-PostgreSQL test(s) executed across 30 file(s)` — they genuinely ran |
| dashboard `typecheck` | PASS | clean |
| dashboard `lint` (eslint + madge cycles) | PASS | 16 warnings (fast-refresh / exhaustive-deps), 0 errors; no circular deps |
| dashboard `test` | PASS (after isolated re-run) | full-suite runs showed 7 and 9 failures, all 20000 ms timeouts in a different mix each run; the same files pass in isolation (LOW-13) |
| dashboard `build` | PASS | Vite build succeeds; the >500 KB chunk warning is the documented, expected one |
| dashboard `budget` (`bundleBudget.mjs`) | PASS | 404/414, 38/42, 37/37, 128/134, 32/35 |
| storefront `typecheck` (`next typegen && tsc --noEmit`) | PASS | clean |
| storefront `lint` | PASS | clean, no output |
| storefront `test` | **FAIL** | 1 file / 1 test: `lib/editorial/assets.test.ts` — **branch-introduced, not flaky** (MED-1) |
| storefront `build` (`next build`) | PASS | Turbopack build, typecheck and all 14 routes/static pages succeed |

**One failure, correctly classified.** MED-1 is branch-introduced: it passes 6/6 on an
`origin/main` worktree where the offending asset does not exist. Everything else classified as
environment-dependent contention (LOW-13) reproduced only under load and disappeared on an
isolated re-run.

---

## Closing note

This report is the audit's only artefact. No code, configuration, CI definition, ratchet or
schema was changed; no GitHub issue was created; no commit was made (AD-2). `git status` shows
the three pre-existing dirty files recorded in *Repository state*, the untracked plan document,
and this file.

The fix plan is separate work. The sequence above is ordered by the blocking column and by which
single change closes several findings — most notably HIGH-2 + MED-16 (one revalidation lever),
HIGH-3 + HIGH-4 + MED-11 (one absent-field/stock-truth workstream), and HIGH-5 + HIGH-6 + MED-10
(one operator upload workstream).
