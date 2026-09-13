<div align="center">

# 🌙 MOON Store

**نظام نقاط البيع للأزياء والموضة**

A full-stack, bilingual (Arabic/English) Point of Sale system built for fashion retail.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![HeroUI](https://img.shields.io/badge/HeroUI-2.6-000000)](https://heroui.com)

</div>

---

## ✨ Features

Three lists, because not everything in the codebase is in the product: what ships, what is
built but hidden until later, and what was taken out.

### ✅ MVP

#### 🛒 Point of Sale
- Fast barcode scanning (camera + manual entry)
- Product search with variant picker (size, color)
- Multi-payment support (cash, card, split)
- Hold & recall carts
- Refunds and exchanges
- Register sessions with cash-in/out tracking
- Shift management (clock-in, breaks, clock-out)
- Customer-facing display

#### 📦 Inventory
- Full product catalog with SKU & barcode generation
- Product variants (size, color, custom attributes)
- Categories and collections
- Stock counts with variance reporting
- Stock adjustments with reason logging
- Low-stock alerts and ABC classification
- Barcode label printing

#### 💰 Sales & Promotions
- Sales history with detailed receipts
- Coupon promotions (percentage or fixed amount)
- Gift cards (issue, redeem, track balance)

#### 👥 Customers
- Customer database with purchase history
- Loyalty points (earn & redeem)
- Customer segments for targeted marketing

#### 🚚 Fulfillment & Purchasing
- Delivery tracking with status timeline
- Purchase orders for distributor restocking, through to receiving stock
- Expense tracking by category
- Shipping company management

#### 📊 Analytics & Reporting
- Real-time dashboard with KPI widgets
- Sales by category & distributor charts
- Cashier performance metrics
- Advanced analytics: ABC classification, dead stock, customer lifetime value, sales heatmap
- CSV/PDF export of the dashboard
- CSV downloads of products, sales and customers
- Predefined sales, inventory and profit-and-loss reports — **API only**
  (`GET /api/v1/reports/sales|inventory|profit-loss`, Admin); there is no screen for them

#### ⚙️ Administration
- Role-based access control (Admin, Cashier, Delivery)
- System-wide settings (currency, tax/VAT, locale)
- Audit log for all user actions
- Notification center (low-stock, new-sale alerts)

#### 🌐 Bilingual & RTL
- Full Arabic (العربية) and English UI
- Right-to-left layout support
- Tajawal typography for Arabic readability

### ⏸️ Postponed (hidden)

Built, but held back from the MVP. Their code, routes and API are kept; they are hidden
from navigation, and their URLs redirect. The list lives in
`apps/dashboard/src/shared/lib/postponedFeatures.ts`, whose header holds the reactivation checklist.

- Branches, with inter-store transfers
- Bundles (the sales API still prices bundle lines; only the POS bundle strip is hidden)
- Customer feedback and product reviews
- Online orders
- Storefront configuration
- Warranty claims

### 🗑️ Removed

- Layaway plans
- Vendor management and consignment
- Custom report builder
- Smart pricing rules
- AI insights (chat assistant, sales predictions, auto product descriptions) and the
  server's `/ai/*` API
- Backup page

Their database tables remain, unused, until a dedicated migration drops them — see
*Dormant tables* in [`apps/server/CLAUDE.md`](apps/server/CLAUDE.md).

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Routing** | TanStack Router (file-based, typesafe) |
| **State** | Zustand (client), TanStack Query (server) |
| **UI** | HeroUI v2, Tailwind CSS 3.4, Lucide icons |
| **Forms** | React Hook Form + Zod validation |
| **Charts** | Recharts |
| **Animations** | Framer Motion, FormKit AutoAnimate |
| **Backend** | Express 4, TypeScript, tsx |
| **Database** | PostgreSQL (pg driver, raw SQL) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Testing** | Vitest, Testing Library, pg-mem |
| **Linting** | ESLint 9, Prettier, Madge (cycle detection) |
| **Deployment** | Render (render.yaml) |

---

## 📁 Project Structure

```
moon-store/
├── apps/dashboard/            # Existing React dashboard / POS
│   └── src/
│       ├── app/                # Shell, providers, composition root
│       ├── features/           # 9 domain slices
│       │   ├── admin/          #   Users, settings, audit log (branches: postponed)
│       │   ├── analytics/      #   Dashboard, advanced analytics, exports
│       │   ├── auth/           #   Login, session store, route guard
│       │   ├── customers/      #   Customer records, segments (feedback, warranty: postponed)
│       │   ├── fulfillment/    #   Deliveries (online orders, storefront: postponed)
│       │   ├── inventory/      #   Products, stock, categories, collections (bundles: postponed)
│       │   ├── pos/            #   Register, cart, shifts, barcode tools
│       │   ├── purchasing/     #   Distributors, expenses, purchase orders
│       │   └── sales/          #   History, promotions, gift cards
│       ├── routes/             # TanStack file-based route definitions
│       └── shared/             # Components, hooks, i18n, types, utils
│
├── apps/storefront/           # Empty Next.js 16 / React 19 / Tailwind CSS app
│   └── app/                    # App Router shell only
│
├── apps/server/               # Existing Express API
│   └── src/
│       ├── config/             # Environment validation (Zod)
│       ├── database/           # Pool, migrations, seed data
│       └── modules/            # 6 domain groups
│           ├── core/           #   Auth, users, settings, audit, branches
│           ├── commerce/       #   Customers, coupons, gift cards, store credit
│           ├── fulfillment/    #   Delivery, expenses, purchase orders
│           ├── intelligence/   #   Analytics, reports, exports, notifications
│           ├── inventory/      #   Products, categories, distributors, stock
│           └── pos/            #   Sales, register, shifts, exchanges
│
├── pnpm-workspace.yaml        # apps/* workspace
├── pnpm-lock.yaml             # Shared workspace dependency lock
└── docs/                      # Architecture docs & plans
```

Each server module follows a **6-file pattern**: `types.ts` → `schemas.ts` → `repository.ts` → `service.ts` → `controller.ts` → `routes.ts`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20.9
- **PostgreSQL** ≥ 14
- **pnpm** 10.28.2 (see `packageManager` in the root package.json)

### 1. Clone & Install

```bash
git clone https://github.com/zhamdy/moon-store.git
cd moon-store

# Install all three applications and root development tools
corepack enable
pnpm install
```

### 2. Configure Environment

Create `apps/server/.env`:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/moon_store
JWT_SECRET=your-secret-key-minimum-32-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars-long
CLIENT_URL=http://localhost:5173

# Optional: Twilio for SMS/WhatsApp notifications
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_PHONE=
# TWILIO_WHATSAPP_FROM=
```

### 3. Set Up Database

```bash
# Create the database
createdb moon_store

# Run migrations & seed demo data
cd apps/server
npm run migrate
npm run seed
```

### 4. Start Development

```bash
# Terminal 1 — API server (port 3001)
pnpm dev:server

# Terminal 2 — Client dev server (port 5173)
pnpm dev:dashboard

# Terminal 3 — Empty storefront (port 3000)
pnpm dev:storefront
```

Open **http://localhost:5173** in your browser.

---

## 🔑 Default Logins

| Email | Password | Role |
|-------|----------|------|
| `admin@moon.com` | `admin123` | Admin |
| `sarah@moon.com` | `cashier123` | Cashier |
| `james@moon.com` | `delivery123` | Delivery |

---

## 📜 Available Scripts

### Client (`apps/dashboard/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint + circular dependency check |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run format` | Format with Prettier |

### Server (`apps/server/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with tsx watch (hot reload) |
| `npm start` | Start production server |
| `npm run migrate` | Run database migrations |
| `npm run migrate:down` | Rollback migrations |
| `npm run seed` | Seed demo data |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest test suite |
| `npm run format` | Format with Prettier |

---

## 🧪 Testing

```bash
# Client tests
cd apps/dashboard && npm test

# Server tests (database pool, migrations, seeds, transactions)
cd apps/server && npm test
```

---

## 🚢 Deployment

The project includes a [`render.yaml`](render.yaml) for one-click deployment to [Render](https://render.com):

- **API**: Node.js web service running `npm run migrate && npm run start`; seed demo data only in development.
- **Database**: Add a PostgreSQL instance on Render and set `DATABASE_URL`
- **Client**: Deploy the `apps/dashboard/` build output to any static host (Vercel, Netlify, Render Static)

For databases created before the baseline schema corrections, migration 009 upgrades
the legacy tables and columns in a single transaction. Back up production before
deploying and set the Render dashboard Start Command to match `render.yaml`.
Stop application writes during this upgrade: old code cannot use renamed tables
or columns after it commits. A failed deployment can leave the old instance running.
Verify favorites, notifications, bundles, segments, distributors and collections
after deployment. Do not clear `_migrations` or run production seeding.

The repair retains legacy data, renames bundle/layaway tables in place (preserving
foreign keys), and imports serialized layaway items with explicit product IDs,
quantities and `unit_price` or `price`. Ambiguous tables or malformed items abort the
transaction. Layaway has since been removed from the application; its tables stay in the
schema, dormant. Legacy notifications without an owner remain unassigned; the repair
does not invent user ownership. Older exchange detail and transfer tables remain
available for historical reconciliation. Migration 009 has no destructive rollback;
restore the pre-upgrade backup with its matching release if rollback is required.
The regression fixture reproduces production column metadata; it is not a complete
production backup or a substitute for checking custom constraints and real data.

---

## 🤝 Contributing

1. Branch from `main` (`feature/xxx` or `fix/xxx`)
2. Commit frequently with clear messages
3. Pre-commit hooks auto-run ESLint + Prettier via Husky
4. Open a PR when ready

---

<div align="center">

**Built with ☕ for fashion retail**

</div>

## Workspace verification and deployment

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter moon-store-client typecheck
pnpm --filter moon-store-client test
pnpm build:dashboard
pnpm --filter moon-store-server typecheck
pnpm --filter moon-store-server test
pnpm build:server
pnpm --filter @moon/storefront typecheck
pnpm build:storefront
```

`build:server` runs the existing TypeScript compiler configuration. Production still
runs `tsx index.ts`; no runtime or database changes are part of this migration.
The existing dashboard/server package names are retained. The dashboard owns React 18
and its `@types/react*` 18 packages; the storefront owns React 19. Libraries whose
declarations import `react` without a `@types/react` peer would otherwise resolve pnpm's
hidden hoist (`node_modules/.pnpm/node_modules/@types/react`, React 19), so dashboard
`tsconfig.json` `paths` pin `react`/`react-dom` declarations to its own node_modules.
Its existing test import of `@react-aria/i18n` is now an explicit dev dependency at the
previously locked version, because pnpm isolates dependencies. For the same reason
`@heroui/theme` is a direct dependency: `tailwind.config.js` scans
`./node_modules/@heroui/theme/dist`, and without it HeroUI's component CSS is silently
missing from the build.
`pnpm-lock.yaml` is the only lock for `apps/*`; the old root, dashboard and server
`package-lock.json` files were removed. E2E remains an independent npm package under
`e2e/` with its own `package-lock.json` and disposable PostgreSQL requirements.

The storefront installs the agreed base libraries without providers, components, API
routes, or API integration. Its page only renders "Moon Store".

Render uses the repository root so the pnpm workspace and lockfile are available.
Its start command filters to `moon-store-server`, preserving the API working directory.
Review hosted Render settings for overrides of the checked-in blueprint. For the existing
Vercel dashboard project, change the hosted Root Directory from `client` to
`apps/dashboard`; keep its existing environment variables and Vite build settings.
Storefront deployment is not configured. Preserve any absolute upload paths and external
scripts that refer to the old application locations.
