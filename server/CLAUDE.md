# Server (`server/`)

Subsystem contracts for the Express + PostgreSQL API. These load when you work under
`server/`; the always-loaded root `CLAUDE.md` holds the project-wide rules.

## Migration verification

```bash
cd server && MIGRATION_TEST_DATABASE_URL=postgresql://.../moon_store_migrations_test npm run verify:migrations
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
the wording. Services throw `PublicError` with one of the seven public codes, and the
controller's `catch` passes it to `next` unchanged.

Before #47 this was inverted: services threw bare `Error`s and controllers recovered the
status by testing the message. `layaway` chose 404 on `message.includes('not found')`, and
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

**Coverage is a ratchet**, `EXPECTED_UNCONVERTED` in `src/docs/requestContracts.ts`,
enforced by `tests/requestContractCoverage.test.ts` against the real router. It fails in
both directions: raising it means a route landed with no contract, and leaving it above the
true count means it has stopped ratcheting — the same rule as the lint ratchet in the root
`CLAUDE.md`. Lower it in the same commit that converts a module.

Still outstanding: `index.ts` serves the hand-written document, not the built one. The
cutover waits until coverage is complete so the spec never spends time half-derived, and
`scripts/generateOpenApi.ts` — the regex scraper, which produces nothing anyone serves —
goes at the same time.

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

**What it does not claim.** It compares `METHOD path` pairs and nothing else. For an
operation with no request contract yet, a documented body can still disagree with its
validator while this passes.

### The manifest stays hand-maintained

`src/http/endpointManifest.ts` carries classification and authorization metadata that no
schema knows — which roles may call an operation is not inferable from what it accepts.
Keep it independent of contract conversion.

## Scheduled jobs

Background maintenance runs through `server/src/scheduler`, not through a `setInterval`
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

Uploaded images go through the `StorageDriver` abstraction in `server/src/storage`, never
straight to disk. The controller mints a key, hands the driver a buffer, and stores the URL
the driver returns; nothing above the interface knows where the bytes live.

`local` (filesystem) is the default. Its defaults reproduce the pre-abstraction behaviour
exactly — objects under `server/uploads`, URLs of the form `/uploads/products/<name>` — so
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
| `MEDIA_LOCAL_ROOT` | `server/uploads` | Root directory for the `local` driver. |
| `MEDIA_PUBLIC_BASE_URL` | `/uploads` | Prefix `publicUrl` puts in front of a key. **Required for `s3`.** |
| `MEDIA_ORPHAN_MIN_AGE_HOURS` | `24` | Grace period before the sweep may delete an unreferenced object. |
| `MEDIA_S3_BUCKET` | — | **Required for `s3`.** |
| `MEDIA_S3_REGION` | — | AWS infers the endpoint from it. |
| `MEDIA_S3_ENDPOINT` | — | Needed for R2 / Spaces / MinIO; AWS does not use it. |
| `MEDIA_S3_ACCESS_KEY_ID` / `MEDIA_S3_SECRET_ACCESS_KEY` | — | Omit **both** to use the SDK's default credential chain. |
| `MEDIA_S3_FORCE_PATH_STYLE` | `false` | MinIO and some gateways address buckets as a path segment. |

**Local development:** nothing to configure. `npm run dev` with no media variables set
writes to `server/uploads` and serves `/uploads` exactly as before.

**Moving to a shared or remote store:** copy the existing `server/uploads` tree into the
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
does not return.

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
