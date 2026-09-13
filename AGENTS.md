## Quick Start

Run `pnpm install` at the repository root first. The workspace contains
`apps/dashboard`, `apps/server`, and the empty `apps/storefront` Next.js shell.
Use `pnpm dev:storefront` for the shell on port 3000.

```bash
# Terminal 1 — Server (port 3001)
cd apps/server && npm run migrate && npm run seed && npm run dev

# Terminal 2 — Client (port 5173)
cd apps/dashboard && npm run dev
```

## Default Logins

| Email          | Password    | Role     |
| -------------- | ----------- | -------- |
| admin@moon.com | admin123    | Admin    |
| sarah@moon.com | cashier123  | Cashier  |
| james@moon.com | delivery123 | Delivery |

## Key Patterns

`apps/dashboard/src/` is three layers: `app/` (composition root — routing, shell, session wiring),
`features/` (nine domain slices), `shared/` (cross-cutting code, feature-agnostic). Full model,
dependency rules and diagrams: `docs/ARCHITECTURE.md`.

### The nine slices (`apps/dashboard/src/features/<slice>/`)

| Slice | Purpose |
|---|---|
| `auth` | Login, session/auth store, route guard |
| `pos` | Point of sale, register, shifts, cart, held carts |
| `inventory` | Products, stock, categories, collections; bundles (postponed) |
| `sales` | Sales history, promotions, gift cards |
| `customers` | Customer records, segments; feedback and warranty (postponed) |
| `purchasing` | Distributors, expenses, purchase orders |
| `fulfillment` | Deliveries; online orders and storefront (postponed) |
| `analytics` | Dashboard, advanced analytics, exports |
| `admin` | Users, settings, audit log; branches (postponed) |

A postponed feature keeps its code in its slice and is hidden by one list,
`shared/lib/postponedFeatures.ts`; see `apps/dashboard/CLAUDE.md`.

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

- Applications live under `apps/`; root contracts stay under `contracts/`. E2E is independently npm-managed. The server still starts through tsx; `build:server` only compiles its existing tsconfig. (2026-09-13)
- Dashboard `tsconfig.json` `paths` pin `react`/`react-dom` declarations to its own `@types` 18. Without them, library `.d.ts` files that import `react` (no `@types/react` peer) resolve pnpm's hidden hoist `node_modules/.pnpm/node_modules/@types/react`, which is the storefront's 19 — 457 JSX errors. (2026-09-13)
