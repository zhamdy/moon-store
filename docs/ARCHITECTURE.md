# Architecture

## Monorepo Structure

```
moon-store/
├── client/                    # React 18 + Vite SPA (TypeScript)
│   └── src/
│       ├── assets/            # SVG logo, static images
│       ├── components/
│       │   ├── ui/            # shadcn/ui primitives (Button, Dialog, Sheet, etc.)
│       │   └── charts/        # Recharts wrappers
│       ├── pages/             # 35+ route-level components
│       ├── store/             # Zustand stores (4 stores)
│       ├── services/          # Axios API client with interceptors
│       ├── hooks/             # useOffline, useScanner, usePosShortcuts, useDebouncedValue
│       ├── i18n/              # AR/EN translations + useTranslation hook
│       ├── lib/               # utils.ts, queryClient.ts
│       ├── App.tsx            # Router + route config
│       ├── main.tsx           # Entry: providers + Toaster
│       └── index.css          # Tailwind + CSS variables (light/dark)
├── server/                    # Node.js + Express API (TypeScript)
│   ├── routes/                # 37 route files
│   ├── middleware/            # auth.ts, errorHandler.ts, auditLogger.ts
│   ├── services/              # twilio.ts, notifications.ts
│   ├── validators/            # 10 Zod schema files
│   ├── db/
│   │   ├── migrations/        # 64 SQL migration files
│   │   ├── index.ts           # DB connection + pg-compat query wrapper
│   │   ├── migrate.ts         # Migration runner
│   │   ├── seed.ts            # Sample data seeder
│   │   └── moon.db            # SQLite database file
│   ├── uploads/               # Product images (served at /uploads)
│   └── index.ts               # Express app setup
├── CLAUDE.md                  # AI assistant instructions
├── FEATURES_ROADMAP.md        # 63 completed features across 3 waves
└── docs/                      # This documentation
```

---

## Frontend Stack

| Concern | Library | Version |
|---------|---------|---------|
| Framework | React + Vite | 18.3 / 5.4 |
| Language | TypeScript | 5.9 |
| Routing | React Router | v6 |
| State (local) | Zustand | 5 (persist middleware) |
| State (server) | TanStack React Query | v5 |
| Tables | TanStack React Table | v8 |
| Forms | React Hook Form + Zod | 7.53 / 3.23 |
| UI primitives | Radix UI (via shadcn/ui) | Various |
| Styling | Tailwind CSS + CSS variables | 3.4 |
| Charts | Recharts | 2.13 |
| Barcode scan | @ericblade/quagga2 | 1.8 |
| Barcode gen | jsbarcode | 3.11 |
| PDF export | jspdf + html2canvas | 4.2 / 1.4 |
| Date picker | react-day-picker | 9.1 |
| Command palette | cmdk | 1.0 |
| IndexedDB | idb | 8.0 |
| HTTP | Axios | 1.7 |
| PWA | vite-plugin-pwa (Workbox) | 0.20 |
| Icons | lucide-react | 0.447 |
| Toasts | react-hot-toast | 2.4 |

## Backend Stack

| Concern | Library | Version |
|---------|---------|---------|
| Framework | Express | 4.21 |
| Language | TypeScript (tsx runner) | 5.9 |
| Database | SQLite via better-sqlite3 (WAL) | 12.6 |
| Auth | jsonwebtoken (JWT) | 9.0 |
| Password | bcrypt | 5.1 |
| Validation | Zod | 3.23 |
| File upload | multer | 2.0 |
| SMS/WhatsApp | Twilio SDK | 5.3 |
| Security | helmet, cors, express-rate-limit | Latest |
| Testing | Vitest | 4.0 |

---

## Zustand Stores

| Store | File | Key State | Persisted |
|-------|------|-----------|-----------|
| `authStore` | `store/authStore.ts` | `user`, `accessToken`, `isAuthenticated` | Yes (`moon-auth`) |
| `cartStore` | `store/cartStore.ts` | `items[]`, `discount`, `discountType`, `notes`, `tip`, `couponCode` | Yes (`moon-cart-recovery`, auto-clears after 8h) |
| `offlineStore` | `store/offlineStore.ts` | `queue[]`, `isSyncing` | Yes (`moon-offline-queue`) |
| `settingsStore` | `store/settingsStore.ts` | `locale` (ar/en), `theme` (light/dark) | Yes (`moon-settings`) |
| `heldCartsStore` | `store/heldCartsStore.ts` | `carts[]` (suspended transactions) | Yes (`moon-held-carts`) |

`settingsStore.hydrate()` is called on app boot to sync `<html>` lang, dir, and class attributes.

---

## Pages & Access Control

### Core Pages (eager-loaded)

| Page | Route | Roles | Component |
|------|-------|-------|-----------|
| Dashboard | `/` | Admin | `Dashboard` |
| POS | `/pos` | Admin, Cashier | `POS` |
| Inventory | `/inventory` | Admin, Cashier | `Inventory` |
| Barcode Tools | `/barcode` | Admin, Cashier | `BarcodeTools` |
| Deliveries | `/deliveries` | Admin, Delivery | `Deliveries` |
| Sales History | `/sales` | Admin, Cashier | `SalesHistory` |
| Users | `/users` | Admin | `UsersPage` |
| Customers | `/customers` | Admin | `CustomersPage` |
| Distributors | `/distributors` | Admin | `DistributorsPage` |
| Categories | `/categories` | Admin | `CategoriesPage` |
| Settings | `/settings` | Admin | `SettingsPage` |
| Purchase Orders | `/purchase-orders` | Admin | `PurchaseOrdersPage` |
| Audit Log | `/audit-log` | Admin | `AuditLogPage` |

### Feature Pages (lazy-loaded via `React.lazy`)

| Page | Route | Roles |
|------|-------|-------|
| Promotions (Coupons) | `/promotions` | Admin |
| Gift Cards | `/gift-cards` | Admin |
| Stock Count | `/stock-count` | Admin |
| Cash Register | `/register` | Admin, Cashier |
| Shifts | `/shifts` | Admin, Cashier, Delivery |
| Expenses | `/expenses` | Admin |
| Segments | `/segments` | Admin |
| Layaway | `/layaway` | Admin, Cashier |
| Collections | `/collections` | Admin |
| Warranty | `/warranty` | Admin |
| Feedback | `/feedback` | Admin |
| Backup | `/backup` | Admin |
| Activity Feed | `/activity` | Admin |
| Exports | `/exports` | Admin |
| Branches | `/branches` | Admin |
| Storefront | `/storefront` | Admin |
| Online Orders | `/online-orders` | Admin |
| Report Builder | `/report-builder` | Admin |
| Vendors | `/vendors` | Admin |
| Smart Pricing | `/smart-pricing` | Admin |
| AI Insights | `/ai-insights` | Admin |

### Special Routes

| Route | Auth | Description |
|-------|------|-------------|
| `/login` | Public | Login page (redirects if authenticated) |
| `/customer-display` | Public | Customer-facing kiosk display |
| `/locations` | - | Redirects to `/branches` |
| `*` | - | Catch-all redirect to role-appropriate default |

### Default Route by Role

| Role | Redirects To |
|------|-------------|
| Admin | `/` (Dashboard) |
| Cashier | `/pos` |
| Delivery | `/deliveries` |

---

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `Layout` | `components/Layout.tsx` | Sidebar + main content wrapper + offline banner |
| `Sidebar` | `components/Sidebar.tsx` | Navigation (role-filtered `navItems[]`) + language/theme toggles + logout |
| `CartPanel` | `components/CartPanel.tsx` | Shopping cart with checkout Sheet + offline fallback |
| `DataTable` | `components/DataTable.tsx` | Reusable table with sort/search/pagination (TanStack Table) |
| `BarcodeScanner` | `components/BarcodeScanner.tsx` | Camera-based barcode reader (Quagga2) |
| `ProtectedRoute` | `components/ProtectedRoute.tsx` | Role-based route guard; redirects unauthorized users |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | React error boundary (class component; uses standalone `t()`) |
| `PWAInstallPrompt` | `components/PWAInstallPrompt.tsx` | PWA install banner (shown after 30s on first visit) |
| `CustomerDisplay` | `pages/CustomerDisplay.tsx` | Customer-facing kiosk screen (no auth) |

### Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useOffline` | `hooks/useOffline.ts` | Detects online/offline status, auto-syncs queued sales when back online |
| `useScanner` | `hooks/useScanner.ts` | Manages Quagga2 barcode scanner lifecycle (start/stop, cooldown, camera config) |
| `usePosShortcuts` | `hooks/usePosShortcuts.ts` | POS keyboard shortcuts (F1=search, F2=scanner, F3=checkout, F4=clear, F5=hold, +/-/Delete for cart) |
| `useDebouncedValue` | `hooks/useDebouncedValue.ts` | Generic debounce hook for search inputs |

### Chart Components (`components/charts/`)

| Component | Chart Type | Data |
|-----------|-----------|------|
| `RevenueChart` | LineChart | Revenue over time |
| `TopProductsChart` | BarChart | Top 10 products by qty |
| `PaymentPieChart` | PieChart | Payment method breakdown |
| `OrdersAreaChart` | AreaChart | Daily order count |
| `CashierPerformanceChart` | BarChart | Sales by cashier |
| `CategorySalesChart` | PieChart | Revenue by category |
| `DistributorSalesChart` | BarChart | Sales by distributor |

All charts read theme state from Zustand to switch colors between light/dark mode (Recharts cannot consume CSS variables).

### Sidebar Navigation Groups

The sidebar organizes `navItems[]` into logical groups:

1. **Daily Operations** — Dashboard, POS, Sales, Register, Shifts, Expenses, Segments, Layaway, Collections, Warranty, Feedback, Backup, Activity
2. **Products & Stock** — Inventory, Categories, Barcode, Purchase Orders, Promotions, Gift Cards, Stock Count, Distributors
3. **Orders & Customers** — Deliveries, Customers
4. **Administration** — Users, Exports, Branches, Storefront, Online Orders, Report Builder, Vendors, Smart Pricing, AI Insights, Audit Log, Settings

---

## i18n System

- Custom lightweight implementation (no i18next)
- `useTranslation()` hook returns `{ t, locale, isRtl }`
- Standalone `t(key, params)` function for class components and Zod schemas
- `{param}` interpolation syntax in translation strings
- Translation files: `client/src/i18n/en.json` and `ar.json`
- **Default**: Arabic (RTL) + Light mode

---

## Theming

- CSS variables defined in `client/src/index.css`
  - `:root` = light theme
  - `.dark` = dark theme overrides
- Tailwind colors reference `hsl(var(--...))` variables
- Theme toggle in Sidebar updates `settingsStore` which sets `.dark` class on `<html>`
- Charts use Zustand theme state with ternaries (Recharts cannot consume CSS variables)
- Fonts: Playfair Display (display/titles), DM Sans (body + data), IBM Plex Sans Arabic (Arabic)

---

## RTL Support

- Uses Tailwind CSS logical properties: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`
- `dir="rtl"` set on `<html>` element by `settingsStore.hydrate()`
- Sheet/Dialog components use logical positioning
- CartPanel checkout sheet: `side={isRtl ? 'left' : 'right'}`

---

## PWA & Offline

- Service worker via `vite-plugin-pwa` (Workbox)
- Caching strategies:
  - Products API: `StaleWhileRevalidate` (24h)
  - Sales API: `NetworkFirst` (1h)
- Offline sales queued in `offlineStore` (persisted via Zustand) → auto-sync when connectivity returns
- Install prompt shown after 30s on first visit via `PWAInstallPrompt` component

---

## Server Architecture

### Request Lifecycle

```
Request → helmet → cors → rate-limit → json parser → cookie parser
        → route middleware (verifyToken → requireRole)
        → route handler
        → errorHandler (catch-all)
```

### Auth Middleware Chain

```typescript
// Public route — no middleware
router.get('/public-data', handler);

// Authenticated route — any logged-in user
router.get('/profile', verifyToken, handler);

// Role-restricted route — Admin only
router.post('/create', verifyToken, requireRole('Admin'), handler);

// Multi-role route
router.get('/data', verifyToken, requireRole('Admin', 'Cashier'), handler);
```

### Database Layer

- `db.query(sql, params)` — async pg-compatible wrapper; returns `{ rows }`
- Converts `$1, $2` placeholders to `?` for SQLite
- Handles `SELECT`, write ops, and `RETURNING` clauses
- `db.db` — raw `better-sqlite3` instance for transactions
- `db.pool.connect()` — mock pool client for pg-compatible code

### Services

| Service | File | Purpose |
|---------|------|---------|
| Twilio | `services/twilio.ts` | SMS and WhatsApp messaging (optional; logs skip if unconfigured) |
| Notifications | `services/notifications.ts` | In-app notification creation; broadcasts to Admin users; low-stock, sale, and delivery alerts |
| Audit Logger | `middleware/auditLogger.ts` | `logAudit()` / `logAuditFromReq()` — records user actions to `audit_log` table (silently catches errors) |

### Background Tasks

- **Reservation cleanup**: Expired stock reservations cleaned every 5 minutes (`setInterval`)
- **Process error handlers**: `uncaughtException` and `unhandledRejection` logged but don't crash the server

### Static Files

- Product images served from `/uploads` directory via `express.static`
- JSON body limit: 10MB (`express.json({ limit: '10mb' })`)
