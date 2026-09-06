<div align="center">

# 🌙 MOON Store

**نظام نقاط البيع للأزياء والموضة**

A full-stack, bilingual (Arabic/English) Point of Sale system built for fashion retail — from a single boutique to multi-branch operations.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![HeroUI](https://img.shields.io/badge/HeroUI-2.6-000000)](https://heroui.com)

</div>

---

## ✨ Features

### 🛒 Point of Sale
- Fast barcode scanning (camera + manual entry)
- Product search with variant picker (size, color)
- Multi-payment support (cash, card, split)
- Hold & recall carts
- Refunds and exchanges
- Register sessions with cash-in/out tracking
- Shift management (clock-in, breaks, clock-out)

### 📦 Inventory
- Full product catalog with SKU & barcode generation
- Product variants (size, color, custom attributes)
- Categories, collections, and product bundles
- Smart pricing rules and price history
- Stock counts with variance reporting
- Stock adjustments with reason logging
- Low-stock alerts and ABC classification
- Label/barcode printing templates

### 💰 Sales & Promotions
- Sales history with detailed receipts
- Promotions & discount rules engine
- Coupon management (percentage, fixed, BOGO)
- Gift cards (issue, redeem, track balance)
- Layaway plans with scheduled payments
- Customer loyalty points system

### 👥 Customers
- Customer database with purchase history
- Loyalty points (earn & redeem)
- Customer segments for targeted marketing
- Feedback collection and product reviews

### 🚚 Fulfillment & Purchasing
- Delivery tracking with status timeline
- Online order management
- Storefront configuration
- Purchase orders for distributor restocking
- Vendor management with commissions and reviews
- Expense tracking by category
- Shipping company management

### 📊 Analytics & Intelligence
- Real-time dashboard with KPI widgets
- Sales by category & distributor charts
- Cashier performance metrics
- Custom report builder with saved reports
- CSV/PDF export for any chart or full dashboard
- AI chat assistant for business insights
- Sales predictions and auto product descriptions

### ⚙️ Administration
- Role-based access control (Admin, Cashier, Delivery)
- Multi-branch support with inter-store transfers
- System-wide settings (currency, tax/VAT, locale)
- Audit log for all user actions
- Notification center (low-stock, sale alerts)
- Data backup management

### 🌐 Bilingual & RTL
- Full Arabic (العربية) and English UI
- Right-to-left layout support
- Tajawal typography for Arabic readability

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
├── client/                     # React SPA
│   └── src/
│       ├── app/                # Shell, providers, composition root
│       ├── features/           # 9 domain slices
│       │   ├── admin/          #   Users, settings, audit, branches
│       │   ├── analytics/      #   Dashboard, reports, exports, AI
│       │   ├── auth/           #   Login, session store, route guard
│       │   ├── customers/      #   Customer records, segments, feedback
│       │   ├── fulfillment/    #   Deliveries, online orders, storefront
│       │   ├── inventory/      #   Products, stock, categories, bundles
│       │   ├── pos/            #   Register, cart, shifts, barcode tools
│       │   ├── purchasing/     #   Vendors, expenses, purchase orders
│       │   └── sales/          #   History, promotions, gift cards, layaway
│       ├── routes/             # TanStack file-based route definitions
│       └── shared/             # Components, hooks, i18n, types, utils
│
├── server/                     # Express API
│   └── src/
│       ├── config/             # Environment validation (Zod)
│       ├── database/           # Pool, migrations, seed data
│       └── modules/            # 6 domain groups
│           ├── core/           #   Auth, users, settings, audit, branches
│           ├── commerce/       #   Customers, coupons, gift cards, vendors
│           ├── fulfillment/    #   Delivery, expenses, purchase orders
│           ├── intelligence/   #   Analytics, reports, AI, notifications
│           ├── inventory/      #   Products, categories, bundles, stock
│           └── pos/            #   Sales, register, shifts, exchanges
│
└── docs/                       # Architecture docs & plans
```

Each server module follows a **5-file pattern**: `types.ts` → `repository.ts` → `service.ts` → `controller.ts` → `routes.ts`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **npm** ≥ 9

### 1. Clone & Install

```bash
git clone https://github.com/zhamdy/moon-store.git
cd moon-store

# Install root dev dependencies (husky, lint-staged)
npm install

# Install client & server
cd client && npm install && cd ..
cd server && npm install && cd ..
```

### 2. Configure Environment

Create `server/.env`:

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
cd server
npm run migrate
npm run seed
```

### 4. Start Development

```bash
# Terminal 1 — API server (port 3001)
cd server && npm run dev

# Terminal 2 — Client dev server (port 5173)
cd client && npm run dev
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

### Client (`client/`)

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

### Server (`server/`)

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
# Client tests (148 tests, 21 suites)
cd client && npm test

# Server tests (database pool, migrations, seeds, transactions)
cd server && npm test
```

---

## 🚢 Deployment

The project includes a [`render.yaml`](render.yaml) for one-click deployment to [Render](https://render.com):

- **API**: Node.js web service running `npm run migrate && npm run start`; seed demo data only in development.
- **Database**: Add a PostgreSQL instance on Render and set `DATABASE_URL`
- **Client**: Deploy the `client/` build output to any static host (Vercel, Netlify, Render Static)

For databases created before the baseline schema corrections, migration 009 upgrades
the legacy tables and columns in a single transaction. Back up production before
deploying and set the Render dashboard Start Command to match `render.yaml`.
Stop application writes during this upgrade: old code cannot use renamed tables
or columns after it commits. A failed deployment can leave the old instance running.
Verify favorites, notifications, bundles, segments, layaway, distributors and
collections after deployment. Do not clear `_migrations` or run production seeding.

The repair retains legacy data, renames bundle/layaway tables in place (preserving
foreign keys), and imports serialized layaway items with explicit product IDs,
quantities and `unit_price` or `price`. Ambiguous tables or malformed items abort the
transaction. Legacy notifications without an owner remain unassigned; the repair
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
