# Server (`apps/server/`)

Subsystem contracts for the Express + PostgreSQL API. These load when you work under
`apps/server/`; the always-loaded root `CLAUDE.md` holds the project-wide rules.

## Migration verification

```bash
cd apps/server && MIGRATION_TEST_DATABASE_URL=postgresql://.../moon_store_migrations_test npm run verify:migrations
```

Rolls back the top *k* migrations and re-applies them, for every *k*, comparing a schema
snapshot (columns, constraints, indexes) each time. Stepping one at a time is the point:
migration 001 creates every core table, so a full down-then-up destroys the evidence of
any later migration's broken rollback and passes. Measured — blanking
`008_collection_year.down.sql` survives a naive full round trip.

Two failures it reports separately: a down that leaves something behind (the re-apply no
longer matches the snapshot) and a down that does nothing at all (the schema is unchanged
by the rollback). The second cannot be caught by comparison alone, because an idempotent
up like `ADD COLUMN IF NOT EXISTS` re-applies happily over its own leftover.

A down migration that *should* change nothing — `002` inserts a settings row and cannot
prove on rollback which row was its own — declares it with the line
`Intentionally a no-op.` in its `.down.sql`. That marker is load-bearing, not a comment.

The script refuses to run against a database whose name does not look disposable, and
works in its own `migration_verify` schema.

**A migration that both moves data and narrows a CHECK must drop the constraint first.**
`010` remaps `purchase_orders.status` into the vocabulary the application speaks, and the
old constraint did not admit two of the values it writes — so backfilling before dropping
made the UPDATE itself a CHECK violation. Drop, backfill, then add the narrowed
constraint *validated*: the backfill immediately above guarantees every row conforms, so
the `NOT VALID` that `009` needed does not apply. Its `.down.sql` does the same in
reverse, for the same reason.

**A backfill UPDATE re-checks every CHECK, including one added `NOT VALID`.** `004` added
`products_stock_non_negative` `NOT VALID` so legacy negative-stock rows could survive; `014`
setting a slug on such a row would abort the migration. So `014`'s backfill lifts every
unvalidated CHECK on `products` and `categories`, backfills, and re-adds each from its own
`pg_get_constraintdef` (which carries the `NOT VALID`) in the same transaction: the
constraint ends exactly as it was. Proven on real PostgreSQL in
`tests/concurrency/storefrontCatalogMigration.realpg.test.ts`.

Note that replaying an *older* migration's raw SQL after a newer one has narrowed the
same object undoes the narrowing — `009` re-adds its own wider list. That is inherent to
what "replay migration N" means, not a bug in either file, and it is why
`migration009.test.ts` replays both in order rather than only the one it is named for.

## Dormant tables

Fourteen tables belong to features removed from the application but not from the schema.

| Removed feature | Tables |
| --- | --- |
| Layaway | `layaway_plans`, `layaway_items`, `layaway_payments` |
| Vendors / consignment | `vendors`, `vendor_products`, `vendor_commissions`, `vendor_payouts`, `vendor_reviews` |
| Report builder | `report_builder`, `saved_reports` |
| AI module | `sales_predictions`, `ai_chat_sessions`, `ai_chat_messages`, `auto_descriptions` |

No route reads or writes them. They are kept because production holds rows in them, and
`vendor_payouts` and `layaway_payments` are financial history: a drop migration's down can
recreate a table for `verify:migrations`, never its rows. They go in one dedicated
migration once the production database has been reset — or, if the reset slips, after an
export. That export holds vendor contact and tax data and customer payment history, so it
belongs in access-controlled, encrypted storage with a named owner and a deletion date,
never the repo or a shared drive. Until the drop, they stay in the seed `tablesToClear`
list and in the e2e suite's table count.

**Dormant is not inert.** `layaway_plans.customer_id` and `layaway_items.product_id`
reference `customers` and `products` with no `ON DELETE` action, so deleting a customer or
product that ever had a layaway plan fails on the foreign key — and nothing maps that
error, so the caller gets an unmapped database error. That lasts until the drop.

**Deploy preflight, only when deploying onto a database that still has layaway data.**
Every plan not in a terminal state has taken a deposit and may hold deducted stock, and no
screen can settle it any more. Before the deploy, list them with what each customer has
paid:

```sql
SELECT plan_number, customer_id, status, total_amount,
       total_amount - remaining_balance AS paid
  FROM layaway_plans
 WHERE status IS NULL OR status NOT IN ('completed', 'cancelled');
```

Pre-009 rows may carry other status spellings, hence the negative filter. The owner
decides honour, refund or complete for each, and settles it on the release that still
has layaway, recording any refund owed before the deploy. Cancelling a plan puts the stock
back but records no refund. After a production reset there is nothing to settle.

## Rate-limit bucketing

The global limiter is keyed on the **authenticated user**, not on the IP. Several tills
behind one shop router share one address, so an IP-keyed budget is a per-shop budget and
one busy till can push a colleague into a `RATE_LIMITED` mid-checkout. The limiter runs
ahead of `verifyToken`, so the identity comes from verifying the bearer token's signature
inside the key generator — verifying, never decoding: an unverified token would let a
caller choose its own bucket. Unauthenticated requests keep the IP bucket, and
`GET /api/health` is exempt so an uptime probe cannot be starved by, or starve, the tills.

`authLimiter` on `/auth/login` and `/auth/refresh` deliberately stays IP-keyed: a
credential-guessing attacker is unauthenticated by definition, so there is no verified
user to key on.

| Variable | Default | Meaning |
| --- | --- | --- |
| `RATE_LIMIT_MAX` | `200` | Global ceiling per 15 min. |
| `AUTH_RATE_LIMIT_MAX` | `10` | Ceiling on `/auth/login` and `/auth/refresh`. |
| `TRUST_PROXY` | unset (off) | How far to trust `X-Forwarded-For` when deriving `req.ip`. |

The two ceilings are deliberately separate variables: one raising both would let a config
written to unblock a test run silently relax the credential brute-force ceiling. A value
that is not a positive integer falls back to the default, and any override is warned about
at boot.

`TRUST_PROXY` accepts a hop count (`1`), a comma list of addresses/CIDRs/`loopback`-style
presets, or `true`. Unset reproduces Express's default exactly. Prefer a hop count: `true`
trusts the whole client-supplied chain, which lets a client pick its own IP bucket — it is
accepted but warned about at boot, as is a value that could not be parsed.

## Idempotency compatibility window

Retry-prone mutations (`POST /api/v1/sales` and the other wrapped endpoints) accept an
`Idempotency-Key` request header. A repeated key returns the original outcome
byte-identically with `Idempotent-Replay: true`; the same key with a different payload,
endpoint, or user returns `409` with the code `IDEMPOTENCY_KEY_REUSED`. Keys live 24h and
identify a *committed outcome* — a failed mutation releases its key, so a corrected retry
under the same key runs normally.

**`POST /api/v1/layaway/:id/pay` was in that set from #127 until layaway was removed**, and
its design is the one to copy for any mutation that takes money. The claim shares the
payment's transaction, which is what makes the pair atomic: the alternative — claiming in
one transaction and paying in another — can leave a key recorded for a payment that
rolled back, and the customer's retry is then answered with a replay of a payment that
never happened. The plan id was part of the fingerprinted payload, so one key reused
against a different plan conflicted rather than replaying the first plan's response.

| Variable | Default | Meaning |
| --- | --- | --- |
| `IDEMPOTENCY_REQUIRED` | `false` | While false, a request with no key behaves exactly as it did before idempotency existed. Set to `true` to require the header. |

**Rollout order is server first, then client** — neither half breaks the other at any
point in between, because the header is optional on both sides for the whole window.

**Flip criterion, not a date:** set `IDEMPOTENCY_REQUIRED=true` only once every deployed
till is confirmed to be sending the header. The observable is that
`SELECT COUNT(*) FROM idempotency_keys WHERE created_at > NOW() - INTERVAL '1 day'`
matches the day's sale count. Flipping is a config change, not a deploy, so it is
reversible in seconds.

## Optimistic concurrency on collections

`PUT /api/v1/collections/:id` replaces a collection's **entire** product set — the join
rows are deleted and re-inserted from the list in the body. Last-writer-wins is therefore
inherent to the endpoint's shape, and it used to be silent: a reorder computed before a
colleague's append simply erased that product, and both admins got a 200.

So a write may carry `expected_updated_at`, the `updated_at` value the caller read. The
service takes `SELECT ... FOR UPDATE` on the collection row and compares before writing —
the lock is what makes check-then-write atomic, not a fix on its own, which is why a bare
row lock was rejected: the loser would still overwrite from stale data. A mismatch is a
`409` whose `details[]` carries the code `COLLECTION_MODIFIED`, and the whole transaction
rolls back.

The token is `updated_at` rendered by `toISOString()` — literally the call `res.json()`
makes on that column — so what is compared is byte-identical to what the client was given,
rather than two formats kept in agreement. A JS `Date` holds milliseconds while
`timestamptz` holds microseconds, so the comparison is millisecond-resolution by
necessity: the finer digits are gone before any client sees them. Two writes to one
collection inside the same millisecond are therefore indistinguishable, which needs a read
interleaved between them, and writers to a single collection are serialized by the row
lock — so consecutive writes are a whole transaction commit apart.

**The response deliberately does not include the current token.** The recovery for a
conflict is *review*: re-read, look at what changed, decide. Handing back a fresh token
would make blind resubmission the easiest thing to do, which is the overwrite the refusal
exists to prevent.

| Field | Default | Meaning |
| --- | --- | --- |
| `expected_updated_at` | absent | Absent means the caller stakes no claim on the version, and the write behaves exactly as it did before optimistic concurrency existed. |

Optional for the same reason `Idempotency-Key` is: a cached PWA client running older code
keeps working rather than breaking on a 409 it cannot explain. Every client this repo
ships sends it. The token must come from the read the edit was **composed against** — a
page that re-reads it at submit time always matches and has quietly turned the check off.

## Error contracts: typed at the throw site

A service says what kind of refusal something is; a controller does not work it out from
the wording. Services throw `PublicError` with one of the eight public codes, and the
controller's `catch` passes it to `next` unchanged. (`SERVICE_UNAVAILABLE`, 503, is the newest:
the public catalog's statement timeout.)

Before #47 this was inverted: services threw bare `Error`s and controllers recovered the
status by testing the message. `layaway` (since removed) chose 404 on
`message.includes('not found')`, and
the checkout path had **eight** substring tests — one of them the bare word `'Bundle'`.
That made every one of those strings part of the API without anyone declaring it, in both
directions:

- Rewording "Plan not found" turned a 404 into a 400, silently.
- A genuine server fault whose message happened to contain `Bundle` or `not found` reached
  the till as a 400 telling a cashier to fix their cart.

An unexpected error is now a 500, which is the truth, and `tests/sales.test.ts` pins that
as well as the happy path.

### Database constraint failures

Recognised by SQLSTATE, never by message text — `src/database/constraintErrors.ts`.

```ts
if (isUniqueViolation(err)) throw new PublicError('CONFLICT', 'SKU already exists');
```

A dozen controllers used to ask `err.message?.includes('UNIQUE')`, which depends on the
server's `lc_messages`, on the driver, and on nobody rephrasing anything. It also matched
too much: a validation message containing the word "unique" read as a duplicate key and
was answered with a 409. And `'UNIQUE'` is SQLite wording — PostgreSQL says
`duplicate key value violates unique constraint`, lowercase — so half of every one of
those checks had been dead since the migration without anyone noticing. Which is the
argument against the technique, not just against that string.

### Catalog slugs (products, categories, collections)

`src/modules/inventory/shared/slug.ts` owns the pattern (`^[a-z0-9]+(?:-[a-z0-9]+)*$`,
1-80 characters, Zod only: 014 adds no CHECK because pg-mem has no regex) and generation.
A create with no slug takes the first free candidate from `name_en`, else the SKU or code,
else `<resource>-<id>`: `base`, `base-2` ... `base-10`, chosen in one
`UPDATE ... SET slug = CASE WHEN NOT EXISTS ...` inside the create's transaction. A
concurrent writer that wins the same candidate surfaces as a 23505 on `idx_<table>_slug`;
the statement is retried under a SAVEPOINT, narrowed by constraint name. Ten taken
candidates, or an explicit slug another row holds, is a 409 whose `details[].field` is
`slug` (`SLUG_UNAVAILABLE` / `SLUG_TAKEN`) -- an operator who typed a slug is told, never
silently suffixed. Updates never generate: absent `slug` / `name_en` / `description_en`
leave the stored value, even on the full-replacement product and category PUTs.

Two pg-mem gaps shape the tests. It cannot parse SAVEPOINT (`tests/support/pgMem.ts`
no-ops those statements, faithful because it never reports `err.constraint`, so the retry
cannot trigger), and it does not roll back, so "the refused row is gone" is asserted only
in `tests/concurrency/catalogSlug.concurrency.test.ts`, which forces each race by holding
the slug in an open transaction until the writer is seen waiting on the lock.

`importProducts` writes each row in its own transaction (it used to be one autocommit
statement per row, never one transaction for the file), so a row and its slug commit
together and a failing row still fails alone.

## The API contract: one description, two gates

Three descriptions of this API used to exist and only one was enforced — the Zod schemas
that actually validate, the hand-written `src/docs/openapi.ts` published to consumers, and
a regex scraper over the endpoint manifest's source text. #102 is collapsing that; it is
partly done, and the two gates below cover different failures.

### Request contracts (#102)

A `RequestContract` is not a description of a validator, it **is** the validator.
`contracts.createUser.parseBody(req.body)` is what the controller calls, and the document
is generated from that same object, so there is nothing to keep in agreement.

- Contracts are declared in the module that serves them (`schemas.ts`), so the dependency
  runs **modules → docs and never back**, and a controller can parse through its own
  contract without importing anything from `docs/`.
- A `schemas.ts` may not import a service, repository or database. Generation runs in CI
  with no credential and no connection; one such import drags the whole database layer in.
- `src/docs/buildOpenApi.ts` **overlays** derived request shapes onto the hand-written
  document rather than regenerating it. Deriving responses would mean inventing schemas
  nothing enforces — no response in this server is Zod-validated — which is this same
  defect pointed the other way. Responses, examples, tags and security stay hand-written.

Two things the derivation gets right that a hand-written spec kept getting wrong. Query
parameters document the **wire** value: `page` is a string that transforms to a number, so
it documents as `type: string, pattern: ^\d+$, default: '1'`, because `integer` would tell
a consumer to send something a query string cannot carry. And `additionalProperties: false`
appears only where the schema is `.strict()` — Zod strips rather than rejects by default,
so claiming a rejection elsewhere is a promise nothing keeps.

Constraints OpenAPI cannot express go in `beyondSchema` and are appended to the operation
description. An unrepresentable rule silently becoming "unconstrained" is worse in a
generated document than in a hand-written one, because it now carries the authority of
having been derived.

**Coverage is two ratchets**, both in `src/docs/requestContracts.ts` and both enforced by
`tests/requestContractCoverage.test.ts` against the real router. `EXPECTED_UNCONVERTED`
counts operations with no contract and now stands at **3** — the health probes.
`EXPECTED_UNCLASSIFIED` counts operations accounted for by neither a contract nor a
reasoned entry, and is **0**; it must stay there. Two numbers because writing an
explanation must not look like progress: with one, the API could have reached zero by
documenting reasons instead of schemas.

**`noBody: true` is an assertion, not an inference.** The builder never removes
documentation it cannot itself produce. It once deleted the `requestBody` of any contract
without a `body` and silently erased the product image upload — a real multipart body Zod
never sees. So "I have no schema" and "there is nothing to send" are different claims, and
only the second licenses a deletion. Twelve operations were documented as *requiring* a
body they never read.

`src/docs/servedSpec.ts` builds the document once at import, which is also where a wiring
mistake surfaces: the build throws when a contract names an operation the document does not
define, or carries a refinement it has not written down, so the process refuses to start
rather than serve a document that quietly lost a rule.

`docs/openapi-derivation-diff.md` records what the derivation changed for consumers.
Nothing on the response side moved; the one thing a code generator notices is that 79 path
parameters became `string` matching `^\d+$` rather than `integer`, which is what they
always were on the wire.

### Endpoint-set drift (#47, #56)

`npm run check:api-docs` walks the **real Express router** — `routeTable`, plus the three
health probes mounted directly on the app — and compares that set against
`src/docs/openapi.ts` and `endpointDetailsManifest`. It fails three ways: served but
undocumented, documented but not served, and served but not in the manifest that drives
`tests/verification/endpointHealth.test.ts` (a route missing there is a route nothing
exercises).

Walking the router is the point. Both other lists are hand-maintained, so comparing them
to each other proves only that someone wrote the same thing down twice.

It found real drift on its first run: `POST /api/v1/auth/logout-all` was live, documented
nowhere and exercised by nothing, and `GET /api/v1/customers/{id}` was documented while
the router mounts only `PUT` and `DELETE` on that path — the spec promised an endpoint
that answers 404.

It now also checks the request shape: every served operation must have a contract or an
explicit entry in `unconvertedOperations`, and no operation may publish a
`additionalProperties: true` body — the absence of a description wearing a schema's
clothes, which is what all 86 documented bodies were before #102.

**What it does not claim.** That a *response* matches what the handler returns. Nothing in
this server validates a response, so there is nothing to compare one against.

### The manifest stays hand-maintained

`src/http/endpointManifest.ts` carries classification and authorization metadata that no
schema knows — which roles may call an operation is not inferable from what it accepts.
Keep it independent of contract conversion.

### Manifest authorization (#162)

`npm run check:route-auth` walks `createApp()` for each route's middleware chain and
compares it with the manifest entry's `authorization`. Before it existed they drifted
freely: feedback was `allAuthenticated` on a route with no auth at all, reservations were
`adminOrCashier` on token-only routes, and its first run found 14 entries weaker than their
routes plus a `GET /customers/:id` entry for a route nothing serves.

Only `verifyToken` and `requireRole(...)` are read. `requireRole` records its roles on the
function it returns (`rolesRequiredBy` in `middleware/auth.ts`) so the gate reads them
rather than re-parsing route source. A check made inside a controller is invisible here;
that belongs in the entry's `predicate`, which the gate does not compare. Auth middleware
on a sub-path `router.use('/x', ...)` or a router mounted outside `routeTable` makes the
walker throw rather than guess.

A disagreement is handled by direction:

- **Manifest weaker than the route** — correct the manifest.
- **Route weaker than the manifest** — a caller the manifest refuses gets in. That is an
  owner's security decision, so it is never settled by loosening the manifest. Each one is
  an entry in `UNDER_PROTECTED_ROUTES` with a reason, counted by `EXPECTED_UNDER_PROTECTED`
  (both in `src/http/endpointManifest.ts`). The list is exact in both directions: a new
  one fails, and a fixed one fails until its entry is removed. It stands at **0**: the
  first run found `GET /settings`, `GET /sales/:id`, `GET /exchanges` and
  `GET /exchanges/:id` token-only, and the owner gated all four to Admin + Cashier
  (`tests/http/underProtectedReadsRoleAuth.test.ts`). Cashier keeps `GET /settings`
  because POS checkout reads tax and loyalty settings from it.

`requireRole` ahead of `verifyToken` also fails: it reads `req.user`, which only
`verifyToken` sets, so the route refuses everyone.

### Client API paths (#162)

`npm run check:client-paths` parses `apps/dashboard/src` with the TypeScript parser for
every `transport.request({ method, path })`, `useApiQuery(key, path)` and
`resource(name)` hook, rebuilds the URL each builds, and matches it against the routes
`createApp()` serves with Express segment rules: a route `:param` matches anything, and a
client interpolation never matches a literal route segment.

- **Postponed features** (read from `postponedFeatures.ts`, never copied) are reported as
  known exceptions, not failures. Fix them before reactivating the feature.
- **A path or method that is not a literal** fails unless `RESOLUTIONS` in
  `scripts/checkClientApiPaths.ts` names the concrete calls that site makes; the resolved
  calls are then checked like any other, and a resolution matching no call site fails.
- **`useSave()`** sends POST without an id and PUT with one. Both served or neither is
  unambiguous; exactly one served needs a resolution saying which the page uses.

**What it does not claim.** That the *intended* handler answers. Express semantics are the
point, so a literal client segment matches a route parameter: `GET products/gone` counts as
served by `GET /products/:id`. The gate proves a route answers the URL, not that it is the
route the page meant.

Negative tests for both gates live in `tests/gates/`, and each gate fails on implausible
input (no manifest entries, no client calls, no postponed list) rather than passing empty.

## Public catalog (`/api/v1/catalog`)

Four anonymous GETs the storefront renders from (plan 2026-09-14-002, Unit 4):
`/products` (the one listing), `/categories`, `/collections`, `/collections/:slug`. A
separate module and prefix (`src/modules/commerce/catalog`, manifest
`publicEntry(['B', 'P'])`) rather than public routes in the postponed Admin-gated
storefront module, so "nothing under this prefix writes" stays structurally checkable.

**Whitelist rule.** No `SELECT *` / `p.*` in the module: every repository query names its
columns and a mapper builds each DTO. `products` carries `cost_price`, supplier and reorder
columns, no gate inspects responses, and these responses are publicly cached, so
`tests/catalog.test.ts` pins each DTO's exact key set and that no `id`, `sku`, `barcode`,
`stock` or `cost_price` appears anywhere in a body. A new field is a mapper change plus a
test change, deliberately.

- Only `status = 'active'` products with a slug; `inStock` follows `has_variants` (summed
  variant stock, else own stock); `isNew` is `NEW_IN_DAYS` (30, `constants.ts`), in SQL.
- Strict query grammar: unknown parameter, `category`/`collection`/`new` together,
  `sort=curated` without `collection`, `priceMin > priceMax`, a price not a multiple of 50,
  or `page` outside 1-500 is a 400. Page size is fixed at 24.
- An unknown category, or a collection that is missing, `upcoming` or `archived`, is a 404
  with **one shared body** (`CATALOG_NOT_FOUND_MESSAGE`), so slugs cannot be probed for
  unreleased collections. A known category with no products is an empty 200.
- Image URLs are absolute on the **origin** of `MEDIA_PUBLIC_BASE_URL`, never on the request
  Host / X-Forwarded-Host (a forged host would poison shared caches); absolute stored URLs
  pass through. Production refuses to boot without an absolute http(s) base
  (`assertProductionEnv`, called from `index.ts`, not from `getEnv()` -- tests read the
  environment under `NODE_ENV=production` for unrelated rules). Elsewhere it falls back to
  `http://localhost:$PORT`.
- Every read runs in a transaction under `SET LOCAL statement_timeout = '2000ms'`; a
  cancelled query (57014) is `503 SERVICE_UNAVAILABLE`, the eighth public code.
- 2xx (and 304) send `Cache-Control: public, max-age=60`; every other status `no-store`
  (`publicCacheOnSuccess`, decided at `writeHead`).

pg-mem cannot resolve correlated subqueries or LATERAL, so variant stock is a grouped LEFT
JOIN and gallery images are one follow-up query for the page's ids. It also returns **no
rows** for `status = 'active' AND slug IS NOT NULL` while the UNIQUE slug index exists and
statuses are mixed; `tests/support/pgMem.ts` rewrites `slug IS NOT NULL` to the equivalent
`NOT (slug IS NULL)` rather than the production SQL changing. A fixture whose rows all share
one status hides the bug. NUMERIC-as-string,
the timeout and plans are proven in `tests/concurrency/catalog.realpg.test.ts`.

**Indexes were measured, not assumed.** KD-17 planned four listing indexes; EXPLAIN on
8,000 products used only `idx_products_status_created (status, created_at DESC, id)`, for
`new=true`. The price, category and in-stock candidates were never chosen, so `014` does
not create them rather than pay for them on every write. Re-measure before adding one.

**Smoke-testing the storefront against a dev database:** run `npm run migrate` (014) and
`npm run seed` first — the seed carries the slugs, English names, the `evening` / `linen`
/ `silk` collections, the non-public `winter-tailoring` (upcoming) and `summer-2025`
(archived), and the empty `kimonos` category. Point `MEDIA_LOCAL_ROOT` at a scratch
directory for that API: a re-seed leaves no `image_url` references, and the
`orphaned-media-cleanup` run at boot would otherwise delete every tracked image older than
24h from `apps/server/uploads` (the same trap the e2e harness hit, root *Learnings*).

### The catalog limiter

Every storefront page is server-rendered, so every shopper's catalog read reaches the API
from the Next server's IP -- the tills' shared-IP problem pointed the other way. Catalog
GET/HEAD are therefore **exempt from the global limiter** (`isCatalogRead` beside the
health exemption, matched case-insensitively on `^/api/v1/catalog(/|$)` built from the
same `CATALOG_API_PREFIX` the router mounts, so `/API/V1/Catalog` cannot spend both budgets
and `/api/v1/catalogue` is not exempt) and budgeted by `createCatalogLimiter`, mounted by
the catalog router ahead of its cache middleware:

| Variable | Default | Meaning |
| --- | --- | --- |
| `CATALOG_RATE_LIMIT_MAX` | `300` | Per IP, per 15 min. |
| `CATALOG_SERVER_RATE_LIMIT_MAX` | `20000` | The one `catalog-server` bucket, per 15 min. |
| `CATALOG_SERVER_TOKEN` | unset | Comma list (current,next). Each entry >= 32 bytes or env validation fails. |

A request with exactly one `X-Catalog-Server-Token` matching a configured token (SHA-256
both sides, `timingSafeEqual` over every token) uses the trusted bucket; missing, wrong,
wrong-length or repeated headers are simply per-IP. Unset token: no trusted bucket, and
production warns at boot. **The trusted bucket is not a per-shopper limit** -- every SSR
request shares it, so per-client limiting belongs at the edge in front of Next (UD-5, B-9).
Ceilings fall back and warn exactly like `RATE_LIMIT_MAX`.

## Postponed modules: served, behind Admin

Branches, bundles, feedback, online orders, storefront and warranty are hidden in the
client but still mounted and documented here. The routes among them that were anonymous
or open to any token — `POST /online-orders`, `GET /online-orders/:id`, `POST /feedback`
and all three `/reservations` routes — are Admin-only while Storefront is postponed. An
anonymous order reserves POS stock, and nothing a customer can reach needs one yet.

Each gated route carries the lift rule in a comment: the gate lifts only when Storefront
ships, and only together with a named abuse control — a rate limit, or a hold cap where
stock is reserved. It must never go back to anonymous stock holds. `GET /storefront/banners`
stays public because it is a read with no side effects.

The **live** public surface is the separate `/api/v1/catalog` module (above), not these
routes: whitelisted reads with the catalog limiter as their named abuse control. Reads have
no side effects, so no hold cap applies. Nothing about it lifts a gate here.

## Scheduled jobs

Background maintenance runs through `apps/server/src/scheduler`, not through a `setInterval`
per process. Every instance still ticks on its own timer, but a tick only *offers* to run:
`runScheduledJob` takes a session-level advisory lock (so two runs cannot overlap) and then
claims the interval in the `scheduled_jobs` table with one conditional upsert (so a second
instance waking a second later does not repeat the work). Horizontal scaling therefore does
not multiply the work.

There is deliberately no job framework and no Redis. PostgreSQL is already required and
already provides both primitives; an external scheduler would be a component to run,
monitor and fail over for what is a single `DELETE`.

Every job reports an outcome, which is written to `scheduled_jobs.last_detail` and logged.
To see what the fleet has been doing:

```sql
SELECT name, last_started_at, last_finished_at, last_status, last_detail,
       run_count, failure_count
  FROM scheduled_jobs;
```

| Job | Cadence | Outcome |
| --- | --- | --- |
| `reservation-cleanup` | 5 min | `{ deleted }` — expired stock reservations removed |
| `orphaned-media-cleanup` | 24 h | `{ scanned, deleted, skippedRecent, failed }` |

Jobs must be idempotent: a failed run is retried on the next interval, and both jobs are
keyed on the current state of the world rather than on a cursor, so a retry that finds
nothing to do reports `0` rather than failing.

**A claim is written before the work, so a process killed mid-run leaves the row in
`running`.** Another instance takes that claim over once it is older than the job's
`staleAfterMs` (default 10 min) — safe because the takeover is only ever reached with the
advisory lock free, and a run that is genuinely in progress holds it. The lock, not the
row, is the authority on "is someone running this"; the row only decides "has this been
done recently enough". A takeover is logged, and means a previous run died without
recording anything.

Adding a job means adding a `ScheduledJob` to `src/scheduler/jobs.ts` with a **new, never
reused** `lockId` — during a rolling deploy two ids for the same job means two concurrent
runs.

## Media storage

Uploaded images go through the `StorageDriver` abstraction in `apps/server/src/storage`, never
straight to disk. The controller mints a key, hands the driver a buffer, and stores the URL
the driver returns; nothing above the interface knows where the bytes live.

`local` (filesystem) is the default. Its defaults reproduce the pre-abstraction behaviour
exactly — objects under `apps/server/uploads`, URLs of the form `/uploads/products/<name>` — so
**every image URL already in the database keeps working untouched**. It is durable in a
deployment only when `MEDIA_LOCAL_ROOT` points at storage that outlives the container and
is shared by every instance (a mounted volume or NFS).

`s3` targets any S3-compatible store — AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO.
They share one API, so the driver is written against the protocol rather than a vendor:
which one you are on is an endpoint and a credential, not a code path. Credentials come
from the environment and never from a committed file; omit both key variables to let the
SDK's default chain use an instance or container role, which is the better posture where
it is available.

**`s3` refuses to boot without `MEDIA_S3_BUCKET` and `MEDIA_PUBLIC_BASE_URL`**, rather than
falling back to `local` the way the numeric knobs fall back to their defaults. A fallback
would start an instance writing to a container filesystem while its operator believed
media was going to a bucket, and the loss would surface at the next redeploy — long after
the cause. There is likewise no default base URL: the bucket's URL shape differs per
provider and per path-style setting, and a wrong guess writes unreachable URLs into rows.

| Variable | Default | Meaning |
| --- | --- | --- |
| `MEDIA_STORAGE_DRIVER` | `local` | `local` or `s3`. |
| `MEDIA_LOCAL_ROOT` | `apps/server/uploads` | Root directory for the `local` driver. |
| `MEDIA_PUBLIC_BASE_URL` | `/uploads` | Prefix `publicUrl` puts in front of a key. **Required for `s3`, and absolute http(s) required in production** (the public catalog builds image URLs from its origin). |
| `MEDIA_ORPHAN_MIN_AGE_HOURS` | `24` | Grace period before the sweep may delete an unreferenced object. |
| `MEDIA_S3_BUCKET` | — | **Required for `s3`.** |
| `MEDIA_S3_REGION` | — | AWS infers the endpoint from it. |
| `MEDIA_S3_ENDPOINT` | — | Needed for R2 / Spaces / MinIO; AWS does not use it. |
| `MEDIA_S3_ACCESS_KEY_ID` / `MEDIA_S3_SECRET_ACCESS_KEY` | — | Omit **both** to use the SDK's default credential chain. |
| `MEDIA_S3_FORCE_PATH_STYLE` | `false` | MinIO and some gateways address buckets as a path segment. |

**Local development:** nothing to configure. `npm run dev` with no media variables set
writes to `apps/server/uploads` and serves `/uploads` exactly as before.

**Moving to a shared or remote store:** copy the existing `apps/server/uploads` tree into the
new store preserving keys, then point the config at it. Old rows hold relative
`/uploads/...` URLs and keep resolving through the `/uploads` mount, so the copy can happen
before or after the config change. Only set `MEDIA_PUBLIC_BASE_URL` to an absolute base
once the objects are actually reachable there; new rows will then hold absolute URLs while
old ones stay relative, and both remain valid.

**Lifecycle.** Validation and authorization run before anything is written (Admin only,
2 MB, JPEG/PNG/WebP, magic bytes must agree with the extension), the object is written
before the row that references it, and the replaced object is released only after the row
stops pointing at it. Each step's failure mode is a temporary orphan, never a broken image.
The daily `orphaned-media-cleanup` job is the backstop for orphans no request path could
clean up; it reads every `image_url` in the database first and aborts rather than delete
anything if that read fails **or if any URL that belongs to this store cannot be resolved
to a key** — an unresolvable reference is missing information, and a deletion routine must
never read missing information as "unreferenced" — and it never touches an object younger
than `MEDIA_ORPHAN_MIN_AGE_HOURS`. **A new table with an image URL column must be added to
the reference query in `src/scheduler/mediaSweep.ts`** — the sweep deletes what that query
does not return. `product_images.image_url` (014) is in it.

**Gallery and collection images** (plan 2026-09-14-002, Unit 3) use the same intake (Admin,
2 MB, magic bytes). `GET /api/v1/products/:id/images` (any token), `POST .../:id/images`,
`PUT .../:id/images/order` (one transaction) and `DELETE .../:id/images/:imageId`; a
product holds at most `PRODUCT_GALLERY_MAX` (8) gallery images besides its primary
`image_url`, and the ninth upload is a 409 with `details[].code` `GALLERY_FULL` and nothing
left stored. `products.image_url` stays the primary image POS and lookup read. Collections
gain `POST` / `DELETE /api/v1/collections/:id/image`, which deliberately **does not touch
`updated_at`**: that column is the optimistic-concurrency token for `PUT /collections/:id`,
whose body cannot carry `image_url`, so bumping it would turn every edit composed before
an upload into a spurious 409.

**A new driver's `ownsUrl` is the load-bearing half of that.** `keyFromUrl` returning
`null` conflates "somebody else's image" with "mine, and I could not read it"; the sweep
must abort on the second. A driver answering `false`/`null` to both would classify every
legacy `/uploads/...` row as unreferenced and delete the lot on its first run after a
migration. That is why `LEGACY_PUBLIC_PATH` is an owned prefix in the `s3` driver even
though it never writes that shape, and why `tests/storage.test.ts` asserts the sweep
*aborts* rather than deletes — verified by breaking `ownsUrl` and watching it fail.

## Refresh token rotation

Refresh tokens are stored as a SHA-256 digest, never in plaintext, and each login opens a
`family_id` that every rotation of that session stays inside. A refresh token is usable
**once**: `POST /api/v1/auth/refresh` invalidates the presented token, issues a successor
in the same family, and returns it as a new `refreshToken` cookie. The response body is
unchanged, and the cookie stays httpOnly, so no client change was needed.

SHA-256 rather than bcrypt because a refresh token is a signed JWT with a random `jti`,
not a human-chosen password: there is no dictionary for a work factor to slow down, while
bcrypt would add ~100ms to every refresh and, being salted, turn lookup from an index probe
into a full scan.

A successor **never extends the session**: it inherits the family's original `expires_at`,
so a session still ends `JWT_REFRESH_TTL_DAYS` after the login that created it.

Presenting an already-invalidated token revokes the **whole family** and returns the same
opaque 401 every other failure returns — a caller holding a stolen token cannot learn which
failure it hit, or whether the theft was noticed. The distinction is logged server-side,
with a digest prefix and never token material.

### The replay window, and why a replay returns an old token

Two tabs sharing one cookie jar both fire `/auth/refresh` the instant the access token
expires, and a client that never received its response asks again. Those honest cases
present an invalidated token routinely, so within `REFRESH_ROTATION_GRACE_SECONDS` a
presentation is treated as a **replay** and answered *idempotently, with the token that
rotation already issued* — not with a fresh one. Minting a fresh token for the second
caller would invalidate the one the first caller was already handed, and in a shared jar
the loser's `Set-Cookie` can land last: the next refresh would then carry a token revoked
minutes earlier, be classified as reuse, and log the user out everywhere. Converging both
callers on one token removes the choice. A replay writes nothing at all.

That is possible without storing plaintext because the successor is **derived**, not
randomly signed: its `jti` is `HMAC(refresh secret, digest of the presented token)`, `iat`
is suppressed and `exp` comes from the family's fixed expiry, which makes the token a pure
function of the token it replaces. Reuse detection is deferred by this, not weakened — a
thief and the legitimate holder converge on the same token, and whichever falls outside the
window first trips detection.

### Serialization

Every path that changes a user's sessions takes `SELECT ... FOR UPDATE` on the **user row
first**, then token rows: rotation, logout, global revocation, and the revocation that
follows detected reuse. Nothing may invert that order. Without the user lock, "revoke every
live session" is one statement whose snapshot is fixed when it starts, so a successor
inserted by a rotation committing a moment later is not in it and the session comes back.
Freshness is measured with `clock_timestamp()`, never `NOW()`: `NOW()` is fixed at
transaction start, so for the caller that loses the lock race it reads *earlier* than the
revocation it is compared against.

Revocation after a detected reuse runs in its own transaction *after* the rotation
transaction commits — throwing from inside would roll it back — and is best-effort: a
database fault there is logged as a security event but never turns the 401 into a 500.

### Cleanup

Rows are revoked, never deleted, until they expire: a revoked row is the evidence that
makes a later replay detectable, and a deleted one cannot tell "token I have never seen"
from "token I invalidated 20 minutes ago". `DELETE ... WHERE expires_at < NOW()` is swept
on login, throttled hourly per process and non-fatal.

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `JWT_ACCESS_TTL` | `15m` | Access-token lifetime. **Capped at 1h.** |
| `JWT_REFRESH_TTL_DAYS` | `7` | Session lifetime, and the ceiling no rotation extends. |
| `REFRESH_ROTATION_GRACE_SECONDS` | `60` | Replay window; `0` is strict no-grace rotation. |
| `COOKIE_SAMESITE` | `lax` | Case-insensitive; `none` forces `Secure`. |
| `COOKIE_DOMAIN` | unset | Unset means a host-only cookie, which is stricter. |

All five fall back to their default and warn rather than failing the boot, the same posture
as the rate-limit ceilings. The access TTL cap is not a style choice: an access token is
accepted on its signature alone, so `JWT_ACCESS_TTL=7d` would make logout, global
revocation and reuse detection no-ops for a week. The grace default is derived from the
case it absorbs — a client cannot even observe a dropped response until its HTTP request
times out, commonly 30s or more, so the previous 10s sat below the timescale of the failure
it existed for.

`POST /api/v1/auth/logout` ends the presented token's whole lineage;
`POST /api/v1/auth/logout-all` ends every session that user has, on every device. Neither
can reach an access token already issued, which is why that lifetime is short and capped.
