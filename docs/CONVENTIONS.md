# Conventions & Patterns

> This document was rewritten for the feature-slice refactor (2026-08-20-001). The previous version
> (pre-slice) is recoverable at `76a7ab0^` in git history. Sections below that are unaffected by the
> refactor (forms, formatting) are carried forward from it. The SQLite section it used to
> carry was deleted after the PostgreSQL migration made it wrong.

## Project Structure Rules

### File Extensions
- **Server**: `.ts` (TypeScript, run via `tsx`)
- **Client**: `.tsx` for components/pages, `.ts` for stores/services/hooks/utils

### Path Aliases
- `@/` maps to `client/src/` (configured in Vite + TypeScript)
- Example: `import { cn } from '@/shared/lib/utils'`

---

## Where does this file go? (R5 placement checklist)

Run this checklist, in order, for every new or moved client file. It is meant to be executable without
judgment — stop at the first question that matches.

1. **Is it used by two or more slices?** → `client/src/shared/`, in the subfolder matching its kind
   (`ui/`, `components/`, `hooks/`, `lib/`, `store/`, `i18n/`, `types/`).
2. **Is it the app shell or the composition root** (renders/wires more than one feature, e.g. routing,
   the sidebar, session bootstrapping)? → `client/src/app/`.
3. **Otherwise** → the one slice that uses it (`client/src/features/<slice>/`), in the folder matching
   its kind (`pages/`, `components/`, `hooks/`, `lib/`, `store/`, or `types.ts`). `lib/` is for
   slice-local **pure** logic — no React, no stores, no transport — the same role `shared/lib/`
   plays one layer up (e.g. `features/pos/lib/salePayload.ts`). If it is pure *and* a second slice
   needs it, it belongs in `shared/lib/` instead, by rule 1.
4. **Does another slice need it?** → export it from that slice's `index.ts`. Never import a path inside
   another slice's internals (`@/features/other-slice/pages/...`) — that is an
   `eslint-plugin-boundaries` violation once the file leaves its own slice.
5. **Colocate the test beside the unit** — `Thing.test.tsx` next to `Thing.tsx`, in whichever of the
   three layers the unit itself landed in.

This is the same rule R5 always specified; what's new here is that steps 1–4 are now also mechanically
enforced by `eslint-plugin-boundaries` + `eslint-import-resolver-typescript`, so a misplacement or a
deep cross-slice import fails `npm run lint`, not just code review. `npm run lint:cycles` (madge)
additionally catches import cycles that neither `tsc` nor Vite would fail on — every zustand store calls
`create()` at module scope, so a cycle surfaces as an undefined-on-import crash rather than a compile
error.

See `docs/ARCHITECTURE.md` for the full three-layer model and the current slice map.

---

## Shared components have one import path

A shared component is imported from the barrel, never from the directory it lives in:

```ts
import { DataTable, PageHeader, ConfirmDialog, Badge } from '../../shared'; // or '@/shared'
```

`client/src/shared/index.ts` re-exports `components/{forms,data-display,overlays,data-table,navigation}`
wholesale, so those five directories are an implementation detail: a component can move between them
without touching a single consumer. A deep import into one of them is a second path to the same
component, and `no-restricted-imports` in `client/eslint.config.mjs` fails the build for it.

The components still at the root of `shared/components/` (`BarcodeScanner`, `Receipt`,
`ErrorBoundary`, `PWAInstallPrompt`, …) are deliberately **not** in the barrel and are imported by
their own path. The lint rule names the five directories rather than all of `shared/components/`
for exactly that reason.

Two things follow that are easy to get wrong:

- **Don't re-add a shim.** `components/PageHeader.tsx` and three siblings used to be one-line
  `export * from './navigation/PageHeader'` files. They were a second canonical path, and the cost
  of having one showed up as a 45-line rewrite across 25 files when they were removed (#56).
- **Don't re-export anything heavy from the barrel.** See the comment at the top of
  `client/src/shared/index.ts`: a barrel re-export puts a module one `export *` away from every
  consumer, and tree-shaking is the only thing keeping it out of their chunks.

---

## Global string-coupling contract

Some cross-cutting concerns are deliberately **not** slice-scoped or namespaced. This is a documented
decision, not an oversight — do not "fix" it as a drive-by during unrelated work.

- **The five zustand persist keys** — `moon-auth`, `moon-cart-recovery`, `moon-held-carts`,
  `moon-offline-queue`, `moon-settings` — are literal `localStorage` keys with no per-slice namespace.
  They are centralized as named constants in `client/src/shared/lib/storageKeys.ts` so the flat
  namespace is visible in one file, but the *values* are unchanged and must stay unchanged: renaming any
  of them drops persisted state (cart, session, offline queue, settings) for every existing user on
  their next load. Namespacing them is legitimate follow-up work; it is not in scope for the slice
  refactor because R13 forbids user-visible behavior changes.
- **The shared React Query key `['settings']`** is used by three different slices —
  `features/admin/pages/Settings.tsx`, `features/customers/components/CustomerDetail.tsx`, and
  `features/pos/components/CartPanel.tsx` — all reading/invalidating the same server-side settings
  resource. This is intentional cache sharing, not an accidental collision; each call site comments the
  sharing at its use.
- **Route path strings are duplicated** between the file-based route tree under
  `client/src/routes/` (the router's source of truth — the path *is* the filename, and
  `routeTree.gen.ts` is generated from it) and `client/src/app/Sidebar.tsx`'s `navItems[]` (the nav
  source of truth, which also carries icons, labels and role gates the router doesn't need). A renamed
  route therefore means renaming a file *and* editing the sidebar by hand, with nothing checking they
  still agree. Deriving the nav from the route tree is legitimate follow-up work.
- **The two global i18n files** (`shared/i18n/en.json`, `shared/i18n/ar.json`, ~180 keys each) are not
  split per slice. Every slice's copy lives in the same flat `section.action` keyspace (see Naming
  Conventions below). This was a pre-existing pattern before the refactor and stays that way: splitting
  translation files per slice is a larger, separate change (loader wiring, lazy-loading translations
  alongside lazy-loaded routes) that this refactor did not attempt.

Treat all four of the above as a deliberate, currently-flat global namespace. If you're adding to one of
them, follow its existing shape; if you're tempted to namespace or split one of them "while you're in
there," raise it as its own change instead.

---

## Checkout ownership contract

Every value a checkout is made of has exactly **one** owner. This is not tidiness: the cart footer
once added tax but ignored points and tip while the drawer subtracted both, so a cashier balanced
split payments against a figure that was not what the customer owed.

| Value | Owner |
| --- | --- |
| Every money figure (subtotal, discounts, tax, tip, amount due, earned points) | `shared/lib/checkout.ts`'s `calculateTotals`, called once per render by `features/pos/hooks/useCheckoutPricing.ts` |
| Tax and loyalty policy (parsed from the settings row) | `features/pos/lib/checkoutSettings.ts` |
| Loyalty redemption state (toggle + point count) and its cap | `useCheckoutPricing` — the count is meaningless apart from the cap that clamps it |
| Split-tender allocation and whether it balances | `useCheckoutPricing`'s `split` |
| The sale body and the reduced offline body | `features/pos/lib/salePayload.ts`, both from one `SaleComposition` |
| The receipt | `features/pos/lib/saleReceipt.ts`, from the server's confirmed response only |
| Submission, idempotency keying, receipt state, offline fallback | `features/pos/hooks/useCheckoutSubmission.ts` |

Rules that follow from it:

- **A component never derives money.** `CartPanel`, `CartFooter`, `CheckoutSummary`,
  `PaymentSection` and the customer display all read the same `totals`/`split` objects. If you find
  yourself writing arithmetic on prices in a component, the figure belongs in `calculateTotals`.
- **The cart store holds inputs, not outcomes.** It owns items, discount, coupon code/amount, tip
  and notes. It deliberately no longer exposes `getTotal()` or `getSubtotal()` — both were float
  re-derivations of figures `calculateTotals` already produces in minor units. Read
  `totals.subtotal` / `totals.amountDue` instead.
- **The receipt never recomputes.** Only the product *name* is looked up against the cart; every
  amount comes from the response.

---

## Offline queue replay contract

The persisted `moon-offline-queue` holds sales a till rang up but could not post. Four invariants
govern how they are replayed; `client/src/shared/hooks/useOffline.ts` and
`client/src/shared/store/offlineStore.ts` implement them, and a change to either should keep them.

1. **Every queued entry has a unique, opaque id.** Ids come from `createQueueItemId()`, not from
   `Date.now()` — two sales rung up in the same millisecond used to share an id, and syncing one
   silently deleted the other. Widening `id` to `string | number` only made old entries
   *addressable*; `migrateQueueIds` on rehydrate is what makes them *unique*, and it is what closes
   the defect for the tills that already have queued money.
2. **A failed replay is classified before it is counted.** `client/src/shared/lib/offlineRetry.ts`
   is the single place that decides retryable vs terminal, and owns the backoff policy. A new
   server error code that should be retried is added there and nowhere else.
3. **A retryable failure backs off; a deterministic one parks immediately.** Backoff doubles from
   `RETRY_BASE_MS` to `RETRY_CEILING_MS` with ±`RETRY_JITTER` (tills in one shop reconnect on the
   same event and must not retry in lockstep), for at most `MAX_RETRYABLE_ATTEMPTS` — currently
   about 43 minutes of trying. If you change either constant, recompute that figure: the budget is
   sized to outlast a routine server restart, and the ladder reaching the ceiling is what makes it
   do so. Auto-sync is driven by a timer keyed on the earliest due entry — when nothing is
   eligible, no timer is armed at all.
4. **A parked entry is never dropped.** It keeps its payload *and its idempotency key*, and only
   an explicit cashier Retry (`clearRetryState`) revives it.

The retry budget is deliberately generous **because** every replay carries the same
`Idempotency-Key` (see `docs/plans/2026-08-30-002-fix-pos-concurrency-idempotency-plan.md`, Unit 9),
so retrying cannot double-charge. The two decisions are coupled: anyone removing the key would have
to shrink the budget. That coupling is enforced per entry, not just by convention — an entry with
no `idempotencyKey` (queued in the window between the `contractVersion` and idempotency-key
deploys) is parked on its **first** failure rather than replayed, because each unguarded retry of a
sale that may already have committed is another charge.

Two things the scheduler must keep doing, both learned the hard way: a replay carries an explicit
deadline (the axios instance sets no timeout, and one black-holed request otherwise holds the
in-flight guard for the life of the tab, silently freezing the queue), and reconnect-driven retries
are throttled (attempts are spent per `online` event, so a flapping link would otherwise burn a
40-minute budget in seconds and park healthy sales).

**Persisted-field rule.** A new field on a queue entry is optional and documents what its *absence*
means for an entry persisted before it existed. `contractVersion`, `idempotencyKey` and the retry
fields all follow this shape; it is what lets a cashier update mid-shift without stranding a queue.

---

## Partial-update contract (server)

Every `PUT /:id` in this codebase is **PATCH-style**: a field the body omits is left alone,
a field it sets to `null` is cleared. This is a contract, not an implementation detail, and
it exists because the alternative produced a silent data-loss bug (#78).

The shape to recognise and never write again:

```ts
// The create schema. Every field optional, some with defaults.
const thingSchema = z.object({ name: z.string(), is_featured: z.boolean().optional() });
// The update handler re-parses with it...
const parsed = thingSchema.parse(req.body);
// ...and the repository SETs every column from it.
`UPDATE things SET name = $1, is_featured = $2 ...`
```

A body that names three of four fields parses cleanly — the missing one is optional, so it
is not a validation error — and the fourth column is then written back as its default. The
request returns 200 and a field nobody mentioned is gone, with nothing in the logs. An audit
in #78 found this in fourteen update paths; four were losing data in production.

**The rules.**

1. An update endpoint gets its **own** schema, never the create schema. Name it
   `<thing>UpdateSchema` and export it, so a test can assert on it directly.
2. That schema carries **no `.default()`**. A default is exactly what turns "absent" back
   into "write this value", and it does so below the point where the repository could tell
   the difference.
3. Nullable columns are `.nullable().optional()` — the schema has to distinguish *absent*
   from *explicitly null*, because they mean different things.
4. The repository builds its SET clause with `buildPartialUpdate`
   (`server/src/database/partialUpdate.ts`). Guard on `!== undefined`, never on truthiness:
   `0`, `''` and `false` are values a caller needs to be able to set.
5. Nullable text columns pass through `orNull`, which preserves the existing "an empty
   string means NULL" behaviour for a *present* field while leaving an absent one absent.
6. Anything the update DTO drops from the create DTO is a **separate interface**
   (`UpdateThingDTO`), not `export type UpdateThingDTO = CreateThingDTO`. The alias is what
   let the two shapes drift into one in the first place.
7. If a service validates a cross-field invariant (a percentage ceiling, a date range), it
   validates the **effective row** — the stored values merged with the body — not the body
   alone. A partial body can otherwise walk past a check by simply not mentioning the field
   the check reads.

**The client side of the same contract.** `resource().useSave` PUTs exactly the keys a page
put in its draft, so every page already sends a partial body. A dialog therefore sends what
it *changed*, not a re-serialization of the record it happens to be holding. Echoing back
fields the dialog does not own is what made #78 reachable, and it widens the window for
overwriting a concurrent edit (#81).

**Still to convert.** Ten update paths carry the old shape but are not losing data today —
their client sends a full body, or 400s before reaching the repository: customers, segments,
storefront banners, branches, delivery orders, expenses, bundles, distributors, label
templates, products (and product variants), stock-count items. Any change to one of those
clients' payloads makes its module's loss live, so convert the server side first.

## When to split or merge a slice

Split a slice when **both** of these are true:
- it has grown to roughly 25+ files, **and**
- its pages/components partition cleanly into two non-overlapping entity sets (not just "this feels
  big").

Size alone is not sufficient — a large slice with one coherent entity type is not a split candidate.

**Watch item, not a split today:** `fulfillment` mixes two different audiences under one slice —
internal delivery/order management (`Deliveries`, `OnlineOrders`) and the customer-facing `Storefront`
page. If `Storefront` grows its own supporting components/hooks, this is the slice to revisit first.

**Explicitly not a concern today:** `analytics` was flagged in the original refactor proposal as a risk
("analytics structurally reads every other slice, so its barrel will keep widening"). A full import-
graph pass during the refactor found this is empirically false — `analytics` imports nothing from any
other slice, only from `shared/`. Don't preemptively defend against a pressure that isn't showing up in
the actual import graph; re-verify with a real search before treating this as live.

---

## Component Patterns

### Page Components

> **Migration status:** `resource()` is the current pattern for CRUD-shaped pages and is what new pages
> should use. A small number of pages still use `useApiQuery` directly for reads that are not CRUD
> collections (analytics, AI, reports, exports) — that is the *intended* long-term shape for those, not
> a pending migration. Neither pattern imports axios or any HTTP client directly; both go through
> `useTransport()` (`shared/lib/transport/`).

#### `resource()` — CRUD-shaped pages

A page names its server collection once and gets reads and writes back. It never constructs a URL,
unwraps the `{ success, data, meta }` envelope, learns the error shape, or decides what to invalidate:

```tsx
import { resource } from '@/shared/lib/resource';

const expenses = resource<Expense, { total_amount: number }>('expenses');

export default function ExpensesPage() {
  const { data: rows, meta } = expenses.useList({ limit: 100 });
  const pnl = expenses.useRead<PnLData>('pnl', undefined, tab === 'pnl');

  const saver = expenses.useSave({
    message: t('expenses.created'),        // toasted on success
    fallbackMessage: t('expenses.saveFailed'),  // used when the server says nothing
    onDone: () => setDialogOpen(false),
  });

  const remover = expenses.useRemove({ message: t('expenses.deleted') });

  saver.save({ id: editingId, ...form });  // no id → create, id → update
}
```

Hooks: `useList(params)`, `useOne(id)`, `useRead(segment, params, enabled)`,
`useSave(opts)`, `useRemove(opts)`, `useAction(name, opts)`. Writes invalidate
the resource's own reads automatically — never call `invalidateQueries` in a page.

Endpoints that are not CRUD collections (analytics, AI, reports, exports) should
use `useApiQuery` directly rather than widening `resource` to cover them.

In tests, inject `createMemoryTransport()` via `<TransportProvider>` — no axios
stubbing and no request-mocking library. Axios itself is not importable from application code — it is
banned by `no-restricted-imports` in `client/eslint.config.mjs`; all HTTP goes through
`shared/lib/transport/`.

#### `useApiQuery()` — non-CRUD reads

```tsx
import { useApiQuery } from '@/shared/lib/apiQuery';

const { data: settings, isLoading } = useApiQuery<AppSettings>(['settings'], 'settings');
```

Same transport, same envelope-unwrapping, same error normalization as `resource()` — it just doesn't
assume the endpoint is a CRUD collection with list/save/remove semantics.

### Loading States
- Eager pages: direct rendering (no Suspense wrapper needed)
- Lazy pages: wrapped in `<Suspense fallback={<div>Loading...</div>}>`
- All pages wrapped in `<ErrorBoundary>` inside `<ProtectedRoute>`

### Component Types
- **All UI components**: Functional with hooks
- **Exception**: `ErrorBoundary` (`shared/components/ErrorBoundary.tsx`) is a class component (React
  limitation), and uses the standalone `t()` function instead of `useTranslation()` for that reason.

---

## Server Route Patterns

### Standard CRUD Route File

```typescript
import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth';
import { controller } from './controller';

const router = Router();

// List
router.get('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  controller.list(req, res, next)
);

// Create
router.post('/', verifyToken, requireRole('Admin'), (req, res, next) =>
  controller.create(req, res, next)
);

export default router;
```

### Express Route Ordering (Critical)

**Specific routes MUST be defined before parameterized routes:**

```typescript
// CORRECT
router.get('/stats/summary', handler);  // specific first
router.get('/current', handler);        // specific first
router.get('/:id', handler);            // parameterized last

// WRONG — /:id catches "stats", "current" as id values
router.get('/:id', handler);
router.get('/stats/summary', handler);  // never reached
```

### Database Queries

PostgreSQL via `pg`. Every mutation routes through `withTransaction`, which accepts an
already-open client so a service can join its caller's transaction rather than opening a
second one.

```typescript
const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

await withTransaction(async (client) => {
  await repo.createSale(data, client);
  await repo.createSaleItem(item, client);
});
```

### Concurrency and idempotency

The pool runs at `READ COMMITTED`. That is atomic against torn writes but **not** against
lost updates, so these three rules are what keep quantities and balances correct. The next
read-then-write is the next oversell.

**1. Never write a quantity or balance you read earlier in the same request.**

```typescript
// WRONG — two concurrent callers both read 5, both write 3, and four units vanish.
const product = await repo.getProductById(id, client);
if (product.stock < qty) throw new Error('Insufficient stock');
await repo.updateProductStock(id, product.stock - qty, client);

// RIGHT — one statement decides. rowCount 0 means it did not fit.
// Cast the parameter: pg-mem inverts `column - $1` unless it is typed.
const newStock = await repo.decrementProductStock(id, qty, client);
if (newStock === null) throw new InsufficientStockError(...);
```

An earlier check may stay as a fail-fast courtesy — a better error, sooner — but it is
advisory. The guarded write is the authority, and the audit trail derives from its
`RETURNING` value, not from the earlier read.

**2. Reach for `SELECT ... FOR UPDATE` only when the invariant spans rows.** Coupon
`max_uses` counts rows in `coupon_usage`; a cumulative refund compares against sibling
refunds. Neither fits in one conditional write, so lock the parent row (`coupons`,
`sales`) and let it serialize the counters. Consuming paths only — a preview that takes a
lock blocks live checkouts for no benefit.

**3. Take locks in an order that cannot cycle against any other path.**

The rule that is mechanically enforced: **all product and variant rows a transaction
touches are locked in one pass, sorted by `sortForStockWrites`**
(`server/src/modules/pos/stockWriteOrder.ts`). Every path that mutates stock must route
through that one comparator — two concurrent checkouts naming the same products in
opposite request order would otherwise deadlock. A path with more than one stock phase
(an exchange restocks returns and deducts new items) must sort the **combined** set;
sorting each phase separately still lets two callers interleave them in opposite order.

The order the paths actually take across resource *kinds* is per-path, not global:

| Path | Order |
| --- | --- |
| checkout | `idempotency_keys` → `coupons` (FOR UPDATE) → `sales` → `products`/`variants` → `customers` → `register_sessions` |
| refund | `idempotency_keys` → `sales` (FOR UPDATE) → `products` → `register_sessions` |
| exchange | `idempotency_keys` → `exchanges` → `products`/`variants` |
| gift card | `idempotency_keys` → `gift_cards` |

These do not cycle against each other today, because no two of them take the same pair of
kinds in opposite order. That is a weaker invariant than a single global order, so when
adding a path, check it against this table rather than assuming one exists.

`withTransaction` accepts an opt-in bounded retry on SQLSTATE `40001`/`40P01`, enabled by
`withIdempotency` for the whole business transaction. It re-runs the callback, so it is
only safe while every non-transactional side effect stays in the controller, after the
transaction — which is also why notifications and audit writes live there.

**Retry-prone mutations take an `Idempotency-Key`.** Wrap them in `withIdempotency`
(`server/src/http/idempotency.ts`), which claims the key as the first statement inside the
business transaction so the claim shares its fate: a commit makes the outcome replayable,
a failure releases the key. Keep slow work (notifications, audit writes, external calls)
outside the transaction, and suppress it on a replay — see `SalesController.createSale`.

The header is optional while `IDEMPOTENCY_REQUIRED` is false. See `CLAUDE.md` for the
compatibility window and for running the real-PostgreSQL suites, which are the only place
these invariants can actually be proven.

### Response Format

JSON endpoints use the helpers in `server/src/modules/http/`. File downloads and operational
endpoints keep their purpose-specific representation.

```typescript
// Singleton / mutation success
res.json(success(result));

// Paginated collection success
res.json(success(rows, {
  pagination: paginationMeta(query.page, query.pageSize, total),
}));

// Delete success
res.status(204).send();

// Expected domain error; centralized middleware creates { error: { code, message, details? } }
throw new PublicError('NOT_FOUND', 'Product not found');
```

Collection queries use flat camelCase parameters: `page`, `pageSize`, `search`, `sortBy`,
`sortOrder`, plus documented resource filters. Parse them with a strict schema based on
`createListQuerySchema`; unknown parameters and legacy `limit`/snake_case filters are rejected.

---

## Styling

### Tailwind Class Merging

Use the `cn()` utility (from `shared/lib/utils.ts`) to merge classes:

```tsx
import { cn } from '@/shared/lib/utils';

<div className={cn('base-classes', conditional && 'extra-classes', className)} />
```

`cn()` combines `clsx` (conditional classes) with `tailwind-merge` (deduplication).

### RTL-Safe Properties

Always use logical properties instead of physical ones:

| Physical (avoid) | Logical (use) |
|-------------------|---------------|
| `ml-4` | `ms-4` |
| `mr-4` | `me-4` |
| `pl-4` | `ps-4` |
| `pr-4` | `pe-4` |
| `left-0` | `start-0` |
| `right-0` | `end-0` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `border-l` | `border-s` |
| `border-r` | `border-e` |

### CSS Variables

Theme colors are defined as CSS variables in `app/index.css` and referenced via Tailwind:

```css
/* app/index.css */
:root { --background: 0 0% 100%; }
.dark { --background: 240 10% 3.9%; }
```
```html
<!-- Usage -->
<div class="bg-background text-foreground" />
```

---

## i18n

### Translation Keys

```tsx
const { t, locale, isRtl } = useTranslation();

// Simple
t('nav.dashboard')  // → "Dashboard" or "لوحة التحكم"

// With interpolation
t('items.count', { count: 5 })  // "5 items" — key uses {count}

// Standalone (for class components, Zod schemas)
import { t } from '@/shared/i18n';
```

### Adding New Keys

1. Add key to both `client/src/shared/i18n/en.json` and `ar.json`
2. Use `{param}` syntax for interpolation
3. Follow existing naming: `section.action` (e.g., `inventory.addProduct`)

Keys are global (not slice-scoped) — see "Global string-coupling contract" above for why.

---

## Forms & Validation

### Client-Side (React Hook Form + Zod)

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

const form = useForm({ resolver: zodResolver(schema) });
```

### Server-Side (Zod)

Validators are in `server/validators/`. Parse request body before processing:

```typescript
import { productSchema } from '../validators/productSchema';

const parsed = productSchema.safeParse(req.body);
if (!parsed.success) {
  throw parsed.error;
}
```

---

## Formatting

### Currency
- Locale-aware: `ar-SA` (Arabic) or `en-US` (English)
- Always Western Arabic numerals (not Eastern Arabic)
- Use `Intl.NumberFormat` with currency style

### Dates
- `date-fns` for formatting and manipulation
- Locale passed based on `settingsStore.locale`

---

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Page files | PascalCase | `SalesHistory.tsx` |
| Component files | PascalCase | `CartPanel.tsx` |
| Store files | camelCase | `authStore.ts` |
| Slice barrel | `index.ts` | `features/pos/index.ts` |
| Route files (server) | camelCase | `purchaseOrders.ts` |
| DB migrations | `NNN_snake_case.sql` | `042_layaway.sql` |
| API paths | kebab-case | `/api/stock-adjustments` |
| DB columns | snake_case | `created_at` |
| TS variables | camelCase | `isLoading` |
| React components | PascalCase | `<DataTable />` |
| Translation keys | dot.notation | `nav.dashboard` |
| Zustand stores | `use[Name]Store` | `useAuthStore` |

---

## Adding a feature

Paths, not prose — the previous version of this section named `server/db/migrations/`,
`server/routes/`, `client/src/app/App.tsx` and `FEATURES_ROADMAP.md`, of which the first
two moved and the last two do not exist. A checklist that sends people to the wrong
directory is worse than none.

**Server**

1. **Migration** — `server/src/database/migrations/NNN_name.sql`, plus a matching
   `NNN_name.down.sql`. The down file is not optional: CI rolls every migration back and
   re-applies it (`npm run verify:migrations`). If the down genuinely changes nothing, say
   `Intentionally a no-op.` in it — that marker is load-bearing.
2. **Module** — `server/src/modules/<domain>/<module>/` with `routes.ts`, `controller.ts`,
   `service.ts`, `repository.ts`, `types.ts`. Validation lives in the controller as a Zod
   schema; the update schema is a genuine partial and is `.strict()` where it has been
   tightened.
3. **Register** — add the router to the module manifest, not to `index.ts` by hand.
4. **Errors** — throw `PublicError` from the service with the code you mean. Never let a
   controller recover a status by reading a message; see *Error contracts* in `CLAUDE.md`.
5. **Apply it** — `cd server && npm run migrate`.

**Client**

6. **Page** — `client/src/features/<slice>/pages/Feature.tsx`. Run the R5 placement
   checklist above if it is not obviously one slice's.
7. **Route** — routing is file-based (TanStack Router): add a file under
   `client/src/routes/`. `routeTree.gen.ts` is generated; never edit it.
8. **Barrel** — export from the slice's `index.ts` only if `app/` or another slice needs it.
9. **Sidebar** — add an entry to `navItems[]` in `client/src/app/Sidebar.tsx`.
10. **i18n** — add keys to **both** `en.json` and `ar.json`. A key present in one and not
    the other renders the key name to a user.
11. **Shared components** — import from the barrel (`@/shared`), never from the directory a
    component happens to live in. See *Shared components have one import path* above.

### Route ordering

Within a route file, specific paths must come before `/:id`, or `/products/categories`
resolves as a product with the id "categories".

---

## E2E test conventions

Rules for `e2e/` that will otherwise erode. Full detail and the run instructions live in
`e2e/README.md`.

### Locators

- **Build them from the i18n catalog**, never from hardcoded user-facing strings. The app
  ships Arabic RTL by default, so an English literal tests a configuration most tills never
  run. `support/i18n.ts` throws on a missing key rather than falling back, so a rename fails
  loudly instead of matching nothing.
- **A missing accessible name is a defect, not a reason for a test id.** Fix the name first.
  A test id is for surfaces that genuinely have none — a cart line container, a bare number.
- **Every production `data-testid` carries a one-line comment** saying why a role query was
  insufficient. There are six; adding a seventh should feel like a decision.
- Some `aria-label`s in `CartPanel` are hardcoded English rather than `t()` calls
  ("Increase quantity", "Remove item", "Remove coupon"). Those are deliberately *not* read
  from the catalog — they do not change under `ar`, and pretending otherwise breaks the RTL
  spec.

### Assertions

- **Every money assertion is two-sided**: the value the cashier sees *and* the persisted
  row. One POST that writes two rows and two POSTs that write one are different bugs, and
  each looks fine from one side.
- **Expected totals come from `contracts/checkout-totals.v1.json`**, never hardcoded. Both
  calculators are already proven against that file; restating a number here would put the
  money rules in a third place. Where the contract deliberately names no case — caps and
  clamps — assert the documented *behaviour* instead.
- **Complete a sale through `completeSaleAndReadId`.** Reading "the latest sale for this
  cashier" is unsafe on its own: a confirm click that lands before the drawer opens creates
  no sale, and the assertion then reads a neighbouring test's row and reports a money
  mismatch. The helper pins the count either side.
- **Never assert on a global aggregate.** Scope every count to the worker's own cashier,
  product or session, or it races every other worker.

### Isolation

- Every test creates the rows it mutates. A spec may *authenticate* as a seeded account but
  must never mutate its shift, register or sale state — those are one-per-user and two
  workers on the same drawer will race.
- Worker accounts are namespaced by `E2E_RUN_ID` as well as worker index, because
  `--shard` restarts `workerIndex` at 0 per shard and `users.email` is UNIQUE.
- **Only `tax-loyalty.spec.ts` writes `PUT /api/v1/settings`,** and only from the serial
  `pos-settings` project. Tax and loyalty are global rows; a write from a parallel worker
  silently changes the totals every other worker is asserting on. Every settings write is
  followed by a reload — the client caches settings for five minutes, so a page loaded
  before the write keeps submitting under the old mode and the assertion passes for the
  wrong reason.

### The `@smoke` subset

The pull-request gate, budgeted under three minutes. Adding to it is a deliberate decision
with a cost; if it grows past the budget, move cases out rather than raising the budget.
`scripts/assertSmokeTestsRan.mjs` fails the build if the tag ever matches nothing, because
a green run of zero tests is the failure mode most likely to go unnoticed.

## Git Workflow

- **Always branch from `main`** before starting a feature
- Use descriptive branch names: `feature/add-distributors`, `fix/login-bug`
- Commit frequently with clear messages
- Merge back to `main` via PR when complete
