@AGENTS.md

# Storefront Contract

The foundation (`2026-09-13-001-feat-storefront-foundation` plan) covers locale routing,
design tokens, the API client and the global shell. The homepage, header surface, mobile
menu panel and footer come from `2026-09-13-002-feat-storefront-homepage-header-footer`.
Shop + Collections (`2026-09-14-002-feat-storefront-shop-collections`) added the first
API-backed surfaces: Shop All, category pages, New In, the collections index and
collection pages (see *Catalog*). Product detail
(`2026-09-14-003-feat-storefront-product-detail`) added `/products/<slug>`, where every
card links (see *Product detail*). Cart and checkout still 404 through the catch-all, by
design — no placeholder pages.

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

### Media radius (owner decision, 2026-09-14)

One token pair in `app/globals.css`'s `@theme inline`: `--radius-media` (12px, the
`rounded-media` utility) and `--radius-media-sm` (8px, `rounded-media-sm`). Never a raw
`rounded-[12px]`. `rounded-media`: the product card image frame, category tiles, the
collections index photographs, the collection intro image, the featured collection's
two frames, lookbook images, the editorial strip photographs, the gallery frame and its
no-image frame, the product page's gallery fallback and both skeleton frames.
`rounded-media-sm`: gallery thumbnails (the inner photograph is concentric,
`radius - 4px`) and the purchase panel's 44px size cells, where 12px read as pills. Full-bleed photographs stay square: the hero, the promo
banner and the campaign (edge to edge horizontally). Buttons, inputs, chips, the header
and the footer stay square.

The element carrying the radius is the one that clips (`overflow: hidden`, plus
`isolate` where a transformed child scales inside it, so WebKit keeps the corners), so
hover swaps, zoom and the `data-motion-zoom` settle never square the corners. The
`data-motion="image"` wipe insets carry `round var(--radius-media)` in both states, since
every element using it is a rounded frame; the gallery's inset focus ring inherits the
radius. Shadows and boxed sections are still out.

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

Server Components by default (R21/R22). `'use client'` is limited to twelve entries
(thirteen files):

1. `providers/app-providers.tsx` / `providers/query-provider.tsx` — the provider tree.
2. `components/layout/mobile-menu/mobile-menu.tsx` — Headless UI's Dialog needs state.
3. `components/layout/locale-switcher.tsx` — needs `usePathname` to preserve the
   current path across a locale switch. Exports both `LocaleSwitcher` (the
   both-locales list in the mobile menu) and `LocaleToggle` (the
   header's single link to the other locale); one module, one boundary.
4. `components/layout/header/header-shell.tsx` — owns the passive scroll listener that
   narrows the header surface; takes children only.
5. `components/motion/reveal.tsx` — one shared `IntersectionObserver` that flips a
   `data-reveal` state; every transition it triggers is CSS declared on server markup.
   Takes children only.
6. `components/motion/parallax.tsx` — `scroll()` from `motion` driving a WAAPI
   animation from `motion/mini`. Takes children only.
7. `features/home/components/hero/hero-carousel.tsx` — which hero slide is active,
   autoplay, tabs, swipe. Slide content arrives server-rendered as `ReactNode`s and
   every string arrives resolved; it renders no image itself.
8. `features/catalog/components/catalog-controls.tsx` — the catalog utility row's
   filter summary, Filter button and Headless UI filter sheet, and sort select, written
   to the URL with nuqs (`shallow: false`, `history: 'push'`). Strings arrive resolved
   from `catalog-controls-slot.tsx` (`catalogControlsRenderer`); the few values it
   formats itself use `{name}` templates through `fillTemplate` (`lib/utils/fill-template.ts`), not ICU. Its root is
   `display: contents` so its controls wrap as items of the utility row. Pure rules
   live in `catalog-controls-state.ts`, unit-tested.
9. `app/[locale]/(catalog)/error.tsx` — every catalog route's error boundary. Next
   requires an error boundary to be a client component, so it cannot take resolved
   strings as props; see the one namespace exception below.
10. `features/products/components/purchase-panel.tsx` — the product page's option
   radios, live price and availability (PD-11, owner decision PD-E): the selection
   drives price and per-value availability, which CSS cannot compute, and Cart needs an
   island here anyway. Takes the DTO's `price`/`inStock`/`options`/`variants`, resolved
   strings and a pre-formatted price map from `purchase-panel-slot.tsx`; the rules are
   `utils/variant-selection.ts`, unit-tested. No button (PD-B): `data-readiness` exposes
   `purchaseReadiness` for Cart.
11. `features/products/components/product-gallery-viewer.tsx` — the product gallery's
   thumbnail tabs and zoom in place (owner decision 2026-09-14): which image is active
   and the pointer-following zoom origin cannot be CSS. Takes resolved `label`/`alt`/
   `thumbLabel` strings, `dir`, and plain `{ url, sizes, zoomSizes, loading,
   fetchPriority }` images from `product-gallery.tsx`; the sizes table and keyboard
   rule are `utils/gallery-layout.ts`, unit-tested.
12. `features/products/components/product-tabs.tsx` — the product details tabs (ED-4):
   owns only which tab is active. Takes `tabs: { id, label, panelHasFocusable }[]`, the
   tablist `label`, `dir` and `panels: Record<id, ReactNode>` rendered on the server by
   `product-details-tabs.tsx`; the keyboard rule is `utils/tab-keys.ts` (`tabKeyTarget`,
   shared with the gallery), unit-tested.

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
would inherit and ship the whole catalogue.

**The one exception** (KD-14, 2026-09-14): `app/[locale]/(catalog)/layout.tsx` nests a
second `NextIntlClientProvider` carrying `{ catalog: { error } }` and nothing else, and
`useTranslations('catalog.error')` in `(catalog)/error.tsx` is the only client
`useTranslations` in the app. The layout fetches nothing from the API, so it cannot
throw past the boundary it serves. Widening that object, or a second client
`useTranslations`, is a new decision, not a precedent. Before adding a thirteenth
`"use client"` boundary, check whether the interactive part can be isolated into a
small leaf instead of converting an entire Server Component tree.

`NavLink` takes an explicit `current?: boolean` rather than reading the pathname, so it
needs no client boundary. The catalog's `CategoryNav` is the first caller that passes
`true` (the page it is rendered on knows its own slug). The header and footer still pass
`false`: `aria-current` there needs the segment passed down, deferred.

## Motion

Three levels, set in the 2026-09-14 motion pass: **signature** (hero, editorial strip,
featured collection, campaign, promo banner), **section** (headings, product grids,
categories, The Edit, benefits) and **micro** (hover and link states, 180–400ms).
Transform, opacity and clip-path only; nothing hijacks scroll, pins, bounces or blocks
interaction. One easing for entrances (`--ease-editorial`), one for UI (`--ease-ui`).

1. **Hero** — CSS keyed on the carousel's `data-active` / `data-leaving`, so the first
   slide plays from the server HTML with no JS. Sequence on load and on every change:
   image 1.08 → 1 from 120ms, the masked title (one mask) at 300ms, the description
   fade-up at 420ms, copy at 540ms, link at 660ms; the tab row settles at 750ms on
   load. The outgoing slide fades over 1s while its image drifts to 1.04, its title
   exits upward through the same mask and the description, copy and link fade out. Progress bars are empty before hydration
   (`idle`), fill over 7s while rotating, and refill quickly on each manual change once
   stopped.
2. **Scroll reveal** — `<Reveal>` is a *trigger*, not an effect. The server HTML is the
   visible state; on mount `decideInitialRevealState` (`reveal-policy.ts`, unit-tested)
   marks only elements entirely below the fold as `pending`, never under reduced motion,
   and a shared observer flips them to `in`. What moves is declared on server markup
   with `data-motion="rise" | "fade" | "image" | "word"` (plus
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
   image). Hover pauses both; reduced motion stops both. The strip has **no pause
   control** (user decision, 2026-09-14): the CSS-only pause toggle added in the
   freeze plan was removed, so keyboard and touch users cannot stop the motion. That
   is an open WCAG 2.2.2 gap recorded in `docs/ACCESSIBILITY.md` → *Known gaps*; if an
   accessibility review asks for it back, restore it from commit history (a native
   checkbox, `role="switch"`, outside the tracks, pausing via
   `[data-strip]:has([data-strip-toggle]:checked)`, no client boundary).

**No eyebrows: the eyebrow is the title, the title is the description** (owner
decision, 2026-09-14). No section renders a label above its heading. The `eyebrow`
message keys keep their names and copy but render as the heading element the old title
used, at the old title's `type-*` size and with its entrance; the old `title` copy
renders as a `<p>` under it:

| Where | Heading | Description |
| --- | --- | --- |
| Hero slides | `h2` in one line mask, 300ms | `title1` + `title2` space-joined, one `type-h4 text-text-secondary` line, fade-up 420ms |
| New Arrivals, Categories, The Edit (`SectionHeading`) | `h2` `type-h2`, rise at offset +120 | `type-body-lg text-text-secondary`, fade at +240 |
| Promo banner | `TextReveal` `h2` `type-h1`, 350ms | `type-h4 text-text-secondary`, rise 600ms (body 750, button 950) |
| Featured collection | `TextReveal` `h2` `type-h2 lg:type-h1`, 400ms | `type-h4 text-text-secondary`, rise 600ms (body 750) |
| Catalog `PageIntro` | `h1` `type-h1` = the route table's `heading` ("Shop" / "Collections", linked except on the page it names), rise 120ms | the page's own name (`lead`: category, collection, "All pieces", "New In") `type-body-lg text-text-secondary`, fade 240ms; dropped by `introDescription` when it repeats the heading (`/collections`) |

Signature descriptions are `type-h4` so they stay distinct from the body line under
them; commerce ones are `type-body-lg`. A collection card's season · year now sits under
its name, not above it. The label wipe (`data-motion="wipe"`, `data-enter="wipe"`) is
gone with the eyebrows; don't reintroduce it as a heading device.

**Signature vs commerce entrances** (AD-11, 2026-09-14). The word-masked `TextReveal`
belongs to the signature moments only: the promo banner, the featured collection and
the campaign. `SectionHeading` (New Arrivals, Categories, The Edit) raises its title
once and fades its description, and the catalog's `PageIntro` (an `h1`, not a
`SectionHeading`) uses the same entrance. `ProductCard` rises by default; `reveal="image"` (the image wipe and 1.06
settle) is for one feature card per section, like The Edit's first card and the first
`CategoryTile`. Adding the word mask back to a commerce heading repeats the same entrance
down the page.

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
back as the first control before the tablist, per the WAI-ARIA carousel pattern.
Rotation also pauses whenever the hero scrolls out of view, the same way hovering
does (one `IntersectionObserver` inside the existing `hero-carousel.tsx` island,
no new client boundary): the progress fill freezes and resumes from where it
left off, the slide never changes while away, and "stopped by interaction"
survives leaving and re-entering the viewport. The state union (`idle | running
| paused | stopped`) is a pure `carouselState()` in `hero-carousel-state.ts`,
unit-tested. The global reduced-motion rule zeroes animation and
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
  `features/home/data/hero-slides.ts`. Lazy is not enough on its own: hidden slides stay
  laid out in the viewport to cross-fade, so the carousel renders a slide's picture only
  when `slideMediaVisible` (`hero-carousel-state.ts`, unit-tested) allows it — the active
  and leaving slides, the next one while rotating, and any slide shown, hovered or
  focused. The freeze capture measured all four photographs downloading before any
  interaction without it. Everything else is a single lazy import with
  `placeholder="blur"` and an honest `sizes`.
- Hero photographs keep the figure in the middle of the frame with empty floor below, and
  the hero copy column is `max-w-[26rem]`: the text sits bottom-left in English and
  bottom-right in Arabic and clears the figure in both without mirroring the photograph.
  The Evening slide keeps the original `hero-desktop` / `hero-mobile` file names; the
  other slides are `hero-<collection>-desktop` / `-mobile`.
- The promo banner and the campaign put their copy on the photograph's empty side, on the
  **physical** side in both languages, each with a scrim on that side only. Neither
  photograph is ever mirrored. The banner chooses its layout by shape: the 16:9 crop with
  the copy on the left only on landscape screens at least 768px wide and 4:3
  (`banner-wide`, a custom variant in `app/globals.css`), otherwise the 4:5 crop with the
  copy at the bottom, because on a portrait tablet the wide crop put the copy on the model.
  The campaign line is physical-left at **every** width (`rtl:ms-auto`): on phones the
  figure stands in the right half of the 4:5 window, so an Arabic line at the reading
  start sat on her.
- No dominant editorial image or garment repeats across the hero, promo banner,
  featured collection, campaign or lookbook (user requirement, 2026-09-14). Product-card
  photography may repeat a garment where the merchandising story calls for it.
- There is no image-shape test: under vitest a `.jpg` import has no dimensions, every
  frame is CSS `aspect-ratio` + `object-cover` (a wrong shape crops, never distorts), and
  the screenshot review is the guard. A missing file fails `next build`, not typecheck.
- **After swapping the hero or campaign**, re-check nav and copy contrast at 1440 and
  375 in both locales: the scrims are tuned to be near-invisible on a correctly dark
  image and only *visible* when the asset is too light. `next.config.ts`'s `images` block
  exists for catalog remote images (see *Catalog*) and pins `qualities: [75]`; add a
  quality only if 75 shows artefacts on real assets.

## Catalog (Shop + Collections)

The first API-backed pages (plan `2026-09-14-002`). Every read is a Server Component
fetch; nothing in a browser calls the catalog API, so there is no CORS change and no
TanStack Query for the catalog (KD-9: a client cache would be a second source of truth
beside the server render, plus hydration payload).

### URL model and routes

| URL | Route file | Lists |
| --- | --- | --- |
| `/shop` | `app/[locale]/(catalog)/shop/page.tsx` | every active product, newest first |
| `/shop/[category]` | `.../shop/[category]/page.tsx` | one category |
| `/new-in` | `.../new-in/page.tsx` | products created in the server's `NEW_IN_DAYS` window |
| `/collections` | `.../collections/page.tsx` | live collections (no product grid) |
| `/collections/[slug]` | `.../collections/[slug]/page.tsx` | one collection, merchandised order |
| `/products/[slug]` | `.../products/[slug]/page.tsx` | one product (see *Product detail*) |

Categories and collections stay distinct in URLs, API and UI (UD-3). A category is
**path-only**: there is no `?category=`, so the query form can never compete with the
indexable path. One routing system: every listing is one `CatalogPage` over one API
listing, and `catalogPath()` (`features/catalog/utils/catalog-path.ts`) is the only
place a catalog URL is spelled. `(catalog)` is a route group (URLs unchanged) whose
layout exists only for the error strings (see *Client boundary rule*).

`features/catalog/utils/catalog-route.ts` → `catalogRouteConfig` is the single source
of what each listing route is: API scope, default sort, allowed sorts in display order
(`curated` only on a collection, and its default there), whether the category row shows
(Shop All and category pages), the `heading` (the intro's `h1` and the only
breadcrumb: plain text on the page it names, a link elsewhere) and the end-of-listing link (New In → "Shop by category",
collection → "Explore collections"). A per-route difference goes in that table, never in
a page branch.

### URL grammar (`features/catalog/search-params.ts`)

`sort` (`newest | price-asc | price-desc | curated`), `stock=in`, `min`, `max`, `page`.
One nuqs parser map serves the server loader, the serializer and the controls island.
Malformed values never throw or 500 (R13), they fall back:

- Digits are normalised first: Eastern Arabic and Persian digits become ASCII, grouping
  separators (`,` `٬` `،` spaces) are stripped, and anything but 1-9 plain digits is
  invalid.
- `page` outside 1-500 (the API's bound) is page 1, and page 1 is never written.
- `min` floors and `max` ceils to the 50 EGP step, because the API rejects any other
  value with a 400. `min=0` is dropped; `min > max` is swapped.
- `curated` outside a collection, and a spelled-out route default, normalise to `null`,
  so equivalent URLs serialize identically.
- A repeated key resolves to its **first valid** value (`?sort=best&sort=price-asc`
  sorts), not nuqs's first occurrence.
- Any change other than a page-only change resets to page 1 (KD-11).

`toProductQuery` resolves the route default before `buildCatalogProductsPath` maps it to
the API grammar, omitting values that filter nothing, so equivalent listings share one
data-cache entry.

### Rendering and caching

The six catalog routes are dynamic (`ƒ`); nothing calls the API at `next build`. The
four listings read `searchParams`. `/collections` and `/products/[slug]` read none, so
they call `await connection()`; without that they would prerender (at build, or at
runtime into the full-route cache).
Catalog fetches go through the Next data cache with `revalidate` 60s for product lists
and 300s for categories and collections (`CATALOG_REVALIDATE`), so a deactivated
product can linger up to 60s — fine for browsing, never for checkout.

**KD-10 invariant — a 404 must be a real 404.** A slug route resolves its entity (the
category from the cached categories list; the collection by slug) and calls `notFound()`
**before** rendering anything inside `<Suspense>`; `generateMetadata` shares the same
memoized fetch. And **no `loading.tsx` may exist at or above a catalog segment**: it
wraps the page in Suspense, the 200 status and shell stream first, and every `notFound()`
becomes a streamed 200 with a not-found body. Only the product grid streams, inside
`CatalogPage`'s one unkeyed `<Suspense>` (unkeyed so a filter transition keeps the old
grid, dimmed, rather than flashing the skeleton). A known category with no active
products is found and shows its empty state, not a 404. Unknown, upcoming and archived
collections are indistinguishable 404s (the API shares one body).

**Failure behaviour** (Unit 12 smoke against a stopped API, 2026-09-14):

- A URL already in the data cache keeps rendering through a short outage.
- An uncached list that fails inside Suspense has already sent 200: the client error
  screen (`(catalog)/error.tsx`, "Try again" calls `retry()`) replaces the grid.
- A failed entity lookup before Suspense (categories list, collection) is a 500 with the
  same error screen. `getCatalogCollection` returns `null` only for `NOT_FOUND`; every
  other error rethrows, so an outage never masquerades as a 404.
- The error screen never renders `error.message` or a code; Next logs the digest.

### Metadata (`features/catalog/utils/catalog-metadata.ts`)

Title and description per route (entity localized name/description, else a
`catalog.meta.*` message). Canonical is the locale path plus `?page=N` past page 1 —
paginated pages stay indexable with a self canonical; sort and filters never enter it.
`alternates.languages` points at the same page in each locale. Any sort or filter makes
the page `noindex, follow`. URLs are relative and resolve against the locale layout's
`metadataBase` from `SITE_URL` (read in `generateMetadata`, not at module load, so the
homepage stays SSG; unset in production logs an error and falls back to
`http://localhost:3000`).

### Data layer

`page → features/*/api/* → lib/api/catalog.ts (catalogFetch) → apiFetch`. UI components
never call either fetch. `catalogFetch` sends `X-Catalog-Server-Token` from
`CATALOG_SERVER_TOKEN` so SSR traffic uses the API's trusted rate-limit bucket (every
shopper's read arrives from the Next server's one IP; see `apps/server/CLAUDE.md` →
*The catalog limiter*). It passes no credentials. Entity reads (category, collection)
pass no `timeoutMs`: they are shared by `generateMetadata` and the page, and a signal
would break per-render memoization, so each would hit the API. The product list is the
one exception, `timeoutMs: 15_000` (`CATALOG_LIST_TIMEOUT_MS`): only ProductGrid fetches
it, once per render, so the deadline costs no memoization, and its `TIMEOUT` ApiError
reaches the `(catalog)` error boundary.

- `lib/api/catalog.ts` and **every** `features/*/api/*` file import `server-only`, so a
  client import of the token path fails the build. Tests alias `server-only` to
  `test/stubs/server-only.ts` in `vitest.config.ts` (the real package throws outside the
  `react-server` condition).
- DTOs (`features/products/types/catalog-product.ts`,
  `features/collections/types/catalog-{category,collection}.ts`) model the API response,
  never server types. `listCatalogProducts` validates `meta.pagination` and
  `meta.priceRange` and throws `INVALID_RESPONSE` rather than render wrong page links.
- `localizedName` / `localizedDescription`: English falls back to the Arabic `name` and
  says so through `lang`; an Arabic page never shows English copy.

| Variable | Read | Meaning |
| --- | --- | --- |
| `CATALOG_SERVER_TOKEN` | runtime, server only | Must match one entry of the API's list. Unset: per-IP limits (fine in dev, throttles production). Never `NEXT_PUBLIC_`. |
| `MEDIA_ORIGIN` | `next build` | The origin catalog images come from; becomes the only `remotePatterns` entry. |
| `SITE_URL` | runtime | Public origin for `metadataBase`. |

### Images

The server returns absolute image URLs (on its `MEDIA_PUBLIC_BASE_URL` origin), never
relative ones. `next.config.ts` turns `MEDIA_ORIGIN` into `remotePatterns` **at build
time** — the optimizer's allowlist is fixed then, so a build for another media host is a
rebuild. It defaults to `http://localhost:3001` outside production; unset in a
production build means no remote image loads (visibly, rather than an open allowlist); a
non-http(s) value fails the build. `dangerouslyAllowLocalIP` is on outside production
only, because Next 16 refuses localhost upstreams as an SSRF guard. Remote images get no
blur placeholder (no `blurDataURL`); they load over the frame's `bg-surface-soft`. Only
the first row is eager (the widest, 4; high priority for the first 2), with `sizes`
derived from `grid-layout.ts`, the same table as the grid classes. Collections and
products are seeded without images, so a fresh dev database shows the no-image states.

### Product card model

`ProductCard` never sees a data source: it renders a `ProductCardModel` built by
`fromHomeMock` (static registry slots, blur kept) or `fromCatalogDto` (remote URLs).
One badge at most, and sold out wins over new (it changes what the shopper can do);
sold out never greys the photograph and the price stays. No photograph shows the frame
with a small, faint brand mark, deliberately unlike the flat `ProductGridSkeleton`, so
a missing image never reads as loading. A name in another language than the page
carries `lang` and `dir="auto"`. The hover image is `display: none` on touch and below
768 (`.hover-alt-image`), so it is never downloaded there.

### Motion level

Low-to-medium (R21). The grid is one `Reveal` on the `ul`; cards rise, staggered for
the first eight only (`catalogStagger`). The intro rises the `h1` once and fades the
lines under it; a collection's image band only fades. No parallax, marquee or `TextReveal` on
catalog routes. Filters never replay entrances: `decideInitialRevealState` only holds
back a grid entirely below the fold, and the Suspense boundary is unkeyed, so a filter
transition re-renders the same grid in place.

### Filter UX

Quiet, not a SaaS panel (KD-15). Under the intro: the category row (horizontal scroll
with an inline-end fade at every width; empty categories hidden unless current), then
one utility row — result count at the start; filter summary, Filter button and Sort at
the end — which wraps rather than overflows and is **not sticky** in v1. Filter opens a
Headless UI sheet (bottom sheet below 768, side sheet from the inline end at 768+):
availability and a price range with `inputMode="numeric"` text inputs, staged and
applied together. Active filters show as a text summary with per-filter remove buttons,
not chips. Sort is a native `<select>` that commits on change. While a transition runs,
the old grid dims (`[data-catalog]:has([data-catalog-controls][data-pending])` in
`globals.css`) and the new count is announced through a polite live region.

### Pagination and empty states

Numbered, server-rendered links (R14); previous/next omitted at the ends; below 768
"Page 3 of 12" between arrows. Every page link ends in `#catalog-results`, the grid's
visually hidden `h2` (`tabIndex=-1`, `scroll-margin-top` clears the sticky header), so
the jump lands on the first row. Empty states (`catalogEmptyVariant`), one action each:
nothing live, filters match nothing (clear filters, sort kept), past the last page (page
1, filters kept), an empty category or collection (to `/shop`).

### Collections index

Composed by count, not a uniform grid (`collectionIndexLayout`): the first featured
collection with an image (else the first with one) becomes a 7/5 feature split; the rest
keep server order, image collections in 2-up rows and image-less ones as ruled
typographic rows. A text row closes a pair in progress, so order is never shuffled to
fill a row. No live collection: the catalog empty state.

### Open for the screenshot review (AD-12)

- Phones: the grid shifts down by one line when filters are active (the summary wraps
  onto its own line in the utility row).
- Sort may wrap to its own line at 320.
- Whether phones below 1024 need a compact sticky Filter/Sort row.
- The client error screen (API stopped, uncached URL) has not been seen after hydration.

## Product detail

Plan `2026-09-14-003`; decisions are cited by their PD numbers there.

### Route, data and 404s

`app/[locale]/(catalog)/products/[slug]/page.tsx`, inside `(catalog)` so it inherits the
error boundary and the KD-14 provider (PD-5). `resolve()` calls `await connection()`
(PD-8), then `getCatalogProduct(slug)` (`features/products/api/get-catalog-product.ts`,
`GET /api/v1/catalog/products/:slug`), then `notFound()` on `null` — before any Suspense,
so KD-10 holds and `catalog-routes.test.ts` pins it. Unknown, inactive, discontinued and
slug-less products are one indistinguishable 404 (PD-2), and so is a malformed slug: the
API rejects it with a 400 `VALIDATION_ERROR`, which `getCatalogProduct` also maps to `null`
(the slug is the endpoint's only input; the server regex is deliberately not copied here).
Any other `ApiError` rethrows to the error screen. `getCatalogCollection` still maps only
`NOT_FOUND`, so `/collections/Evening` is a 500 today (pre-existing, from #196).

`getCatalogProduct` is the one entity read that **does** pass `timeoutMs`: it is wrapped
in `React.cache`, so `generateMetadata` and the page still share one API call per render
(PD-9, measured in dev with a hit counter: 1 per render with the wrapper, 2 without).
Copy that pairing, not the timeout alone. It reads with the list lifetime (60s), and the
listing card, the detail read and the related row are separate cache entries that can
briefly disagree — fine for browsing, never for Cart, which must re-price on the server.

Metadata (`utils/product-metadata.ts`): localized name as title; the localized
description when it exists in the page's locale, else `catalog.meta.productDescription`;
self canonical and both-locale alternates; the first image as `openGraph.images`; always
indexable. No JSON-LD `Product` until Cart makes it purchasable (PD-7).

### Composition

`ProductDetail` is a slot layout: the page passes `breadcrumb`, `gallery`, `purchase`,
`details`, `related` and the listing `hrefs` (it builds every href; `features/products`
never imports `features/catalog`). Order: breadcrumb row, a 50/50 split from 1024 with a
64px column gap (`lg:grid-cols-2 lg:gap-x-16`, mirrored by `utils/gallery-layout.ts`; one
column below), the details tabs at full container width, the related row.

- **One screen from 1024** (owner feedback 2026-09-14, the Bella product page): the large
  frame is `flex: 0 1 max(22rem, calc((100svh - var(--header-h) - 11rem) * 0.8))`, so the
  4:5 image fits under the sticky header with the breadcrumb and shrinks to the space the
  thumbnails leave; the thumbnail column follows its height. The gallery row packs to
  `flex-end`, its inline end, which faces the info column in both directions. `sizes`
  still describe the uncapped half column, a slight overestimate.

- **Breadcrumb** (`product-breadcrumb.tsx`): `nav` (`product.breadcrumb.label`) > `ol`,
  Home (`product.breadcrumb.home`) / Shop (its own noun key `product.breadcrumb.shop`,
  "Shop" / "كل القطع", not the `navigation.shop` verb) / Category when present, then the
  product as a non-link `span aria-current="page"`. The product and the category (capped
  width) truncate; Home and Shop never shrink, so 320px never overflows. Separators are
  `aria-hidden`.
- **Info column**, `position: sticky` from 1024 (PD-15), kept after the enhancement: with
  the description moved into the tabs the column is usually shorter than the 4:5 gallery,
  so price and sizes stay in view beside it. Content capped at `max-w-[30rem]`. No category
  eyebrow (owner, 2026-09-14: the breadcrumb already names it); the column opens with the
  h1 at `type-h2` (it must not compete with the photograph), then a short lead (the first
  paragraph of the localized description, `productLead`; omitted without one), the
  purchase slot, `[data-product-action]` (the reserved, empty Add to Bag place, PD-B: no
  button and no copy until Cart, and no sticky mobile purchase bar, PD-14), quick facts (a
  `type-small` `dl` of material and fit under a hairline, omitted when both are empty; the
  Details tab keeps the full list), "Part of" links (Arabic `ضمن {collection}`, since
  collection names already carry مجموعة). The lead sits above the price because price and sizes are one island.
- **Share row** (`product-share.tsx`, the `share` slot, last in the info column): "Share
  it:" and server-rendered links to Facebook, X, Pinterest, WhatsApp and email, built by
  the pure `utils/share-links.ts`; no client JS and no SDK. The shared URL is absolute,
  from `SITE_URL` through `lib/site-url.ts` (the same origin as `metadataBase`). Pinterest
  appears only when the product has an image. A hairline above it unless the facts `dl`
  is directly above. No copy-link button: it would need a client boundary.
- **Details tabs** (ED-4, `product-details-tabs.tsx` + the `product-tabs.tsx` island):
  Description (every paragraph), Details (a `dl`: material, care, fit, category link,
  collection links, sizes from the `size` option) and Shipping & returns (delivery and
  returns). Built by `productDetailsTabs` (`utils/product-details-model.ts`, unit-tested)
  from real data only: **a tab or row with no content is not rendered**; one tab renders
  as a headed section without a tablist; none renders nothing. Horizontal WAI-ARIA tabs,
  automatic activation, Left/Right (mirrored in RTL) and Home/End wrap; inactive panels
  `hidden`; a panel with no focusable content is itself a tab stop. The bar
  (`[data-product-tabs*]` in `app/globals.css`) is sticky under the header (z-30, below
  its z-40), scrolls sideways if the labels overflow, and marks the active tab with a 2px
  inset ink underline. Changing tabs while the bar is stuck scrolls the section top back
  under the header; a changed panel fades in over 180ms. One Reveal (a fade) on the
  section. The island measured +0.4 KB gz of eager JS (194.8 → 195.2).

### Store policies

`features/products/api/get-store-policies.ts` reads `GET /api/v1/catalog/store-policies`
(`{ delivery, deliveryEn, returns, returnsEn }`, each string or null) with the entity
lifetime (300s) and no `timeoutMs`; a missing field reads as `null`, any other type throws
`INVALID_RESPONSE`. The page calls it through `load-store-policies.ts` only after the
product resolved (so it never touches a 404): `unstable_rethrow` first, any `ApiError`
logged and mapped to `null`, anything else rethrown — a failed read only drops the
Shipping tab. The text is edited in the dashboard's store settings. **The delivery and
returns copy seeded in dev is placeholder text and a launch blocker** until the business
replaces it (ED-5 revised); no fees, times, areas or return periods may be invented here.

### Variants

The server derives the options (normalized keys, a canonical key set, unusable variants
dropped and logged, effective price `variant.price ?? product.price`; see
`apps/server/CLAUDE.md` → *Public catalog*). The client never re-derives them:
`features/products/utils/variant-selection.ts` holds every selection, availability, price
and readiness rule, unit-tested, and `purchaseReadiness` is the **Cart contract**. The
variant price rule disagrees with POS today, where a NULL variant price sells at 0 (PD-C);
that must be fixed before Cart. Selection is component state, not URL state (PD-12).

### Gallery

The Bella template's gallery (owner decision 2026-09-14, replacing the PD-10 rail/grid).
`product-gallery.tsx` (Server Component) resolves strings and the model; the island
`product-gallery-viewer.tsx` (the eleventh boundary) renders a thumbnail column beside
one 4:5 large image. Thumbnails sit at the large image's inline start from 992 and its
inline end below (`row-reverse`), so in Arabic they are on the right from 992 and the
left below; photographs are never mirrored. Thumbs are 72px from 992, 88px at 768-991
and 72px below, with 4px between them, 3px padding and a 1px border; inactive at 0.6
opacity, the active one at 1 with a `--color-text` hairline (gold on ivory is 2.64:1,
under 3:1). A column taller than the frame scrolls inside the frame height.
`[data-gallery*]` in `app/globals.css` holds the layout; `utils/gallery-layout.ts` holds
the step table every `sizes` string is derived from.

- **Semantics.** A vertical WAI-ARIA tablist (`product.gallery.label`) of buttons named
  `product.gallery.thumbLabel`, roving `tabIndex`, automatic activation; the frame is the
  one `tabpanel`, labelled by the active tab and itself a tab stop (`tabIndex=0`: it holds
  only an image), with an inset focus ring drawn on a `::after` above the panes because the
  frame clips an outside outline. Arrow Down/Up and the reading-direction Left/Right move and wrap (the APG
  tabs rule), Home/End jump (`galleryKeyTarget`, unit-tested). One image: no tablist.
- **Downloads.** The first large image is the page's only eager *high-priority* image
  (`loading="eager"` + `fetchPriority="high"`; React also emits its head preload). A large pane mounts
  only once shown and stays mounted but `hidden`: lazy alone would not stop hidden panes
  laid out in the frame from downloading (the hero's `slideMediaVisible` lesson). A new
  pane fades in over the previous one (300ms, `--ease-ui`). Thumbnails are
  `fetchPriority="low"`, `sizes` 64/80px; the first `GALLERY_EAGER_THUMBS` (3) are eager
  and the rest lazy (`galleryThumbLoading`, unit-tested). Switching thumbnails while zoomed
  also mounts that pane's zoom image, so a keyboard change never magnifies the 1x source.
- **Zoom in place.** Only under `GALLERY_ZOOM_QUERY` (hover, fine pointer, 1024+),
  tracked with `matchMedia`. A mouse entering the frame scales the pane layer 2x with
  `transform-origin` from `--zoom-x`/`--zoom-y`, written in a rAF-throttled
  `pointermove`; leaving resets. A second image at `zoomSizes` (2x) mounts for that pane
  on its first zoom and fades in once loaded, so the LCP never pays for it. No zoom on
  touch or keyboard; clicking does nothing; reduced motion keeps zoom without transitions.
- No image: the `ProductImagePlaceholder` brand-mark frame `ProductCard` also uses. No
  component harness exists, so the island itself is covered only by the screenshot review.

### Purchase panel

The tenth client boundary (see *Client boundary rule*). Native radios in a `fieldset` per
option; sold-out and unavailable values stay enabled, struck through, with visually hidden
"sold out" text — never `disabled`, never colour alone. Price and status share one polite
live region rendered with the first paint. `purchase-panel-slot.tsx` resolves strings and
a map of pre-formatted prices on the server, so the island never formats a number.
`fillTemplate` lives in `lib/utils/fill-template.ts`: importing it from
`catalog-controls-state.ts` pulled nuqs into this route. The island measured +1.2 KB gz
of eager JS.

### Related row

`features/catalog/components/related-products.tsx` (PD-13): scope is the first public
collection (sort `curated`), else the category (sort `newest`), page 1, current product
excluded, 4 kept, section hidden when empty. It reads through
`listCatalogProducts(toProductQuery(...))`, and a test pins that its API path equals the
listing's page-1 path, so they share one data-cache entry. It streams in its own
Suspense; `loadRelatedProducts` calls `unstable_rethrow` first, returns `null` on an
`ApiError` (logged) and rethrows anything else, so a related failure never replaces a
rendered product with the error screen (unit-tested only; never observed against a
stopped API).

### Open for the screenshot review

Fixtures (dev DB `moon_store_sf_smoke`, 2026-09-14): `silk-midi-dress` (6 images, mixed
sizes), `embroidered-evening-gown` (1 image), `linen-summer-dress` (long EN/AR names,
descriptions), `cashmere-pullover` (mixed stock), `silk-slip-dress` (all sold out).

- Gallery: thumbnail column scrolling at 320-375 (6 thumbs overflow the frame), the
  crossfade and zoom feel at 1440, the 992-1023 band (thumbs at the start, no split), and
  whether keyboard focus on a thumb clears the sticky header (`scroll-margin-block-start`
  also offsets the column's own scroll).
- A single image fills the full width below 1024 (~704px on a portrait tablet).
- An in-stock product with no options shows no status line, per the plan's model;
  "In stock" there is the alternative.
- The sticky info column beside a short gallery at 1024; long Arabic titles; option
  wrapping at 320.
- Details tabs: the lead above the price (the reference shows it below); the sticky tab
  bar's scroll-back on tab change; tab labels scrolling at 320; the `dl` two-column rows
  from 768; the breadcrumb truncating a long Arabic name.
- The related skeleton is hidden from screen readers and announces no loading state.
- Keyboard and screen-reader path: `docs/ACCESSIBILITY.md` → *Manual scenarios* 7.

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
- Shopping benefits copy (`home.benefits.*`) is generic on purpose, and all three are
  launch blockers (`features/home/data/benefits.ts`). `delivery` (B-1) and `payment`
  (B-3) await the real policy and provider assurances. `returns` (B-2) is
  **neutralised**: until the business confirms whether returns or exchanges exist, the key
  keeps its name but its copy is about fabric quality and its icon is a neutral gem, so
  the tile promises no service. No coverage area, speed, return period, fee or "no
  questions asked" claim may be added until a policy exists. Visually the section is a cream band
  with fine rules and small line icons: no boxes, rounded cards or shadows.
- Arabic homepage copy was reworked for natural, concise phrasing rather than
  word-for-word translation (2026-09-14). The storefront addresses the reader in **one
  register, feminine singular** (`اكتشفي`, `تسوّقي`, `تابعي`, `تبحثين`), including the
  navigation, footer, skip link and 404 (B-4). Keep new strings in that register. A
  native-speaker review by the business is still a launch item.
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

Four slices exist. `features/home` composes the homepage from static, typed mock data
and imports from `products` and `collections`. `features/catalog` is the listing
composition slice (URL state, route table, intro, category row, grid, controls,
pagination, empty states, and the product page's related row) and imports from both.
`products` and `collections` own their catalog API functions and DTOs and still do not
import each other; the one reverse edge is `products/api/list-catalog-products.ts` taking
`CatalogProductQuery` from `features/catalog/search-params.ts` (a dependency-free
module). Keep it the only one: `ProductDetail` takes its category and collection hrefs
from the page (which may call `catalogPath`) rather than importing it, and the related
row lives in `catalog`, not `products`. A slice follows this shape:

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
- Only the catalog calls the API, always at request time from the server (see
  *Catalog*), so `next build` still makes no API call and `NEXT_PUBLIC_API_URL` is still
  unused. The first **statically rendered** page that fetches data must have `API_URL`
  set in the build environment — this is the thing that will silently break if
  forgotten.

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
`'use client'` file never makes a route dynamic). The six catalog routes are the first
dynamic (`ƒ`) routes: request-time rendering over the Next data cache (see *Catalog* →
*Rendering and caching*), chosen on their own merits. The catch-all and 404 are
unchanged. Each future feature (a cart, a session) chooses its own
caching/revalidation/dynamic strategy; nothing here requires any route to stay static.

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
