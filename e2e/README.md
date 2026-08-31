# E2E — critical POS workflows

Playwright (Chromium) driving the **real client production build** against the **real
Express server** and a **real PostgreSQL database**.

The repo already has strong unit coverage on both halves: the client's money math is proven
against `contracts/checkout-totals.v1.json` through an in-process transport, and the server's
idempotency and stock invariants are proven against real PostgreSQL through direct service
calls. Nothing exercises the wire between them. This suite is that third layer.

> **⚠️ Disposable databases only.**
> `globalSetup` deletes every row in **77 tables** and restarts every public sequence.
> Never point this suite at staging or production. Its failure artifacts (traces, videos)
> record live session tokens and login request bodies — see [Artifacts](#artifacts).

## Running it

```bash
# 1. A disposable database. Any PostgreSQL you can CREATE on.
createdb moon_store_e2e
# ...or reuse the compose service:  docker compose -f docker-compose.test.yml up -d

# 2. Install once
npm ci --prefix e2e
npx --prefix e2e playwright install --with-deps chromium

# 3. Build the client. Deliberately a separate step, not part of webServer.
npm run build --prefix client

# 4. Run
cd e2e
E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/moon_store_e2e npm test

# The documented PR subset
E2E_DATABASE_URL=... npm run test:smoke
```

Playwright starts both servers itself (`webServer`), so nothing needs to be running first.
Locally `reuseExistingServer` attaches to a server already on port 3001 — which is exactly
why the preflight below exists.

### Environment

| Variable | Default | Why the E2E run sets it |
| --- | --- | --- |
| `E2E_DATABASE_URL` | **none — the run aborts** | The database the suite owns and resets. Also passed to the server as its `DATABASE_URL`. |
| `CLIENT_URL` | `http://localhost:5173` | The preview origin `:4173` is otherwise rejected by CORS. Set automatically by the config. |
| `RATE_LIMIT_MAX` | `200` | Global ceiling, per 15 min. Set automatically. |
| `AUTH_RATE_LIMIT_MAX` | `10` | The *binding* ceiling, on `/login` and `/refresh`. Set automatically. |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | none — the server hard-exits | Test literals, set automatically. |

Only `E2E_DATABASE_URL` is yours to provide; the config sets the rest for the server it
starts. `RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_MAX` are the only new production-facing
knobs, and both default to today's values, so an unset server behaves exactly as before.

Both limiters key on `req.ip` and every worker is `127.0.0.1` sharing one in-process
bucket. The binding constraint is the **auth** ceiling of 10 per 15 minutes, not the global
200: the suite would exhaust it within its first few logins, and the resulting `429` would
land on the session-expiry specs, where it is indistinguishable from the refresh-storm bug
those specs exist to catch.

## Safety: the two guards

Seeding is destructive, and the process that writes almost all test data is the **server**,
not this one. Guarding only the setup path would guard the wrong process. So:

1. **`E2E_DATABASE_URL` has no default.** Resolved at config load, so an unset variable
   aborts before any server starts. It never falls back to `DATABASE_URL`.
2. **A preflight asserts the running API is on that same database**, before any delete.
   The API exposes no database identity, so the check asks PostgreSQL: after `/api/health`
   (a real `SELECT 1`) succeeds, the server's pool must be visible in `pg_stat_activity`
   for the target database. Zero connections means the server is somewhere else — the
   realistic case being `reuseExistingServer` attaching to a dev server — and the run
   aborts rather than resetting a database nothing under test is reading.

## Layout

```
e2e/
├── playwright.config.ts   projects, webServer, the server env block
├── support/
│   ├── config.ts          paths, ports, the E2E_DATABASE_URL guard
│   ├── db.ts              read-only pg access for assertions the API does not expose
│   ├── settingsBaseline.ts the pinned tax/loyalty baseline
│   └── globalSetup.ts     migrate → seed → clear idempotency_keys → pin baseline
├── fixtures/              worker-scoped fixtures and the auth setup project
└── specs/                 the specs themselves
```

## Projects

| Project | Shape | What runs there |
| --- | --- | --- |
| `setup` | once | Logs in through the real form and writes `storageState`. Is itself the login smoke test. |
| `pos-parallel` | `fullyParallel` | Everything else. Asserts against the pinned settings baseline and **never writes settings**. |
| `pos-settings` | `workers: 1`, serial, ordered after `pos-parallel` | The only place that writes `PUT /api/v1/settings` — tax modes and loyalty. |

Tax and loyalty are **global** key/value rows, not per-sale inputs. A worker that flipped
`tax_enabled` would silently change the totals every other worker is asserting on, which is
why the mode variants are quarantined in their own serial project.

The baseline is pinned **tax disabled, loyalty enabled** — matching the dominant
configuration in `contracts/checkout-totals.v1.json`, six of whose ten cases specify
`tax.enabled: false`. Under a tax-enabled baseline those six could not be entered through
the UI and still reach the total the contract records.

## Conventions

- **Expected totals come from `contracts/checkout-totals.v1.json`, never hardcoded.** Both
  calculators are already proven against that file; re-deriving the numbers here would put
  the money rules in a third place.
- **Every money assertion is two-sided**: the cashier-visible state *and* the persisted
  server state. One POST with two rows, and two POSTs with one row, are different bugs.
- **Locators come from the i18n catalog**, not hardcoded strings — the app ships Arabic RTL
  by default. Where a role query cannot find an element, fix the accessible name; reaching
  for a test id there buries a real accessibility defect. Every test id added to production
  code carries a one-line comment saying why a role query was insufficient.
- **Every test creates the rows it mutates**, namespaced per worker. Never mutate shared
  seed rows, never assert on "the first row" or a global aggregate.

## Artifacts

Traces, videos and screenshots are captured on failure. **They contain live credentials** —
a trace records full request and response headers, including `Authorization: Bearer <JWT>`,
the `Set-Cookie` carrying the refresh token, and the login POST body. On a public repository
Actions artifacts are downloadable by anyone. Against a disposable database seeded with
credentials already published in `CLAUDE.md` the live exposure is small, which is exactly
why it would go unexamined. `e2e/playwright/.auth/` is gitignored and kept outside
`outputDir` so session state is never swept into an artifact.

## Not covered

Deliberate gaps, recorded so a green run is not mistaken for coverage it does not have:

- **The service worker's own behavior.** The production build registers Workbox with
  `StaleWhileRevalidate` on `/api/v1/products` and `NetworkFirst` on `/api/v1/sales`
  *reads*. The suite sets `serviceWorkers: 'block'`, because a stale product cache would
  shadow route mocks and feed 24-hour-old stock into the very assertions this suite exists
  to make. The residue is real: a deployed till can render cached stock rows and this suite
  never sees that. Compounding it, `registerType: 'autoUpdate'` with no update prompt
  anywhere in `client/src` means SW versions swap silently on reload with no user-visible
  surface at all. That behavior is unowned and this suite is formally not looking at it.
- **Camera barcode decoding.** `useScanner` drives Quagga2 against a real camera in
  `LiveStream` mode and there is no keyboard-wedge path. The *consequence* of a scan —
  the `GET /api/v1/products/barcode/:barcode` lookup and the resulting cart line — is
  covered; only the optical decode is not.
- **Cross-browser.** Chromium only until the suite is stable.
- **Gateway declines.** There is no payment processor: `PaymentMethod` is a label on the
  sale record. "Rejected payment" is read as a server-rejected sale.
- **Visual regression, performance, and load.**
