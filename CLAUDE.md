# MOON Fashion & Style - Project Documentation

## Overview
Luxury fashion retail management system. Monorepo with React SPA frontend + Express REST API backend.

## Git Workflow
- **Always create a new branch before starting a new feature.** Branch from `main` using a descriptive name (e.g., `feature/add-distributors`, `fix/login-bug`).
- Commit frequently with clear messages.
- Merge back to `main` via PR when the feature is complete.

## Quick Reference

### Run Commands
```bash
# Server (Terminal 1)
cd server && npm run dev          # Port 3001, auto-reload

# Client (Terminal 2)
cd client && npm run dev          # Port 5173, Vite HMR

# Build client
cd client && npm run build        # Output: client/dist/

# Database
cd server && npm run migrate      # Run migrations
cd server && npm run seed         # Seed sample data (3 users + 20 products)
```

### Default Logins
| Email | Password | Role |
|-------|----------|------|
| admin@moon.com | admin123 | Admin |
| sarah@moon.com | cashier123 | Cashier |
| james@moon.com | delivery123 | Delivery |

### Known Build Warnings (not errors)
- Chunk size warning (>500KB) — expected for SPA bundle
- These are pre-existing and safe to ignore

---

## Architecture

### Monorepo Structure
```
moon-store/
├── client/          # React 18 + Vite SPA
│   └── src/
│       ├── components/
│       │   ├── ui/          # shadcn/ui primitives (Radix-based)
│       │   └── charts/      # Recharts wrappers
│       ├── pages/           # Route-level components (8 pages)
│       ├── store/           # Zustand stores (4 stores)
│       ├── services/        # Axios API client with interceptors
│       ├── hooks/           # useOffline, useScanner
│       ├── i18n/            # AR/EN translations + useTranslation hook
│       ├── lib/             # utils.js, queryClient.js
│       ├── App.jsx          # Router + route config
│       ├── main.jsx         # Entry: providers + Toaster
│       └── index.css        # Tailwind + CSS variables (light/dark)
├── server/          # Node.js + Express API
│   ├── routes/      # 6 route files (auth, products, sales, delivery, analytics, users)
│   ├── middleware/   # auth.js (JWT verify + role check), errorHandler.js
│   ├── services/     # twilio.js (SMS/WhatsApp)
│   ├── validators/   # Zod schemas (product, sale, user, delivery)
│   ├── db/           # SQLite via better-sqlite3
│   │   ├── migrations/  # 6 SQL files
│   │   ├── index.js     # DB connection + pg-compat query wrapper
│   │   ├── migrate.js   # Migration runner
│   │   └── seed.js      # Sample data seeder
│   └── index.js      # Express app setup
└── README.md
```

### Frontend Stack
| Concern | Library |
|---------|---------|
| Framework | React 18 + Vite 5 |
| Routing | React Router v6 |
| State (local) | Zustand 5 (persist middleware) |
| State (server) | TanStack React Query v5 |
| Tables | TanStack React Table v8 |
| Forms | React Hook Form + Zod |
| UI primitives | Radix UI (via shadcn/ui) |
| Styling | Tailwind CSS 3 + CSS variables |
| Charts | Recharts 2 |
| Barcode scan | @ericblade/quagga2 |
| Barcode gen | jsbarcode |
| HTTP | Axios (with token refresh interceptor) |
| PWA | vite-plugin-pwa (Workbox) |
| Icons | lucide-react |
| Toasts | react-hot-toast |

### Backend Stack
| Concern | Library |
|---------|---------|
| Framework | Express 4 |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Auth | JWT (access 15min + refresh 7d httpOnly cookie) |
| Password | bcrypt |
| Validation | Zod |
| SMS/WhatsApp | Twilio SDK |
| Security | helmet, cors, express-rate-limit |

---

## Frontend Details

### Zustand Stores (client/src/store/)
| Store | Key State | Persisted |
|-------|-----------|-----------|
| `authStore` | user, accessToken, isAuthenticated | Yes (moon-auth) |
| `cartStore` | items[], discount, discountType | No (session) |
| `offlineStore` | queue[], isSyncing | Yes (moon-offline-queue) |
| `settingsStore` | locale (ar/en), theme (light/dark) | Yes (moon-settings) |

### i18n System (client/src/i18n/)
- Custom lightweight system (no i18next dependency)
- `useTranslation()` hook returns `{ t, locale, isRtl }`
- Standalone `t(key, params)` for class components & Zod schemas
- `{param}` interpolation syntax in translation strings
- ~180 keys per locale in `en.json` / `ar.json`
- **Defaults**: Arabic (RTL) + Light mode

### Theming
- CSS variables in `index.css`: `:root` = light, `.dark` = dark
- Tailwind colors reference `hsl(var(--...))`
- `settingsStore.hydrate()` syncs `<html>` lang/dir/class on load
- Charts use Zustand theme state with ternaries (Recharts can't use CSS vars)
- Fonts: Playfair Display (display), Cormorant Garamond (body), Inter (data), Cairo (arabic)

### RTL Support
- Tailwind logical properties throughout: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`
- `dir="rtl"` on `<html>` element (set by settingsStore)
- Sheet/dialog components use logical positioning
- CartPanel checkout sheet: `side={isRtl ? 'left' : 'right'}`

### Pages & Access Control
| Page | Route | Roles |
|------|-------|-------|
| Dashboard | `/` | Admin |
| POS | `/pos` | Admin, Cashier |
| Inventory | `/inventory` | Admin, Cashier |
| Barcode Tools | `/barcode` | Admin, Cashier |
| Deliveries | `/deliveries` | Admin, Delivery |
| Sales History | `/sales` | Admin, Cashier |
| Users | `/users` | Admin |
| Login | `/login` | Public |

### Key Components
- **Layout.jsx** — Sidebar + main content wrapper + offline banner
- **Sidebar.jsx** — Navigation + language/theme toggles
- **CartPanel.jsx** — Shopping cart with checkout sheet + offline fallback
- **DataTable.jsx** — Reusable table with sort/search/pagination (TanStack)
- **BarcodeScanner.jsx** — Camera-based barcode reader (Quagga2)
- **ProtectedRoute.jsx** — Role-based route guard
- **ErrorBoundary.jsx** — React error boundary (class component, uses standalone `t()`)

### API Client (client/src/services/api.js)
- Axios instance, base URL from `VITE_API_URL` or `http://localhost:3001`
- Request interceptor: attaches `Bearer` token from authStore
- Response interceptor: on 401, attempts token refresh via `/api/auth/refresh`
- Queues failed requests during refresh, replays on success
- Redirects to `/login` on refresh failure

---

## Backend Details

### API Endpoints
```
POST   /api/auth/login          # Login → accessToken + refreshToken cookie
POST   /api/auth/refresh        # Refresh access token
POST   /api/auth/logout         # Revoke refresh token
GET    /api/auth/me             # Current user profile

GET    /api/products            # List (paginated, searchable, filterable)
GET    /api/products/categories # Distinct categories
GET    /api/products/barcode/:b # Lookup by barcode
GET    /api/products/:id        # Single product
POST   /api/products            # Create (Admin)
PUT    /api/products/:id        # Update (Admin)
DELETE /api/products/:id        # Delete (Admin)
POST   /api/products/import     # CSV bulk import (Admin)

GET    /api/sales               # List with filters + total revenue
GET    /api/sales/stats/summary # Today/month revenue + counts
GET    /api/sales/:id           # Sale detail with items
POST   /api/sales               # Create sale (deducts stock)

GET    /api/delivery            # List (role-filtered for Delivery users)
GET    /api/delivery/:id        # Order with items
POST   /api/delivery            # Create order (Admin)
PUT    /api/delivery/:id        # Update order (Admin)
PUT    /api/delivery/:id/status # Update status + SMS/WhatsApp

GET    /api/analytics/dashboard      # KPI cards
GET    /api/analytics/revenue        # Revenue by date (30d default)
GET    /api/analytics/top-products   # Top 10 by qty sold
GET    /api/analytics/payment-methods # Payment breakdown
GET    /api/analytics/orders-per-day  # Daily order trend

GET    /api/users               # List all (Admin)
GET    /api/users/delivery      # Delivery users only (Admin)
POST   /api/users               # Create (Admin)
PUT    /api/users/:id           # Update (Admin)
DELETE /api/users/:id           # Delete (Admin)

GET    /api/health              # Health check
```

### Database Schema (SQLite)
- **users** — id, name, email (unique), password_hash, role (Admin/Cashier/Delivery), created_at, last_login
- **refresh_tokens** — id, user_id (FK), token, expires_at
- **products** — id, name, sku (unique), barcode (unique), price, stock, category, min_stock, created_at, updated_at
- **sales** — id, total, discount, discount_type, payment_method, cashier_id (FK), created_at
- **sale_items** — id, sale_id (FK), product_id (FK), quantity, unit_price
- **delivery_orders** — id, order_number (unique), customer_name, phone, address, notes, status (Pending/Preparing/Out for Delivery/Delivered/Cancelled), assigned_to (FK), created_at, updated_at
- **delivery_items** — id, order_id (FK), product_id (FK), quantity
- **offline_sync_queue** — id, action_type, payload (JSON), synced, created_at

### Auth Flow
1. Login: email/password → bcrypt compare → JWT access (15min) + refresh (7d httpOnly cookie)
2. API calls: Bearer token in Authorization header
3. Token expired: client interceptor calls `/api/auth/refresh` → new access token
4. Role check: `requireRole('Admin')` middleware on protected routes

### Environment Variables (server/.env)
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Server port |
| DATABASE_URL | postgresql://... | Not used (SQLite) — legacy config |
| JWT_SECRET | — | Access token secret (min 32 chars) |
| JWT_REFRESH_SECRET | — | Refresh token secret (min 32 chars) |
| TWILIO_* | — | Optional SMS/WhatsApp config |
| CLIENT_URL | http://localhost:5173 | CORS origin |

> Note: Despite DATABASE_URL referencing PostgreSQL, the actual DB is SQLite (`server/db/moon.db`). The `db/index.js` wraps better-sqlite3 with a pg-compatible query interface.

---

## PWA & Offline
- Service worker via vite-plugin-pwa (Workbox)
- Products API cached with StaleWhileRevalidate (24h)
- Sales API cached with NetworkFirst (1h)
- Offline sales queued in `offlineStore` → auto-sync when back online
- Install prompt shown after 30s on first visit

## API Response Format
```json
{ "success": true, "data": { ... } }
{ "success": true, "data": [...], "meta": { "total": 100, "page": 1, "limit": 25 } }
{ "success": false, "error": "Human readable message" }
```

## Conventions
- All UI components are functional with hooks (except ErrorBoundary — class component)
- Currency formatting is locale-aware (ar-SA/en-US) with Western Arabic numerals
- Date formatting uses date-fns
- Tailwind class merging via `cn()` utility (clsx + tailwind-merge)
- Zod validation on both client (forms) and server (request bodies)
- Path alias: `@/` → `client/src/` (Vite + Tailwind)
