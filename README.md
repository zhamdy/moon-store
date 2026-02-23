# MOON Fashion & Style - Shop Management System

A full-stack shop management web application for a luxury fashion retail brand. Built with React + Vite (frontend) and Node.js + Express + PostgreSQL (backend).

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 15+
- **Twilio account** (optional, for SMS/WhatsApp delivery notifications)

## Quick Start

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE moondb;
```

Update `server/.env` with your database connection string:

```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/moondb
```

Run migrations and seed:

```bash
cd server
npm run migrate
npm run seed
```

### 3. Start Development

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### 4. Default Login

| Email | Password | Role |
|-------|----------|------|
| admin@moon.com | admin123 | Admin |
| sarah@moon.com | cashier123 | Cashier |
| james@moon.com | delivery123 | Delivery |

## Twilio Setup (Optional)

For SMS and WhatsApp delivery notifications:

1. Create a [Twilio account](https://www.twilio.com)
2. Get your Account SID and Auth Token from the console
3. Get a Twilio phone number for SMS
4. Set up the [WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/sandbox) for testing
5. Update `server/.env`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=+1234567890
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Without Twilio configured, notifications are logged to the console instead.

## Features

- **Dashboard** - KPI cards, revenue charts, top products, payment breakdown (Admin)
- **Point of Sale** - Product search/scan, cart management, checkout with offline support
- **Inventory** - Full CRUD with sorting, filtering, CSV import, low stock alerts
- **Barcode Tools** - Camera scanner, barcode generator, bulk print
- **Deliveries** - Order management with status tracking, SMS/WhatsApp notifications
- **Sales History** - Filterable history with CSV export, sale detail breakdown
- **User Management** - Role-based user CRUD (Admin, Cashier, Delivery)
- **PWA** - Installable, offline POS with background sync

## Tech Stack

### Frontend
- React 18 + Vite
- React Router v6
- Tailwind CSS + shadcn/ui (custom dark theme)
- Zustand (state management)
- TanStack React Query v5 (server state)
- TanStack React Table v8 (data tables)
- React Hook Form + Zod (forms/validation)
- Recharts (analytics charts)
- @ericblade/quagga2 (barcode scanning)
- jsbarcode (barcode generation)
- vite-plugin-pwa (PWA support)

### Backend
- Node.js + Express
- PostgreSQL via `pg`
- JWT authentication (access + refresh tokens)
- bcrypt (password hashing)
- Twilio SDK (SMS/WhatsApp)
- Zod (validation)
- helmet, cors, express-rate-limit (security)

## Project Structure

```
moon-store/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/          # Logo SVG
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   ├── charts/      # Recharts components
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── DataTable.jsx
│   │   │   ├── CartPanel.jsx
│   │   │   ├── BarcodeScanner.jsx
│   │   │   ├── BarcodeGenerator.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   └── PWAInstallPrompt.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── POS.jsx
│   │   │   ├── Inventory.jsx
│   │   │   ├── BarcodeTools.jsx
│   │   │   ├── Deliveries.jsx
│   │   │   ├── SalesHistory.jsx
│   │   │   └── Users.jsx
│   │   ├── store/            # Zustand stores
│   │   ├── services/         # Axios API client
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Utilities
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── server/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   ├── sales.js
│   │   ├── delivery.js
│   │   ├── analytics.js
│   │   └── users.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── services/
│   │   └── twilio.js
│   ├── db/
│   │   ├── index.js
│   │   ├── migrate.js
│   │   ├── seed.js
│   │   └── migrations/
│   ├── validators/
│   ├── index.js
│   └── package.json
└── README.md
```

## Available Scripts

### Server

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with auto-reload |
| `npm start` | Start production server |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database with sample data |

### Client

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## PWA & Offline Mode

The app is a Progressive Web App with offline support:

1. **Install**: After 30 seconds on first visit, an install prompt appears
2. **Offline POS**: Products are cached; sales made offline are queued
3. **Background Sync**: When back online, queued sales sync automatically
4. **Build PWA**: Run `npm run build` in `/client`, then serve the `dist/` folder

To test offline mode:
1. Build the client: `cd client && npm run build`
2. Serve with: `npm run preview`
3. Open DevTools > Application > Service Workers
4. Check "Offline" to simulate offline mode
5. Make a sale in POS - it will be queued
6. Uncheck "Offline" - queued sales sync automatically

## API Response Format

```json
// Success (single)
{ "success": true, "data": { ... } }

// Success (list)
{ "success": true, "data": [...], "meta": { "total": 100, "page": 1, "limit": 25 } }

// Error
{ "success": false, "error": "Human readable message" }
```

## Environment Variables

### Server (`server/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | JWT refresh token secret (min 32 chars) |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_PHONE` | Twilio phone number for SMS |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp sender |
| `CLIENT_URL` | Frontend URL for CORS |

### Client (`client/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
