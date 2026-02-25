# Conventions & Patterns

## Project Structure Rules

### File Extensions
- **Server**: `.ts` (TypeScript, run via `tsx`)
- **Client**: `.tsx` for components/pages, `.ts` for stores/services/hooks/utils

### Path Aliases
- `@/` maps to `client/src/` (configured in Vite + TypeScript)
- Example: `import { cn } from '@/lib/utils'`

---

## Component Patterns

### Page Components
Every page follows this pattern:

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../i18n';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Dialog } from '@/components/ui/dialog';  // or Sheet

export default function SomePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['some-key'],
    queryFn: () => api.get('/api/some-endpoint').then(r => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/api/some-endpoint', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['some-key'] });
      toast.success(t('some.successKey'));
    },
    onError: () => toast.error(t('some.errorKey')),
  });

  return ( /* JSX */ );
}
```

### Loading States
- Eager pages: direct rendering (no Suspense wrapper needed)
- Lazy pages: wrapped in `<Suspense fallback={<div>Loading...</div>}>`
- All pages wrapped in `<ErrorBoundary>` inside `<ProtectedRoute>`

### Component Types
- **All UI components**: Functional with hooks
- **Exception**: `ErrorBoundary` is a class component (React limitation), uses standalone `t()` function

---

## Server Route Patterns

### Standard CRUD Route File

```typescript
import { Router, Response } from 'express';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import db from '../db';

const router = Router();

// List
router.get('/', verifyToken, requireRole('Admin'), async (req: AuthRequest, res: Response) => {
  const { rows } = await db.query('SELECT * FROM table_name ORDER BY id DESC');
  res.json({ success: true, data: rows });
});

// Create
router.post('/', verifyToken, requireRole('Admin'), async (req: AuthRequest, res: Response) => {
  // Zod validation, db.query INSERT, res.json
});

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

Always return consistent shape:

```typescript
// Success
res.json({ success: true, data: result });
res.json({ success: true, data: rows, meta: { total, page, limit } });

// Error
res.status(400).json({ success: false, error: 'Validation failed' });
res.status(404).json({ success: false, error: 'Not found' });
```

---

## Styling

### Tailwind Class Merging

Use the `cn()` utility (from `lib/utils.ts`) to merge classes:

```tsx
import { cn } from '@/lib/utils';

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

Theme colors are defined as CSS variables in `index.css` and referenced via Tailwind:

```css
/* index.css */
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
import { t } from '../i18n';
```

### Adding New Keys

1. Add key to both `client/src/i18n/en.json` and `ar.json`
2. Use `{param}` syntax for interpolation
3. Follow existing naming: `section.action` (e.g., `inventory.addProduct`)

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
  return res.status(400).json({ success: false, error: parsed.error.message });
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
| Route files | camelCase | `purchaseOrders.ts` |
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
5. **Page**: Create `client/src/pages/Feature.tsx`
6. **Route config**: Add route in `client/src/App.tsx` (lazy or eager)
7. **Sidebar**: Add entry to `navItems[]` in `client/src/components/Sidebar.tsx`
8. **i18n**: Add keys to both `en.json` and `ar.json`
9. **Roadmap**: Update `FEATURES_ROADMAP.md`
10. **Run migrate**: `cd server && npm run migrate`

### Route Ordering Reminder

When adding routes in `server/index.ts`, order doesn't matter since each route file has its own prefix. But **within** a route file, specific paths must come before `/:id`.

---

## Git Workflow

- **Always branch from `main`** before starting a feature
- Use descriptive branch names: `feature/add-distributors`, `fix/login-bug`
- Commit frequently with clear messages
- Merge back to `main` via PR when complete
