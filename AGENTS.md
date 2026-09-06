## Quick Start

```bash
# Terminal 1 — Server (port 3001)
cd server && npm run migrate && npm run seed && npm run dev

# Terminal 2 — Client (port 5173)
cd client && npm run dev
```

## Default Logins

| Email          | Password    | Role     |
| -------------- | ----------- | -------- |
| admin@moon.com | admin123    | Admin    |
| sarah@moon.com | cashier123  | Cashier  |
| james@moon.com | delivery123 | Delivery |

## Key Patterns

`client/src/` is three layers: `app/` (composition root — routing, shell, session wiring),
`features/` (nine domain slices), `shared/` (cross-cutting code, feature-agnostic). Full model,
dependency rules and diagrams: `docs/ARCHITECTURE.md`.

### The nine slices (`client/src/features/<slice>/`)

| Slice | Purpose |
|---|---|
| `auth` | Login, session/auth store, route guard |
| `pos` | Point of sale, register, shifts, cart, held carts |
| `inventory` | Products, stock, categories, bundles, pricing |
| `sales` | Sales history, promotions, gift cards, layaway |
| `customers` | Customer records, feedback, segments |
| `purchasing` | Distributors, vendors, expenses, purchase orders |
| `fulfillment` | Deliveries, online orders, storefront |
| `analytics` | Dashboard, reports, exports, AI insights |
| `admin` | Users, settings, audit log, backup, branches |

### Where does a file go? (R5 placement checklist)

1. Used by two or more slices? → `shared/`.
2. Is it the app shell or composition root? → `app/`.
3. Otherwise → the one slice that uses it.
4. Another slice needs it? → export it from that slice's `index.ts`. Never import deeper
   (`@/features/other-slice/pages/...` is a lint error).
5. Colocate the test beside the unit.

Full checklist detail, the global string-coupling contract (persist keys, shared React Query keys,
duplicated Sidebar route strings, global i18n files), and slice split/merge criteria:
`docs/CONVENTIONS.md`.

## Git Workflow

- **Always branch from `main`** before starting a feature (`feature/xxx`, `fix/xxx`)
- Commit frequently with clear messages
- Merge back via PR

## Build Warnings

Chunk size warning (>500KB) is expected for SPA bundle — safe to ignore.

## Learnings

- Baseline 001 was edited after deployment; applied filenames do not prove schema compatibility. Add forward migrations and test upgrades from the legacy schema, not only fresh databases. Migration 009 repairs the September production export. (2026-09-05)
