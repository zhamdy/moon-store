# MOON Fashion & Style

A full-stack luxury fashion retail management system. Monorepo with React SPA frontend and Express REST API backend, powered by SQLite.

**63 features** shipped across 3 development waves — from core POS to AI-powered insights.

## Prerequisites

- **Node.js** 18+
- **Twilio account** (optional, for SMS/WhatsApp delivery notifications)

No external database required — uses embedded SQLite with WAL mode.

## Quick Start

### 1. Clone & Install

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Environment Setup

Create `server/.env`:

```env
JWT_SECRET=your-access-token-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-token-secret-min-32-chars
```

### 3. Database Setup

```bash
cd server
npm run migrate    # Run all 64 migrations
npm run seed       # Seed sample data (users, products, sales, customers)
```

### 4. Start Development

```bash
# Terminal 1 — Server (port 3001)
cd server && npm run dev

# Terminal 2 — Client (port 5173)
cd client && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/api/health

### 5. Default Logins

| Email | Password | Role |
|-------|----------|------|
| admin@moon.com | admin123 | Admin |
| sarah@moon.com | cashier123 | Cashier |
| james@moon.com | delivery123 | Delivery |

## Features

### Wave 1 — Core POS & Inventory (20 features)

- **Dashboard** — KPI cards, revenue/profit charts, top products, payment breakdown, cashier performance
- **Point of Sale** — Product search/scan, cart with hold/retrieve, checkout with split payments, keyboard shortcuts (F1-F5)
- **Inventory** — Full CRUD, CSV import, bulk operations, low-stock alerts, stock adjustments, product images
- **Barcode Tools** — Camera scanner (Quagga2), barcode generator, WYSIWYG label designer, bulk print
- **Sales History** — Filterable history, refund/void workflow, receipt printing/reprint
- **Deliveries** — Order management, status tracking, SMS/WhatsApp notifications, shipping company integration
- **Customers** — Customer database, purchase history, loyalty points system
- **User Management** — Role-based CRUD (Admin, Cashier, Delivery)
- **Analytics** — Revenue trends, category/distributor breakdowns, ABC classification, reorder suggestions
- **Product Variants** — Size/color variants with independent stock/pricing
- **Purchase Orders** — Supplier ordering, receiving, auto-generation from low stock
- **Tax/VAT Support** — Configurable tax rates, inclusive/exclusive modes
- **Audit Log** — Full system activity trail
- **Notification Center** — In-app notifications for low stock, sales, delivery alerts
- **Analytics Export** — PDF and CSV exports

### Wave 2 — Operations & Commerce (25 features)

- **Cash Register** — Open/close drawer, cash in/out, variance tracking
- **Exchange Workflow** — Return + new sale in one transaction
- **Shift Tracking** — Clock in/out, breaks, timesheet reports
- **Expense Tracking** — Categories, recurring expenses, P&L data
- **Customer Segmentation** — RFM analysis, targeted segments
- **Layaway/Credit Sales** — Payment plans with installment tracking
- **Coupons & Promotions** — Percentage/fixed discounts, validation rules, usage limits
- **Gift Cards** — Issuance, balance tracking, redemption at checkout
- **Product Bundles** — Grouped products with bundle pricing
- **Collections** — Season/collection management
- **Custom Roles** — Configurable permissions
- **Warranty Tracking** — Claims and coverage management
- **Customer Feedback** — NPS collection and analysis
- **Backup & Restore** — Database backup with cloud sync
- **Activity Feed** — Collaboration notes

### Wave 3 — Multi-Store, E-Commerce & AI (18 features)

- **Multi-Store** — Branch management, consolidated dashboard, inter-store transfers
- **E-Commerce** — Customer accounts, online orders, storefront configuration
- **Product Reviews** — Ratings, Q&A, moderation
- **Report Builder** — Custom queries, saved reports, scheduled execution
- **Data Warehouse** — Materialized views for BI
- **Marketplace** — Vendor management, product approvals, commissions, payouts
- **Smart Pricing** — Rule-based dynamic pricing engine
- **AI Chatbot** — Conversational support assistant
- **Sales Predictions** — Trend analysis and demand forecasting
- **Auto Descriptions** — AI-generated product descriptions

## Tech Stack

### Frontend

| Concern | Library |
|---------|---------|
| Framework | React 18 + Vite 5 (TypeScript) |
| Routing | React Router v6 |
| State | Zustand 5 (persist) + TanStack React Query v5 |
| Tables | TanStack React Table v8 |
| Forms | React Hook Form + Zod |
| UI | Radix UI (shadcn/ui) + Tailwind CSS 3 |
| Charts | Recharts 2 |
| Barcode | @ericblade/quagga2 (scan) + jsbarcode (generate) |
| PDF | jspdf + html2canvas |
| Icons | lucide-react |
| PWA | vite-plugin-pwa (Workbox) |

### Backend

| Concern | Library |
|---------|---------|
| Framework | Express 4 (TypeScript via tsx) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Auth | JWT (15min access + 7d refresh cookie) + bcrypt |
| Validation | Zod |
| Messaging | Twilio SDK (SMS/WhatsApp) |
| Security | helmet, cors, express-rate-limit |
| Testing | Vitest |

## Project Structure

```
moon-store/
├── client/                    # React 18 + Vite SPA
│   └── src/
│       ├── components/
│       │   ├── ui/            # shadcn/ui primitives
│       │   └── charts/        # Recharts wrappers (7 chart types)
│       ├── pages/             # 35+ route-level components
│       ├── store/             # Zustand stores (auth, cart, settings, offline, heldCarts)
│       ├── services/          # Axios client with token refresh interceptor
│       ├── hooks/             # useOffline, useScanner, usePosShortcuts, useDebouncedValue
│       ├── i18n/              # AR/EN translations (~180 keys per locale)
│       ├── lib/               # utils.ts, queryClient.ts
│       ├── App.tsx            # Router + 35+ routes with role guards
│       └── index.css          # Tailwind + CSS variables (light/dark themes)
├── server/                    # Express REST API
│   ├── routes/                # 37 route files
│   ├── middleware/            # auth.ts, errorHandler.ts, auditLogger.ts
│   ├── services/              # twilio.ts, notifications.ts
│   ├── validators/            # 10 Zod schema files
│   ├── db/
│   │   ├── migrations/        # 64 SQL migration files
│   │   ├── index.ts           # SQLite connection + pg-compatible query wrapper
│   │   ├── migrate.ts         # Migration runner with reconciliation
│   │   └── seed.ts            # Sample data (users, products, sales, customers)
│   └── index.ts               # Express app setup
├── CLAUDE.md                  # AI assistant instructions
├── FEATURES_ROADMAP.md        # Full feature specs (63 features)
└── docs/                      # Detailed documentation
    ├── ARCHITECTURE.md        # Structure, stacks, stores, pages, components
    ├── API_REFERENCE.md       # All endpoints, DB schema, auth flow
    ├── CONVENTIONS.md         # Code patterns, naming, gotchas
    ├── SMOKE_TEST.md          # Manual QA checklist
    ├── OFFLINE_PWA.md         # Service worker, caching, offline queue
    └── INTEGRATIONS.md        # Twilio, barcode, exports, AI
```

## Available Scripts

### Server (`cd server`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with auto-reload (tsx watch) |
| `npm start` | Start production server |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database with sample data |
| `npm test` | Run tests (Vitest) |
| `npm run lint` | Lint TypeScript files |
| `npm run format` | Format with Prettier |

### Client (`cd client`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests (Vitest) |
| `npm run lint` | Lint TypeScript files |
| `npm run format` | Format with Prettier |

## Internationalization

- **Languages**: Arabic (RTL, default) and English (LTR)
- **RTL Support**: Full — uses Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`)
- **Toggle**: Language and theme switches in the sidebar
- **Fonts**: Playfair Display (titles), DM Sans (body), IBM Plex Sans Arabic (Arabic)

## PWA & Offline Mode

The app is a Progressive Web App with offline support:

1. **Install**: After 30 seconds on first visit, an install prompt appears
2. **Offline POS**: Products cached via StaleWhileRevalidate (24h); sales queued offline
3. **Background Sync**: Queued sales auto-sync when connectivity returns
4. **Offline Banner**: Visual indicator when offline with queue count

To test offline mode:
1. Build the client: `cd client && npm run build`
2. Serve: `npm run preview`
3. Open DevTools > Application > Service Workers
4. Check "Offline" to simulate
5. Make a sale in POS — it queues
6. Uncheck "Offline" — queued sales sync automatically

## Twilio Setup (Optional)

For SMS and WhatsApp delivery notifications, add to `server/.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=+1234567890
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Without Twilio configured, notifications are logged to console instead.

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token signing secret (min 32 chars) |
| `PORT` | No | 3001 | Server port |
| `CLIENT_URL` | No | http://localhost:5173 | CORS origin |
| `ALLOWED_ORIGINS` | No | — | Additional CORS origins (comma-separated) |
| `NODE_ENV` | No | — | Set to `production` to hide error stack traces |
| `TWILIO_ACCOUNT_SID` | No | — | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | No | — | Twilio Auth Token |
| `TWILIO_PHONE` | No | — | Twilio SMS sender number |
| `TWILIO_WHATSAPP_FROM` | No | — | Twilio WhatsApp sender |

### Client (`client/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | http://localhost:3001 | Backend API URL |

## API Response Format

```json
// Success (single)
{ "success": true, "data": { ... } }

// Success (list)
{ "success": true, "data": [...], "meta": { "total": 100, "page": 1, "limit": 25 } }

// Error
{ "success": false, "error": "Human readable message" }
```

## Documentation

For detailed documentation, see the [`docs/`](docs/) directory:

- **[Architecture](docs/ARCHITECTURE.md)** — Project structure, stacks, stores, pages, components, theming, i18n, RTL, PWA
- **[API Reference](docs/API_REFERENCE.md)** — All 37 route groups, database schema, auth flow, rate limits
- **[Conventions](docs/CONVENTIONS.md)** — Code patterns, naming rules, SQLite gotchas, feature checklist
- **[Smoke Test](docs/SMOKE_TEST.md)** — Manual QA checklist (16 sections)
- **[Offline & PWA](docs/OFFLINE_PWA.md)** — Service worker, caching strategies, offline queue
- **[Integrations](docs/INTEGRATIONS.md)** — Twilio, notifications, barcode, PDF/CSV export, AI features
- **[Feature Roadmap](FEATURES_ROADMAP.md)** — Full specs for all 63 features across 3 waves
