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
   its kind (`pages/`, `components/`, `hooks/`, `store/`, or `types.ts`).
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

```typescript
// pg-compatible wrapper (async, returns { rows })
const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Raw better-sqlite3 for transactions
const rawDb = db.db;
rawDb.transaction(() => {
  rawDb.prepare('INSERT INTO ...').run(...);
  rawDb.prepare('UPDATE ...').run(...);
})();
```

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

## Git Workflow

- **Always branch from `main`** before starting a feature
- Use descriptive branch names: `feature/add-distributors`, `fix/login-bug`
- Commit frequently with clear messages
- Merge back to `main` via PR when complete
