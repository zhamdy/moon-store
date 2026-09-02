# Conventions & Patterns

> This document was rewritten for the feature-slice refactor (2026-08-20-001). The previous version
> (pre-slice) is recoverable at `76a7ab0^` in git history. Sections below that are unaffected by the
> refactor (server routes, SQLite gotchas, forms, formatting) are carried forward from it.

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
- **Route path strings are duplicated** between `client/src/app/App.tsx`'s `RouteConfig[]` table (the
  router source of truth) and `client/src/app/Sidebar.tsx`'s `navItems[]` (the nav source of truth,
  which also carries icons, labels and role gates the router doesn't need). Both live in `app/`, so
  there is no cross-layer coupling — but a renamed route requires editing both files by hand. Unifying
  them into one route-registry module is legitimate follow-up work, out of scope here.
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

## SQLite Gotchas

### ALTER TABLE Limitations

SQLite cannot `ALTER TABLE` with `REFERENCES`, `DEFAULT`, or `CHECK` in one statement:

```sql
-- WRONG: will fail
ALTER TABLE products ADD COLUMN distributor_id INTEGER REFERENCES distributors(id) DEFAULT NULL;

-- CORRECT: split into two
ALTER TABLE products ADD COLUMN distributor_id INTEGER;
UPDATE products SET distributor_id = NULL;
```

### Enforce Constraints in App Code

SQLite `ALTER TABLE` doesn't support adding `CHECK` constraints. Validate in the application layer instead.

### Transaction Pattern

```typescript
const rawDb = db.db;
const doWork = rawDb.transaction(() => {
  // multiple statements here
});
doWork();  // invoke the transaction
```

---

## Adding New Features

### Checklist

1. **Migration**: Create `server/db/migrations/NNN_feature.sql`
2. **Route**: Create `server/routes/feature.ts` with CRUD endpoints
3. **Register route**: Add import + `app.use()` in `server/index.ts`
4. **Validator** (optional): Create `server/validators/featureSchema.ts`
5. **Page**: Create `client/src/features/<slice>/pages/Feature.tsx` (run the R5 checklist above if it's
   not obviously one existing slice's)
6. **Barrel**: Export the page from that slice's `index.ts` only if `app/` or another slice needs it
7. **Route config**: Add route in `client/src/app/App.tsx` (lazy or eager)
8. **Sidebar**: Add entry to `navItems[]` in `client/src/app/Sidebar.tsx`
9. **i18n**: Add keys to both `en.json` and `ar.json`
10. **Roadmap**: Update `FEATURES_ROADMAP.md`
11. **Run migrate**: `cd server && npm run migrate`

### Route Ordering Reminder

When adding routes in `server/index.ts`, order doesn't matter since each route file has its own prefix. But **within** a route file, specific paths must come before `/:id`.

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
