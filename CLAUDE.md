# MOON Fashion & Style

Luxury fashion retail management system. Monorepo: React 18 SPA (Vite) + Express REST API (SQLite).

## Quick Start

```bash
# Terminal 1 — Server (port 3001)
cd server && npm run migrate && npm run seed && npm run dev

# Terminal 2 — Client (port 5173)
cd client && npm run dev
```

## Default Logins

| Email | Password | Role |
|-------|----------|------|
| admin@moon.com | admin123 | Admin |
| sarah@moon.com | cashier123 | Cashier |
| james@moon.com | delivery123 | Delivery |

## Git Workflow

- **Always branch from `main`** before starting a feature (`feature/xxx`, `fix/xxx`)
- Commit frequently with clear messages
- Merge back via PR
- Always update `FEATURES_ROADMAP.md` when working on features in it

## Build Warnings

Chunk size warning (>500KB) is expected for SPA bundle — safe to ignore.

## Documentation

| Doc | Path | When to Read |
|-----|------|-------------|
| **Architecture** | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Understanding project structure, stack, stores, pages, routing, theming, i18n, PWA |
| **API Reference** | [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | Working with endpoints, DB schema, auth flow, env vars, rate limits |
| **Conventions** | [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Writing new code — component patterns, naming, SQLite gotchas, feature checklist |
| **Smoke Test** | [`docs/SMOKE_TEST.md`](docs/SMOKE_TEST.md) | Manual QA after deployments or major changes |
| **Offline & PWA** | [`docs/OFFLINE_PWA.md`](docs/OFFLINE_PWA.md) | Understanding offline queue, service worker, caching strategies, PWA install |
| **Integrations** | [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) | Twilio SMS/WhatsApp, notification system, barcode scanning, PDF/CSV export |
| **Feature Roadmap** | [`FEATURES_ROADMAP.md`](FEATURES_ROADMAP.md) | 63 completed features across 3 waves — full specs and implementation details |

## Key Patterns (Quick Reference)

```
Server routes:    verifyToken + requireRole('Admin') middleware
DB queries:       db.query(sql, params) → { rows }  (pg-compat over SQLite)
Transactions:     const rawDb = db.db; rawDb.transaction(...)()
Pages:            React Query + react-hot-toast + shadcn Dialog/Sheet
i18n:             useTranslation() → { t, locale, isRtl }
Stores:           Zustand with persist middleware
Route ordering:   Specific routes BEFORE /:id params (Express matches first)
```
