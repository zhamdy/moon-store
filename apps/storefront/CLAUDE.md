@AGENTS.md

# Storefront Contract

This is the foundation built by the `2026-09-13-001-feat-storefront-foundation` plan.
It covers locale routing, design tokens, the API client and the global shell. No
commerce surface exists yet — every nav target 404s through the catch-all.

## Design guideline

The visual source of truth is `docs/design/moon-fashion-website-design-guideline.md`
(moved out of `public/` so it isn't publicly served). The original logo artwork is
`docs/design/brand/moon-fashion-logo-original.png`.

## Token and utility vocabulary

Semantic Moon utilities (`bg-bg`, `bg-surface`, `bg-surface-soft`, `text-text`,
`text-text-secondary`, `border-border`, `bg-brand`/`text-brand-dark`, `bg-action`/
`text-on-action`, `bg-disabled`/`text-disabled`/`border-disabled`) and the `type-*`
typography utilities (`type-display-xl` … `type-caption`, `type-label`) are the
preferred API — components never reference `--moon-*` custom properties directly.
Default Tailwind utilities (`text-white`, `bg-black`, `rounded-sm`, …) remain
available and are sometimes the right choice, but reach for the semantic name first;
raw palette values belong only inside the token layer (`app/globals.css`).

Tailwind's own built-in `stone-*` palette is a trap here: the guideline's `--moon-
stone-*` tokens are **not** exposed as `stone-*` utilities (that name is already
Tailwind's own grey scale, a different, coincidentally similar colour). Any state
that needs a `--moon-stone-*` value gets its own semantic name instead — see
`--color-disabled` in `app/globals.css`.

`type-*` names are deliberately outside the `text-*` group so `tailwind-merge`
never needs configuring: `type-h1 text-text` is two unrelated utilities, not a
conflict. `lib/utils/cn.ts` stays plain `twMerge(clsx(...))` because of this — if a
future addition needs merge groups configured, that decision belongs there, not
worked around per-callsite.

## Locale and RTL rules

- `i18n/routing.ts` is the one source of truth for locales (`en`, `ar`), the default
  locale and the direction map. `proxy.ts`, the root layout, `i18n/navigation.ts` and
  `generateStaticParams` all read from it — don't hardcode the locale list elsewhere.
- Always use `Link`/`redirect`/`usePathname`/`useRouter` from `@/i18n/navigation`, never
  `next/link` or `next/navigation` directly — those don't carry the locale prefix.
- Logical CSS properties throughout (`padding-inline`, `inset-inline-start`, Tailwind's
  `start-*`/`end-*`/`ps-*`/`pe-*`, the `rtl:` variant) — never `left`/`right` or `ml-*`/
  `mr-*` for anything that should mirror under `[dir="rtl"]`.
- `proxy.ts`'s matcher skips any path segment containing a dot (next-intl's recommended
  pattern, so static files aren't locale-redirected). A future route segment with a dot
  in it (a file extension-shaped slug, for instance) would silently bypass locale
  handling — the root layout's `hasLocale` guard is defence in depth against that, but
  the matcher is the thing to fix if it happens.
- "Noto Serif Arabic", named in the original design guideline, was not available
  through any font source or tooling verified for this project — the installed
  `next/font` catalog, Google's own font metadata API, Fontsource, and the notofonts
  GitHub org all came back with no match (see `app/fonts.ts`). Moon Fashion uses
  **Noto Naskh Arabic** as its Arabic display font instead (user decision,
  2026-09-13); IBM Plex Sans Arabic remains the Arabic UI/body face. If the guideline
  doc is ever revised, its Arabic display font section is stale against that
  decision.
- `app/fonts.ts` calls all four font loaders in one module, so `next/font` preloads
  every face on every locale's render, not just the active pair — confirmed in the
  built HTML. The Arabic pair opts out with `preload: false` since `en` is the default
  locale; don't add a fifth family here without rechecking preload output.

## Client boundary rule

Server Components by default (R21/R22). `"use client"` is limited to three places:

1. `providers/app-providers.tsx` / `providers/query-provider.tsx` — the provider tree.
2. `components/layout/mobile-menu/mobile-menu.tsx` — Headless UI's Dialog needs state.
3. `components/layout/locale-switcher.tsx` — needs `usePathname` to preserve the
   current path across a locale switch.

Client islands receive translated strings as props, never the message catalogue —
`MobileMenu`'s props are `menuLabel`/`closeLabel`/`primaryLabel`/`accountLabel`, a
resolved `items` array and `localeSwitcher`; `LocaleSwitcher`'s are `groupLabel` and
`labels: Record<AppLocale, string>`, resolved on the server by
`components/layout/locale-labels.ts` — not a namespace object. The layout's
`NextIntlClientProvider` passes `messages={null}` on purpose: it stays for the locale
(next-intl's client `usePathname`/`Link` read it from context), but left undefined it
would inherit and ship the whole catalogue. No client file calls `useTranslations`; one
that needs to would bring the catalogue back. Before adding a fourth `"use client"`
boundary, check whether the interactive part can be isolated into a small leaf instead
of converting an entire Server Component tree.

`NavLink` looks like it should need the current pathname (for `aria-current`), but it
doesn't — there's no real routing yet (see Scope Boundaries below), so it takes an
explicit `current?: boolean` prop that every caller currently passes as `false`. That's
the seam a future page wires up; it does not need `usePathname`.

## Known technical debt: the React 19 `tsconfig` paths pin

`tsconfig.json`'s `paths` pins `react`/`react-dom` to this app's own `node_modules/
@types/react` (19.x). This is a **temporary workspace type-resolution workaround**,
not a permanent architectural requirement:

- The dashboard intentionally stays on React 18; the storefront intentionally uses
  React 19. That split is deliberate and this workaround doesn't change it.
- The problem: `@tanstack/react-query`'s own `.d.ts` has no local `@types/react`, so
  under pnpm it resolved a workspace-shared type hoist that happened to hold the
  dashboard's React 18 types instead of the storefront's own 19 — a real `ReactNode`
  mismatch, not a false positive. `apps/dashboard/tsconfig.json` carries the mirror
  fix for the same hoist landing on the storefront's 19 instead of the dashboard's 18.
- **Do not remove this pin** without first confirming normal (non-pinned) resolution
  now works — rerun `typecheck` with the pin removed.
- **Re-test after upgrading** React, React DOM, TanStack Query, TypeScript, or pnpm —
  any of these could change whether the hoist collision still happens.
- **Do not copy this `paths` block into another package automatically.** It's a fix
  for a specific collision this app hit, not a template — a future package should
  only add it if it actually reproduces the same symptom.

## Feature slice shape (documented, not scaffolded)

No `features/`, `hooks/` or `types/` directories exist yet — none is needed until a
real unit of commerce work lands. When one does, it follows this shape:

```
features/<slice>/
  api/        # calls into lib/api, feature-specific query hooks
  components/ # feature-owned UI, not reused elsewhere
  schemas/    # zod schemas for this feature's forms/params
  types/      # DTOs specific to this feature (not server/db types — see below)
  utils/
```

`app/` composes routes and layout; `features/` implements. A component used by two or
more slices moves to `components/` (or a new `shared/`, if that need actually arrives)
rather than being imported cross-slice.

## API client and the DTO rule

`lib/api/client.ts`'s `apiFetch<T>` is the only thing that should call the Express API.
It unwraps the server's `{ data, meta }` envelope and throws `ApiError` for
anything else — see `lib/api/errors.ts` for the code union and `lib/api/client.test.ts`
for the exact contract (204 handling, error shapes, network failures).

The 10s default timeout (`TIMEOUT`) applies **in the browser only**. On the server,
Next excludes any `fetch` carrying a `signal` from per-render memoization, so a default
deadline would make every GET shared between a layout and its page hit the API twice.
Server callers that need a deadline pass `timeoutMs`, knowingly giving up memoization
for that call.

Types added under `lib/api/endpoints.ts` or a future `features/*/types/` model the
API's response DTOs. They must never be the server's repository or database types —
the storefront has no visibility into `apps/server`'s internals and must not gain any
(verified by Unit 6: nothing under `apps/storefront` imports from `apps/server` or
`apps/dashboard`).

### `API_URL` vs `NEXT_PUBLIC_API_URL`

- `API_URL` — server-only, read **at runtime** (`process.env.API_URL` inside
  `resolveApiBaseUrl()`, not module-load-cached). One build can be promoted across
  environments. Missing in production: throws, naming the variable, before any
  `fetch` call.
- `NEXT_PUBLIC_API_URL` — browser-only, inlined at `next build`. Missing in
  production: `console.error` naming the variable, falls back to same-origin (mirrors
  `apps/dashboard/src/shared/lib/apiBase.ts` — a page that can't reach its API should
  fail visibly, not take the whole app down).
- Both fall back to `http://localhost:3001` outside production.
- Nothing calls the API yet, so neither path has run during a real `next build`. The
  first statically rendered page that fetches data must have `API_URL` set in the
  build environment — this is the thing that will silently break if forgotten.

## Logo rule

`public/brand/moon-fashion-logo.png` and `moon-fashion-mark.png` are lossless
derivatives of `docs/design/brand/moon-fashion-logo-original.png`: background removed
to transparency and canvas trimmed, nothing else. No redraw, recolour, re-layout or
new composition — a horizontal lockup or any other new artwork is a separate,
designed-and-approved brand task, not something to generate here.

To swap either file: replace the PNG at its existing path, then update its `width`/
`height` in `lib/brand/logo-assets.ts` (the only place those dimensions are recorded).
`BrandLogo` derives the rendered width from that ratio — it never needs a code change
for a same-shape asset swap.

## Rendering strategy

`/en` and `/ar` prerender as static HTML today (confirmed in the build output: both
list as `●` SSG, not `ƒ` dynamic) — that is this foundation's *current state*, not an
architectural rule. `generateStaticParams` + `setRequestLocale` make that possible
because nothing here reads request-specific data. The first feature that needs
per-request data (a cart, a session) chooses its own caching/revalidation/dynamic
strategy on its own merits; nothing about this file requires staying static.

## Mobile menu typography exception

The mobile menu's primary links render at `type-h3`, not the `type-label` every other
nav link uses — a deliberate editorial choice (guideline §5 exception), passed through
`NavLink`'s `typography` prop rather than via `className`. See that prop's doc comment
for why: `tailwind-merge` doesn't know about the custom `type-*` utilities, so two of
them on one element would both apply and the CSS source order — not the component
prop — would decide which wins.

## Nothing is shared with the dashboard

No import between `apps/storefront` and `apps/dashboard` in either direction, and no
shared UI or theme package. Each app's tokens, components and conventions are its own;
a pattern that looks reusable is a candidate for a deliberate future package, not an
implicit cross-app import today.
