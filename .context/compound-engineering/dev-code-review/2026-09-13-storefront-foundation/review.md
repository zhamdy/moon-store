# Code review: storefront foundation (PR #193)

- Scope: `202d006..600cb19` (12 commits, 53 files), committed only
- Mode: interactive
- Plan: `docs/plans/2026-09-13-001-feat-storefront-foundation-plan.md` (explicit); all units checked, no unaddressed requirement found
- Team: correctness, testing, maintainability, project-standards, shaheen-react, api-contract, reliability, adversarial
- Skipped: learnings-researcher (no `docs/solutions/`), agent-native (no user actions), security (no auth/endpoints/input)

## Findings (deduplicated)

### Safe fixes (approved)
- S1 P2 hardcoded `en`/`ar` branches in `locale-switcher.tsx` and `[locale]/layout.tsx` (maintainability, standards, react)
- S2 P2 test fixtures and CLAUDE.md claim a `success` field the server never sends (`apps/server/src/http/responses.ts`) (api-contract)
- S3 P2 untyped translation keys; no next-intl `AppConfig` augmentation (react, testing)
- S4 P3 client tests inherit `API_URL`/`NEXT_PUBLIC_API_URL` from the environment (testing, correctness)
- S5 P3 non-OK JSON error body of the wrong shape untested (testing)
- S6 P3 root CLAUDE.md CI gates table missing Storefront job (standards)
- S7 P3 unused `endpoints` export; `SuccessBody` duplicates `ApiFetchResult` (maintainability)

### Gated fixes (user approved all)
- G1 P2 `LocaleSwitcher` uses `useTranslations`; provider without `messages` ships the full catalogue to the client (standards)
- G2 P2 `apiFetch` has no timeout (reliability)
- G3 P2 QueryClient retries 4xx three times (reliability)
- G4 P3 caller aborts reported as `NETWORK_ERROR` (reliability)
- G5 P3 `Button` defaults to `type=submit` (react)
- G6 P3 `next/image` `priority` deprecated in Next 16 (adversarial)

### Residual (not fixed in this PR)
- P3 dotted/unknown top-level paths skip the branded 404; no `global-not-found.tsx`, no favicon (adversarial, correctness, reliability)
- P3 locale switch drops query string and hash; matters once nuqs filters exist (correctness, adversarial, react)
- P3 footer copyright year frozen at build on SSG pages (correctness, adversarial)
- P3 `:lang(ar)` on the switcher link resolves an undefined `--font-plex-arabic` on /en (correctness, adversarial)
- P3 204 typed as `T`; `isSuccessBody<T>` is an unchecked cast (react)
- Release: server CORS default allows only :5173-5175; storefront origin must be added to `ALLOWED_ORIGINS` before the first browser-side call (api-contract)

### Residual risks noted
- tsconfig `paths` pin of `react`/`react-dom` to `@types` is also read by the bundler; CI build is the guard
- `resolveApiBaseUrl` takes the server branch during SSR of client components, so `API_URL` is required there
- Authenticated storefront calls (Bearer vs cookies, refresh) have no design yet
- Portaled mobile menu stays open across a resize past `lg`

## Applied fixes

All of S1-S7 and G1-G6 applied. Deviations:
- G1: `NextIntlClientProvider` kept with `messages={null}`. next-intl's client `usePathname`/`Link` read the locale from its context; left undefined, the server provider inherits the whole catalogue.
- G2: the re-review found the default timeout signal opted every server GET out of Next's per-render fetch memoization (`next/dist/docs/.../fetch.md` "Memoization"). The default now applies in the browser only; server callers opt in with `timeoutMs`.
- S3 surfaced two real untyped-locale uses (`generateMetadata`, `[locale]/page.tsx`), now guarded with `hasLocale` + `notFound()`.

Verification: typecheck, lint, 39 vitest tests pass. `next build` passed before the G2 server-default change; that change touches no rendered page, so CI covers the rebuild.
