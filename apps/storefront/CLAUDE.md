@AGENTS.md

# Storefront Contract

The foundation (`2026-09-13-001-feat-storefront-foundation` plan) covers locale routing,
design tokens, the API client and the global shell. The homepage, header surface, mobile
menu panel and footer come from `2026-09-13-002-feat-storefront-homepage-header-footer`.
The homepage is the only commerce surface: every nav, card and tile target still 404s
through the catch-all, by design — no placeholder pages.

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
worked around per-callsite. Two `type-*` utilities on one element are never merged,
so never pass a second one through `className`; the one sanctioned pairing is a
responsive variant on the same element (`type-display md:type-display-xl`, the hero
title), where Tailwind emits the variant after the base utility and the winner is
deterministic.

### Surfaces: the `--surface-*` indirection

The semantic colours are declared `@theme inline`, so `text-text` compiles to the
*value* (`var(--surface-text)`), not to `var(--color-text)` — a scoped `--color-text`
override is inert (verified in the built CSS). Colours therefore get the same seam
fonts already use (`--font-display: var(--font-display-active)`): `--surface-bg`,
`--surface-text`, `--surface-text-secondary` and `--surface-border` on `:root`, mapped
into `--color-bg` / `--color-text` / `--color-text-secondary` / `--color-border`, and a
surface overrides the `--surface-*` variables:

| `data-surface` | Where | Effect |
| --- | --- | --- |
| `ink` | the footer, the hero, the promo banner, the campaign, primary `Button` | ink bg, ivory text, stone-600 hairline, ivory focus ring |
| `overlay` | resolved on the header (see below) | transparent bg and border, ivory text, ivory focus ring |
| `auto` | what the header renders from the server | overlay when the page has a header boundary, solid otherwise |
| `solid` | written by `HeaderShell` as soon as the page scrolls | the defaults |

Components keep reading `text-text` / `bg-bg` / `border-border` and never set colours
per surface. Never override raw `--moon-*` in scope (it would also recolour
`--color-action`), and never move colours out of `@theme inline` for one feature.

### The header boundary

The header has no route awareness. The homepage hero's root carries the attribute
exported from `components/layout/header/header-boundary.ts` (`HEADER_BOUNDARY_ATTR`);
`header-shell.tsx` checks for that element and, where it exists, turns the header solid
as soon as the page scrolls at all (`scrollY > 0`, one passive listener); it is
transparent over the hero only at the very top (user decision, 2026-09-13).
The server HTML is already correct with no JS: `body:has([data-header-boundary])
header[data-surface='auto']` in `globals.css` applies the overlay surface, so there is
never an ivory→transparent flip on load; the shell only narrows to `solid` and back to
`auto`. The shell lives in the locale layout and survives client-side navigation while
the page is swapped beneath it, so it looks the boundary up again on every pathname
change (its one `usePathname` use) and resets to `auto` first — otherwise a 404 → home
transition would leave the header stuck on whatever surface the last page ended on. The attribute string lives in three places — the constant (two TypeScript
consumers, so a rename fails typecheck) and, by hand, that one CSS selector. Pages with
no boundary element (the 404 page, every future page) are solid and need nothing.

`--header-h` is `64px` below 1024 and `80px` from it; the header is `position: sticky`
and keeps that flow slot. The hero pulls up beneath it with `-mt-(--header-h)` and pads
its own content by the same amount — non-home pages are untouched. The accepted
degraded case is no JS *and* scrolled: the header stays transparent, readable over the
hero because of its scrim but not over the ivory sections below; no-JS is not a supported browsing
mode here. Browsers without `:has()` get a solid header over the scrimmed hero.

The gold logo is never recoloured for the overlay surface: the hero is dusk-toned so
gold and ivory read on it, and contrast is code-guaranteed by scrims, not by the image
(see *Image pipeline*). A stacked lockup at 52px is the known cost of "no new logo
composition"; a brand-approved horizontal lockup is the unblock, still deferred.

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
- Faces (user decision, 2026-09-13, superseding the guideline's Bodoni Moda / Manrope
  and Noto Serif Arabic / IBM Plex Sans Arabic): English display **Lora**, English
  body/UI **Inter**; Arabic **Tajawal** for both roles (`app/fonts.ts`). Tajawal is not
  a variable font, so its weights are listed there. The guideline's typography chapter
  is stale against this decision. The `type-*` line-heights under `:lang(ar)` were
  tuned for a Naskh face; Tajawal's shorter ascenders may allow tightening them after
  the screenshot review.
- `app/fonts.ts` calls all three font loaders in one module, so `next/font` preloads
  every face on every locale's render, not just the active family — confirmed in the
  built HTML. The Arabic face opts out with `preload: false` since `en` is the default
  locale; don't add a fourth family here without rechecking preload output.

## Client boundary rule

Server Components by default (R21/R22). `'use client'` is limited to seven entries
(eight files):

1. `providers/app-providers.tsx` / `providers/query-provider.tsx` — the provider tree.
2. `components/layout/mobile-menu/mobile-menu.tsx` — Headless UI's Dialog needs state.
3. `components/layout/locale-switcher.tsx` — needs `usePathname` to preserve the
   current path across a locale switch. Exports both `LocaleSwitcher` (the
   both-locales list in the mobile menu) and `LocaleToggle` (the
   header's single link to the other locale); one module, one boundary.
4. `components/layout/header/header-shell.tsx` — owns the `IntersectionObserver` that
   narrows the header surface; takes children only.
5. `components/motion/reveal.tsx` — one shared `IntersectionObserver` that flips a
   `data-reveal` state; every transition it triggers is CSS declared on server markup.
   Takes children only.
6. `components/motion/parallax.tsx` — `scroll()` from `motion` driving a WAAPI
   animation from `motion/mini`. Takes children only.
7. `features/home/components/hero/hero-carousel.tsx` — which hero slide is active,
   autoplay, tabs, swipe. Slide content arrives server-rendered as `ReactNode`s and
   every string arrives resolved; it renders no image itself.

`components/motion/text-reveal.tsx` is deliberately *not* a boundary: it only splits a
heading into masked word spans on the server.

**Nothing imports from `motion/react`.** Its named exports do not tree-shake apart: one
`useInView` import put the whole engine (~46 KB gz across two chunks) into the eager
bundle, measured on the built `/en` page. The vanilla `motion` / `motion/mini` entries
cost ~9 KB gz for the parallax. Measure the eager chunks of `.next/server/app/en.html`
after touching anything under `components/motion/` before trusting a size claim.

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
doesn't — there's no real routing yet (only the homepage exists), so it takes an
explicit `current?: boolean` prop that every caller currently passes as `false`. That's
the seam a future page wires up; it does not need `usePathname`.

## Motion

Three levels, set in the 2026-09-14 motion pass: **signature** (hero, editorial strip,
featured collection, campaign, promo banner), **section** (headings, product grids,
categories, The Edit, benefits) and **micro** (hover and link states, 180–400ms).
Transform, opacity and clip-path only; nothing hijacks scroll, pins, bounces or blocks
interaction. One easing for entrances (`--ease-editorial`), one for UI (`--ease-ui`).

1. **Hero** — CSS keyed on the carousel's `data-active` / `data-leaving`, so the first
   slide plays from the server HTML with no JS. Sequence on load and on every change:
   image 1.08 → 1 from 120ms, label wipe (`data-enter="wipe"`) at 200ms, masked title
   lines at 300/420ms, copy at 450ms, link at 600ms; the tab row settles at 750ms on
   load. The outgoing slide fades over 1s while its image drifts to 1.04 and its title
   exits upward through the same masks. Progress bars are empty before hydration
   (`idle`), fill over 7s while rotating, and refill quickly on each manual change once
   stopped.
2. **Scroll reveal** — `<Reveal>` is a *trigger*, not an effect. The server HTML is the
   visible state; on mount `decideInitialRevealState` (`reveal-policy.ts`, unit-tested)
   marks only elements entirely below the fold as `pending`, never under reduced motion,
   and a shared observer flips them to `in`. What moves is declared on server markup
   with `data-motion="rise" | "fade" | "image" | "wipe" | "word"` (plus
   `data-motion-zoom` inside an `image`), on the Reveal or any descendant. Timing is
   `--motion-stagger` (inherited step count) × `--motion-step` + `--motion-offset`;
   offset and duration are registered `@property`s that do **not** inherit, so set them
   on the element that moves. Distances use `--motion-rise`, scaled by 0.6 below 768px.
   The rules live in `@layer components` so utility classes override their defaults.
   `amount` is a bottom root margin, not an intersection ratio, so a Reveal taller than
   the viewport still fires. Nested Reveals are safe (an outer one always fires first).
   Still never inside the horizontal rails' *items* on phones: off-screen rail cards do
   not intersect until swiped, so the lookbook has no reveal and category tiles share
   their grid's single trigger.
3. **TextReveal** — masked headlines split **by word**, not by rendered line: the break
   depends on locale, font and viewport, and measuring it would need client JS. The
   heading carries `aria-label` and the word spans are `aria-hidden`, so it is headings
   only (`h2`/`h3`).
4. **Parallax** — `<Parallax travel mode>`; `travel` is signed and halved below 768px.
   `layer` (default) moves an over-scaled image inside a clipped frame (banner 7%,
   campaign 6%); `element` moves the whole element through the independent `translate`
   property, so it composes with a Reveal transform (featured small image 8%, lookbook
   +5/−4/+7/−3/+5% from 1024 via `media`). A paused WAAPI animation whose time is set
   from `scroll()`'s progress callback (see the component comment for why the animation
   form of `scroll()` is avoided). The layer over-scale is CSS and collapses under
   reduced motion.
5. **Marquee** — `<Marquee duration gap>` (a Server Component in the home
   slice): pure CSS, two content-sized tracks (never stretched: the spare space would
   pile up at the seam), each repeating the content so a track outruns any viewport.
   The strip keeps words and details alternating in one track (34s per set). A
   separate faster image layer floating over the words was tried and rejected by the
   user (2026-09-14) as clutter; depth comes instead from each photograph drifting
   inside its own over-scaled frame (`[data-strip-pan]`, pure CSS, out of step per
   image). Hover pauses both; reduced motion stops both.

**Reveal and hover never share an element.** A `transition-*` utility replaces the
element's whole `transition-property`, so a hover transition on an element carrying
`data-motion` would make its reveal snap. Hover lives on an inner wrapper (product
card, category tile) or the reveal on an outer one (section links, banner button).
Tailwind's hover utilities use the separate `scale` / `translate` properties, so they
never collide with the reveal's `transform`.

`Reveal` and `Parallax` read `prefers-reduced-motion` at mount (`Parallax` also
re-attaches when it or the breakpoint changes); `HeroCarousel` subscribes to it, so
turning the setting on mid-session stops autoplay immediately.

The hero has **no pause button** (user decision, 2026-09-13). WCAG 2.2.2 still needs a
way to stop content that moves for more than five seconds, and the carousel's is
interaction: clicking a tab, an arrow key, a swipe or any keyboard focus inside the hero
stops rotation for the rest of the visit, and hovering pauses it. That is less
discoverable than a visible control; if an accessibility review asks for one, it goes
back as the first control before the tablist, per the WAI-ARIA carousel pattern. The global reduced-motion rule zeroes animation and
transition *delays* as well as durations — with `fill-mode: both`, a zero-duration
animation would otherwise hold its `from` state for the whole stagger. Embla is
installed but unused: CSS scroll-snap gives the category and lookbook rails swipe,
keyboard and RTL for free.

## Image pipeline

Every homepage image is a static import behind one registry, swappable by file drop:

- Files live in `assets/editorial/<slot>.jpg` (not `public/` — static imports give
  `next/image` width, height and blur for free). Root `.gitignore` ignores `*.jpg`
  except this directory.
- `lib/editorial/slots.ts` is the plain list of slot names (no image imports, so data
  tests can validate references under vitest); `lib/editorial/images.ts` is the only
  module that imports the files and binds each slot to `{ src, role }`. No spec may
  import `images.ts`.
- `lib/editorial/asset-guard.ts` (`checkEditorialAssets`) is a pure comparison of a file
  list against `editorialSlots` + `catalogSlots`; `lib/editorial/assets.test.ts` runs it
  against the real `assets/editorial/` directory and fails the storefront test gate on an
  orphan file, a missing slot or a non-`.jpg` extension. It never imports `images.ts`.
- Alt text is a message key resolved by the consuming section, so it localises.
- `docs/design/editorial-image-brief.md` lists every slot's ratio, minimum pixels,
  art direction and generation prompt, and the zones that must stay dark. Real
  photography lands by replacing files at the same paths — no code change.
- Each hero slide has two crops, a 16:10 `wide` and a 4:5 `portrait`, through
  `getImageProps()` × 2 into one `<picture>` (no blur — incompatible with `<picture>`).
  The crop is chosen by **shape**, `(min-aspect-ratio: 3/2)`, not by width: a 1024×768
  laptop or a portrait tablet gets the portrait crop, whose empty floor sits under the
  copy, because the wide crop's empty sides are too narrow there. The first slide is the
  page's only eager image (`loading="eager"`, `fetchPriority="high"`); the other slides
  are lazy and `fetchPriority="low"`, so put the strongest photograph first in
  `features/home/data/hero-slides.ts`. Everything else is a single lazy import with
  `placeholder="blur"` and an honest `sizes`.
- Hero photographs keep the figure in the middle of the frame with empty floor below, and
  the hero copy column is `max-w-md`: the text sits bottom-left in English and
  bottom-right in Arabic and clears the figure in both without mirroring the photograph.
  The Evening slide keeps the original `hero-desktop` / `hero-mobile` file names; the
  other slides are `hero-<collection>-desktop` / `-mobile`.
- The promo banner and the campaign put their copy on the photograph's empty side: the
  physical left from 768 in both languages (`rtl:md:ms-auto`), the bottom on mobile, each
  with a scrim on that side only. Neither photograph is ever mirrored.
- No dominant editorial image or garment repeats across the hero, promo banner,
  featured collection, campaign or lookbook (user requirement, 2026-09-14). Product-card
  photography may repeat a garment where the merchandising story calls for it.
- There is no image-shape test: under vitest a `.jpg` import has no dimensions, every
  frame is CSS `aspect-ratio` + `object-cover` (a wrong shape crops, never distorts), and
  the screenshot review is the guard. A missing file fails `next build`, not typecheck.
- **After swapping the hero or campaign**, re-check nav and copy contrast at 1440 and
  375 in both locales: the scrims are tuned to be near-invisible on a correctly dark
  image and only *visible* when the asset is too light. No `images` block exists in
  `next.config.ts`; add `qualities` only if the default 75 shows artefacts on real assets.

## Guideline overrides and copy decisions

- §12·11 Newsletter and §12·12's "newsletter if not already above" are excluded by the
  brief; §12·04's editorial brand moment is replaced by a promo banner for a new collection or
  an offer (user decision, 2026-09-14; copy in `home.banner`, href/slots/crop in
  `features/home/data/promo-banner.ts`, and offer
  terms only ever from the business), and its "Explore the story →" is dropped (an
  About-shaped destination); §12·12's
  Customer Care column is omitted until Shipping/Returns/Contact pages are planned. No
  FAQ, Blog, About, Newsletter or policy text anywhere.
- The footer carries social links and contact details (user decision, 2026-09-14), and
  no language switcher. They come only from `lib/brand/contact.ts` and render only when
  real values are filled in there; `contact.test.ts` fails the build on a malformed
  number, a one-locale address or a non-https link. Never copy the server seed's demo
  `phone` / `address` settings into it. **It currently holds placeholder values** (user
  request, 2026-09-14; `CONTACT_IS_PLACEHOLDER = true`): the all-zeros test number, a
  district-only address and platform home pages instead of handles. Replace them with the
  real details before launch. TikTok and WhatsApp use the inline `components/brand/tiktok-icon.tsx`
  and `whatsapp-icon.tsx` glyphs because lucide ships neither (its generic message bubble
  did not read as WhatsApp).
- Prices format on the server in `features/products/utils/price.ts`: Western digits in
  both locales (`ar-EG-u-nu-latn`), no decimals, the localised currency label from
  `products.currency` trailing (`1,250 EGP` / `1,250 ج.م`). Eastern Arabic digits are a
  one-line change there.
- The mock products carry `{ en, ar }` names purely so the English homepage reads; the
  real `products.name` is one Arabic string. The type is `HomeProductMock`, not `Product`.
- Shopping benefits copy (`home.benefits.*`) is generic on purpose. `delivery` and
  `returns` must be confirmed against the real operating policy before launch, and no
  coverage area, speed, return period, fee or "no questions asked" claim may be added
  until then (`features/home/data/benefits.ts`). Visually the section is a cream band
  with fine rules and small line icons: no boxes, rounded cards or shadows.
- Arabic homepage copy was reworked for natural, concise phrasing rather than
  word-for-word translation (2026-09-14); a native-speaker review by the business is
  still pending.
- No wishlist icon on cards until wishlist behaviour exists; when it arrives it is a
  sibling of the card link, never nested inside the `<a>`.

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

## Feature slice shape

Three slices exist — `features/home`, `features/products`, `features/collections` —
with static, typed mock data only and nothing under `features/*/api/`. `home` composes
the sections and imports from the other two; `products` and `collections` do not import
each other. A slice follows this shape:

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
rather than being imported cross-slice. `Marquee` lives in the home slice because the
editorial strip is its only consumer; it moves to `components/` if the Shop task reuses it.

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

`/en` and `/ar` prerender as static HTML (confirmed in the build output: both list as
`●` SSG, not `ƒ` dynamic) — the *current state*, not an architectural rule.
`generateStaticParams` + `setRequestLocale` make that possible because nothing here
reads request-specific data; the homepage's client islands do not change that (a
`'use client'` file never makes a route dynamic). The first feature that needs
per-request data (a cart, a session) chooses its own caching/revalidation/dynamic
strategy on its own merits; nothing about this file requires staying static.

## Mobile menu typography exception

The mobile menu's primary links render at `type-h2`, not the `type-label` every other
nav link uses — a deliberate editorial choice (guideline §5 exception), passed through
`NavLink`'s `typography` prop rather than via `className`. The footer's shop links use
the same prop for `type-body`. See that prop's doc comment for why: `tailwind-merge`
doesn't know about the custom `type-*` utilities, so two of them on one element would
both apply and the CSS source order — not the component prop — would decide which wins.

## Nothing is shared with the dashboard

No import between `apps/storefront` and `apps/dashboard` in either direction, and no
shared UI or theme package. Each app's tokens, components and conventions are its own;
a pattern that looks reusable is a candidate for a deliberate future package, not an
implicit cross-app import today.
