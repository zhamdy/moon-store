@AGENTS.md

# Storefront Contract

The foundation (`2026-09-13-001-feat-storefront-foundation` plan) covers locale routing,
design tokens, the API client and the global shell. The homepage, header surface, mobile
menu panel and footer come from `2026-09-13-002-feat-storefront-homepage-header-footer`.
Shop + Collections (`2026-09-14-002-feat-storefront-shop-collections`) added the first
API-backed surfaces: Shop All, category pages, New In, the collections index and
collection pages (see *Catalog*). Product detail
(`2026-09-14-003-feat-storefront-product-detail`) added `/products/<slug>`, where every
card links (see *Product detail*). Cart (`2026-09-15-001-feat-storefront-cart`) added the
guest bag: Add to Bag on the product page, the header Bag drawer and `/bag` (see *Cart*).
Checkout base UI (`2026-09-15-002-feat-storefront-checkout-ui`) added `/checkout`: contact
and delivery-address details over the quote, ending at a commerce seam with no order behind
it, and off in production builds until a commerce strategy exists (see *Checkout*).

## Design guideline

The visual source of truth is `docs/design/moon-fashion-website-design-guideline.md`
(moved out of `public/` so it isn't publicly served). The original logo artwork is
`docs/design/brand/moon-fashion-logo-original.png`.

## Token and utility vocabulary

Semantic Moon utilities (`bg-bg`, `bg-surface`, `bg-surface-soft`, `text-text`,
`text-text-secondary`, `border-border`, `bg-brand`/`text-brand-dark`, `bg-action`/
`text-on-action`, `bg-disabled`/`text-disabled`/`border-disabled`, `text-error` for
validation messages only, always beside an icon and text so colour never carries the
meaning alone) and the `type-*`
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

Server Components by default (R21/R22). `'use client'` is limited to twenty entries
(twenty-one files):

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
   `utils/variant-selection.ts`, unit-tested. It renders the page-composed `action` slot
   inside `PurchaseSelectionContext` (CD-11), which is how Add to Bag (14) reads
   `purchaseReadiness`; `data-readiness` still exposes it.
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
13. `features/products/components/share-button.tsx` — the share row's native share
   button (owner decision 2026-09-15): `navigator.share` and the clipboard exist only in
   the browser, and Instagram, TikTok and Messenger have no web share URL. Takes `url`,
   `title` and resolved `labels: { share, copied, copyFailed }` from `product-share.tsx`;
   reads `navigator` only on click, and reports the copy result as a toast (no region of
   its own). The decision is `utils/share-action.ts` (`shareAction`, `isShareAbort`),
   unit-tested.
14. `features/cart/components/add-to-bag-button.tsx` — Add to Bag in the purchase panel's
   action slot (see *Cart*). Takes `slug`, the page's localized `name` and resolved
   `strings`; reads readiness through `usePurchaseSelection()`. Owns the quantity beside the
   button (owner decision 2026-09-15, replacing "one piece per press"): the bag's
   `QuantityStepper` (`size="action"`), 1..10, `useState(1)`, reset to 1 after an add that
   landed pieces. An add raises a toast with View bag (`useRouter` push to `/bag`) and
   never opens the drawer. The intent and the toast descriptor (`addToBagToast`) are
   `utils/add-to-bag-action.ts`, unit-tested.
15. `features/cart/components/bag-trigger.tsx` — the header Bag link, its count badge and
   the lazy drawer host. Composed by `app/[locale]/layout.tsx` into `Header`'s `bag`
   slot, with the trigger's and the drawer's strings resolved there. The label and ARIA
   state are `utils/bag-trigger-label.ts`, unit-tested.
16. `features/cart/components/bag-view.tsx` — the `/bag` review island; its messages are
   toasts.
17. `components/feedback/app-toaster.tsx` — the one Sonner `<Toaster>` (owner decision
   2026-09-15), mounted by `app/[locale]/layout.tsx` after the footer as a direct child of
   `<body>`. Takes resolved `label` / `closeLabel` (`toaster.*`) and `dir`. Lazy: it imports
   no `sonner`, renders nothing on the server and the first client render, and mounts the
   real `Toaster` when the browser is idle or the first toast asks. See *Cart* → *Toasts*.
18. `features/checkout/components/checkout-view.tsx` — the checkout page island: TanStack Form
   state, the submit machine, the order summary and the cart notice (see *Checkout*). Takes
   resolved `CheckoutPageStrings` (the bag's included), `locale`, `shopHref`, `bagHref` and
   `deliveryMethods` from `app/[locale]/checkout/page.tsx`, and reads the bag through
   `useBagController`. Its rules are `features/checkout/utils/*` and
   `features/cart/utils/checkout-readiness.ts`, unit-tested.

19. `features/home/components/new-arrivals/product-rail.tsx` — the New Arrivals
   composition: the masthead/rail grid, the controls, their disabled edges, the
   progress rule and the mouse drag.
   Everything else about that rail is CSS scroll-snap (`[data-rail]` in
   `app/globals.css`): the scrolling, the snapping, touch swipe, the reading
   direction and the cards' keyboard order are the browser's. Takes the heading
   block, the "View all" link and the cards server-rendered as `ReactNode`s and the
   two control labels as resolved strings, the `HeroCarousel` contract; it renders no
   product and resolves no message. From 1024 it lays the masthead (title, rule, lead
   line, View all, controls, progress) in a column of its own and the rail beside it,
   bleeding off the page's inline end (`data-rail-inset`); below that the masthead is
   above a full-bleed rail with the rule under it. Its released-drag pitch is measured
   across the **last two** items, since the rail opens with a wider lead card. **It never autoplays** (brief, 2026-09-20), so
   unlike the hero it needs no WCAG 2.2.2 stop mechanism. Its rules are
   `rail-scroll.ts` (`railEdges`, `railStep`, `snapTarget`), unit-tested.

20. `features/cart/components/quick-add.tsx` — Add to Bag and Quick Add on a product
   card (owner brief, 2026-09-20). Takes a pure `QuickAddModel` (`utils/quick-add-model.ts`)
   and resolved `QuickAddStrings` (`getQuickAddStrings`), and owns only its selection, its
   panel's open state and the "choose a size" prompt. Every rule it applies already existed:
   `variant-selection.ts` for availability and readiness, `addToBagIntent`/`addToBagToast`
   for the press and the acknowledgement, the one `cart-store` `add` for the write. Its own
   rule, `quickAddPress`, is the card-level one — add, open the panel, or sold out — and is
   unit-tested. The panel is `absolute` under the button, so opening one card's options
   never reflows the grid or the rail; Escape and an outside pointer close it and return
   focus to the button. One piece per press: no stepper on a card. It carries no margin of
   its own (the card's action slot owns the spacing, which is zero over the photograph) and
   marks `data-open` while the panel is open, which is what holds a revealed action on
   screen while the pointer is on the options.

`components/motion/text-reveal.tsx` is deliberately *not* a boundary: it only splits a
heading into masked word spans on the server.

**Client-bundled, but not boundaries** (no directive; only boundary islands import them):
`features/cart/components/bag-drawer.tsx` (a lazy chunk, ~10.6 KB gz, reached only from
15), `cart-line.tsx`, `quantity-stepper.tsx`, `bag-summary.tsx`, `use-bag-controller.ts`
(shared by the drawer and the page), `load-drawer.ts`, `components/feedback/show-toast.ts`
(the one `toast()` caller and the one `import('sonner')`; pure modules import only its
`ToastTone` type; its queue and gate are the pure `toast-queue.ts`, unit-tested), and
`features/products/components/purchase-selection-context.ts` — a plain `createContext`
module imported only by `purchase-panel.tsx` and `add-to-bag-button.tsx`. A Server
Component must never import it: `createContext` does not exist in the react-server build.

The checkout island's children are client-bundled the same way: `checkout-summary.tsx`,
`checkout-cart-notice.tsx`, `text-field.tsx`, `governorate-field.tsx`,
`delivery-method-section.tsx` and `use-media-query.ts`, plus the Bag page's
`features/cart/components/checkout-entry.tsx` (reached only from 16).

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
`useTranslations`, is a new decision, not a precedent. Before adding a nineteenth
`"use client"` boundary, check whether the interactive part can be isolated into a
small leaf instead of converting an entire Server Component tree.

`NavLink` takes an explicit `current?: boolean` rather than reading the pathname, so it
needs no client boundary. The catalog's `CategoryNav` is the first caller that passes
`true` (the page it is rendered on knows its own slug). The header and footer still pass
`false`: `aria-current` there needs the segment passed down, deferred.

## Motion

Three levels, set in the 2026-09-14 motion pass: **signature** (hero, editorial strip,
featured collection, campaign, promo banner), **section** (headings, product grids,
categories, The Moon Selection, benefits) and **micro** (hover and link states,
180–400ms).
Transform, opacity and clip-path only; nothing hijacks scroll, pins, bounces or blocks
interaction. One easing for entrances (`--ease-editorial`), one for UI (`--ease-ui`).

1. **Hero** — CSS keyed on the carousel's `data-active` / `data-leaving`, so the first
   slide plays from the server HTML with no JS. Sequence on load and on every change:
   image 1.08 → 1 from 120ms, the eyebrow at 120ms, the masked collection name (one
   mask) at 240ms, the description fade-up at 420ms, link at 560ms; the collection index
   settles at 750ms on load. The outgoing slide fades over 1s while its image drifts to
   1.04, its name exits upward through the same mask and the eyebrow, description and
   link fade out. Rotation shows as **one** progress line at the hero's bottom edge, not
   one bar per name (2026-09-20): empty before hydration (`idle`), filling over 7s while
   rotating, refilling quickly on each manual change once stopped. React keys it on the
   active index, so a slide change remounts it and the fill restarts from zero.
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
decision, 2026-09-14). No section renders a label above its heading. The Moon Selection
briefly did (owner brief, 2026-09-21) and the eyebrow was removed the same day, so the
rule holds across the whole page; that section keeps its own header rather than
`SectionHeading` only because its `h2` runs at `type-h1 lg:type-display`, over a gold
hairline, with a `type-body-lg` description under it. The `eyebrow`
message keys keep their names and copy but render as the heading element the old title
used, at the old title's `type-*` size and with its entrance; the old `title` copy
renders as a `<p>` under it:

| Where | Heading | Description |
| --- | --- | --- |
| Hero slides | the collection name as `h2` at `type-display md:type-display-xl`, one line mask, 240ms, under a gold `type-caption` eyebrow at 120ms | `title1` + `title2` + `body` space-joined, one upright `type-body-lg text-text-secondary` paragraph capped at 38ch, fade-up 420ms |
| Categories, The Edit (`SectionHeading`) | `h2` `type-h2`, rise at offset +120 | `type-body-lg text-text-secondary`, fade at +240 |
| New Arrivals (its own header, 2026-09-20) | `h2` `type-h2` — the commerce level, not the signature `type-h1`: the promo banner sits directly below at that size and matching it had the heading competing with the page — rise at +120, then a 40–48px gold rule fading at +280 | **none.** `eyebrow` and `title` are synonyms; stacked they stuttered and locked to one baseline they still read as the same words twice, so the section states itself once and the rule does the editorial work (owner decision, 2026-09-20, after two passes). `title` stays in both catalogues, unused by this composition. "View all" and the two carousel controls make one cluster at the inline end, fading at +450 |
| Promo banner | `TextReveal` `h2` `type-h1`, 350ms | `type-h4 text-text-secondary`, rise 600ms (body 750, button 950) |
| Featured collection | `TextReveal` `h2` `type-h2 lg:type-h1`, 400ms | `type-h4 text-text-secondary`, rise 600ms (body 750) |
| Catalog `PageIntro` | `h1` `type-h1` = the page's own name (category, collection, "New In"; "Shop" on `/shop`, "Collections" on `/collections`), rise 120ms | the context line `type-body-lg text-text-secondary`, fade 240ms: "Shop" linked to `/shop` (category, New In), "Collections" linked to `/collections` (collection), plain "All pieces" (`/shop`), omitted on `/collections`. One pure rule, `catalogIntroHeadings` (`utils/intro-heading.ts`), unit-tested with a guard that two categories or collections never share an `h1` (#200 correction, owner, 2026-09-15; the eyebrow swap had made every category `h1` "Shop") |

Signature descriptions are `type-h4` so they stay distinct from the body line under
them; commerce ones are `type-body-lg`. **The hero is the exception** (owner decision,
2026-09-20): it has no body line left to stay distinct from — subtitle and body are one
paragraph — so its description is `type-body-lg`, and it is never italic, because Tajawal
ships no italic face and the Arabic locale would get a synthesized oblique. The hero panel
also no longer renders a `01 / 04` counter or the gold divider: the tab strip marks the
current slide and each tabpanel's `aria-label` carries "1 of 4", and the strip itself now
shows collection names only, with no numeral — redesigned the same day as the **collection
index**: one line of names under a hairline that runs gutter to gutter, at the inline end from
1024 so it balances the masthead at the inline start, the current one ivory over dimmed ivory
with a gold rule under it (brightness *and* a rule, never colour alone). The four equal columns
each carrying their own progress bar are what made a campaign read as a row of tabs. The row
scrolls sideways rather than wrapping when four names do not fit (320px, or a longer name).
The hero's CTA keeps `EditorialLink` but takes its new `underline="always"`: the rule is drawn
at rest and goes gold with the text, because a hero affordance that appears only under a
pointer is not one on a touch screen. A collection card's season · year now sits under
its name, not above it. The label wipe (`data-motion="wipe"`, `data-enter="wipe"`) is
gone with the eyebrows; don't reintroduce it as a heading device.

**Signature vs commerce entrances** (AD-11, 2026-09-14). The word-masked `TextReveal`
belongs to the signature moments only: the promo banner, the featured collection and
the campaign. `SectionHeading` (Categories) raises its title
once and fades its description, and the catalog's `PageIntro` (an `h1`, not a
`SectionHeading`) uses the same entrance. `ProductCard` rises by default; `reveal="image"` (the image wipe and 1.06
settle) is for one feature card per section, like The Moon Selection's first card and
the first `CategoryTile`. Adding the word mask back to a commerce heading repeats the same entrance
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
installed but unused: CSS scroll-snap gives the category and lookbook rails — and
the New Arrivals carousel — swipe, keyboard and RTL for free.

**Product rail** — `[data-rail]` in `app/globals.css` is the one carousel
geometry: a scroll-snap scroller that pulls out by one gutter and pads itself back,
so its `100%` is the container's content column and `--rail-visible` (1.25 / 2.8 /
4.2 at 0 / 768 / 1024) is an honest fractional card count at every width, past
`--container-max` included. The fraction is the point: part of the next card is
always in view, which is what says the row goes on sideways. `--rail-visible` is
`min(step, var(--rail-count))`, so a set shorter than the step fills the column
instead of leaving a stub of empty track — but note what that means: **a set at or
below the step has nothing to scroll, so the controls and the progress rule hide
themselves and the carousel is a row.** A four-item fallback did exactly that once
(2026-09-20) and silently deleted the feature; `FALLBACK_PRODUCTS` is eight for
that reason, not for variety. `product-rail.tsx` adds
the controls, the gold progress hairline and a mouse drag; a drag past 6px turns
snapping off (`data-dragging`, since a mandatory snap fights a dragged
`scrollLeft` every frame), re-snaps on release through `snapTarget`, and swallows
the click it would otherwise end in.

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
- Hero photographs keep the figure in the middle of the frame with empty floor below. That
  composition was for the split stage, where the copy sat on the floor; the hero is now
  full-bleed (`sizes: '125vw'`) with the copy overlaid and bottom-anchored at every width, so
  each slide crops the floor back with a zoom in `hero-slides.ts`'s `imageClassName`
  (`object-*` + a matching `origin-*` + `scale-125`). `scale-*` is Tailwind's standalone
  `scale` property, so it multiplies with the entrance keyframes' `transform: scale(1.08)`
  rather than replacing it. **`sizes` must stay at or above the largest slide zoom** or the
  optimizer picks a source that is then upsampled. The masthead is `max-w-[42rem]`
  (`xl:max-w-[52rem]`) at the inline start in both locales — wide enough that a collection
  name at `type-display-xl` is never broken to fit prose, with only the paragraph held to a
  38ch measure. The photograph is still never mirrored, and contrast comes from the scrims,
  not the image. **Two scrims, both horizontal bands** (2026-09-20): a header band on top and
  one floor gradient (`h-[92%] lg:h-[88%]`, 0.95 → 0.78 at 48% → transparent) the masthead and
  the collection index stand on. The 52%-wide inline-start wash at 0.95 is gone — it divided
  the frame into a lit half and a dark half, which is what made the hero read as a banner with
  a panel rather than a campaign. The floor's stops are tuned against the masthead's height
  (its top edge sits ~300px above the floor on phones, ~410px on desktop, landing near the
  `via` stop at about 0.75 alpha); re-check them if the type scale or the hero's bottom
  padding changes.
  The Evening slide keeps the original `hero-desktop` / `hero-mobile` file names; the
  other slides are `hero-<collection>-desktop` / `-mobile`.
- The promo banner and the campaign put their copy on the photograph's empty side, on the
  **physical** side in both languages, each with a scrim on that side only. Neither
  photograph is ever mirrored. The banner chooses its layout by shape: the 16:9 crop with
  the copy on the left only on landscape screens at least 768px wide and 4:3
  (`banner-wide`, a custom variant in `app/globals.css`), otherwise a full-height background with the
  copy over a bottom scrim. The section stays explicitly full width on desktop
  even when its height reaches the cap. Both banner slots use
  `silk-edit-campaign.png`, with the portrait positioned at 82% horizontally.
  Mobile image sizes account for the wide source covering a 90svh, minimum 40rem frame.
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
fetch; no browser reads listings, so there is no TanStack Query for catalog reads (KD-9:
a client cache would be a second source of truth beside the server render, plus
hydration payload). The one browser call under `/api/v1/catalog` is the bag's quote
(`POST /api/v1/catalog/cart/quote`, CD-4; see *Cart*), which has its own path-scoped CORS
on the server and never carries the catalog token.

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
(Shop All and category pages) and the end-of-listing link (New In → "Shop by category",
collection → "Explore collections"). A per-route difference goes in that table, never in
a page branch. The intro's `h1` and its linked context line (the only breadcrumb) are
not in the table: `catalogIntroHeadings` decides them, since a category or collection
`h1` is the entity's name (#200, owner, 2026-09-15).

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
  same error screen. `getCatalogCollection` returns `null` only for `NOT_FOUND` and a
  malformed slug's 400 `VALIDATION_ERROR` (#198); every other error rethrows, so an
  outage never masquerades as a 404.
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

- `lib/api/catalog.ts` and **every** `features/*/api/*` file import `server-only` (except
  the bag's browser quote client, `features/cart/api/quote-cart.ts` and `use-cart-quote.ts`,
  which deliberately do not: CD-4, see *Cart*), so a client import of the token path fails
  the build. Tests alias `server-only` to
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
sold out never greys the photograph and the price stays.

**The editorial commerce tile** (owner brief, 2026-09-20, superseding the caption-only
tile of the same morning). A photograph, a caption that says enough to choose by, and
one action — nothing else. No wishlist, no rating, no icon strip, no second badge row,
and no "View details" link: the title already opens the product page, and a second
anchor would double every card's tab stops to reach it while competing with the one
action.

- **Frame**: a **4:5** photograph on `bg-surface-soft` with `rounded-media` (12px), no
  border, no shadow, no plate. The 2026-09-20 bare-3:4 pass is reverted: pale garments
  on an ivory page have no edge of their own, so the radius and the sand surface are
  what draw the tile, and the `data-motion="image"` wipe matches the frame with no
  `--radius-media` override. The editorial assets are authored at 4:5.
- **Badge**: printed on the photograph again (top inline start), `type-caption`,
  uppercase, tracked `0.22em` (untracked in Arabic), bronze for New and ink for Sold
  out. It is last inside the frame, and the caption below is what the link names, so
  the reading order stays "&lt;name&gt;, &lt;price&gt;".
- **Caption**: name and price on one baseline, then the description. The name is
  `type-body-lg`, weight 500, **full ink**, in the display face (set on
  `[data-product-name]`), `min-w-0` and `text-balance`; the price is `type-small`,
  weight 500, full ink, `tabular-nums`, `shrink-0` at the inline end — quieter than the
  name, never hard to find. `priceFrom` (the product page's own `displayedPrice` rule,
  not a second one) turns it into "From {price}" when variants differ; the caller passes
  `product.priceFrom` as `priceFromLabel`.
- **Description**: the product's *own* stored copy (`localizedDescription` over the
  listing DTO's `description`/`descriptionEn`, added to the API on 2026-09-20), secondary
  ink, `type-small`, clamped to two lines whose height is reserved (`min-h-[2.72rem]`, the
  rem value rather than `2lh`), so a row stays level and the buttons line up. Nothing is
  written here and nothing is truncated server-side. A mock carries none, and a product
  with no copy simply has no line.
- **Action**: the `action` slot, composed by the page (`features/cart`'s `QuickAdd`), in
  the card's last grid row so a wrapped name never leaves one card's button low. **Two
  placements, one element and one DOM order** (2026-09-21): in the flow under the caption
  on a touch screen and below 768, and from 768 with a pointer it is placed into the
  photograph's own grid row (`[data-card-action='overlay']` in `app/globals.css`),
  inset 12px at its bottom edge, transparent at rest and rising in on card hover, on
  focus anywhere in the card, and for as long as its Quick Add panel is open. Grid
  placement, not `position: absolute`: the overlap needs no measured offset, DOM order
  is untouched (the name is still read and tabbed first) and the element stays outside
  the frame's `overflow: hidden`, so the panel opens past the photograph's edge. It stays
  a tab stop while transparent — that is how a keyboard reaches it — and the button is
  opaque (`bg-surface` over the `brand` hairline) because it is read over a photograph.
  Both skeletons drop their reserved action row under the same query
  (`[data-skeleton-action]`). The lead card keeps its action in flow at every width. `features/products`
  still imports nothing from `features/cart` — the product page composes Add to Bag into
  the purchase panel the same way (CD-11).

**Two registers, one component** (owner brief, 2026-09-20). `emphasis="supporting"` is
the tile above, the one every listing uses. `emphasis="lead"` is the art-directed card
the New Arrivals rail opens with: the name at `type-h4` in the display face, the price
on its own line, three clamped lines of copy (`min-h-[4.8rem]`, `max-w-[46ch]`), a
filled action (`QuickAdd emphasis="solid"`) and a `detailsLabel` link beside it. Only a
lead card carries that second anchor — on a tile it would double the tab stops to reach
the page the title already opens. Everything else is identical: one component in two
registers, never a second card component, and never more than one lead per composition.

**One link, one overlay.** The title's `Link` carries a transparent `::after` over the
whole card, so the photograph and the caption open the product page while the DOM holds
a single link. The action sits above that overlay on `z-10`, which is what keeps a
`<button>` out of an `<a>`: nesting them is invalid and the button would be unreachable.
Any future control on the card goes in the same layer.

Both skeletons (`ProductGridSkeleton`, `RelatedProductsSkeleton`) mirror the 4:5 frame,
the metadata row, the two clamped description lines and the 48px action — they are the
card's reserved height, so they move with it. No photograph shows the frame with a small,
faint brand mark, deliberately unlike the flat skeleton. Text in another language than
the page carries `lang` and `dir="auto"`. The hover image is `display: none` on touch and
below 768 (`.hover-alt-image`), so it is never downloaded there.

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
Any other `ApiError` rethrows to the error screen. `getCatalogCollection` maps the same
two codes, so a malformed collection slug (`/collections/Evening`) is a real 404 too (#198).

`getCatalogProduct` is the one entity read that **does** pass `timeoutMs`: it is wrapped
in `React.cache`, so `generateMetadata` and the page still share one API call per render
(PD-9, measured in dev with a hit counter: 1 per render with the wrapper, 2 without).
Copy that pairing, not the timeout alone. It reads with the list lifetime (60s), and the
listing card, the detail read and the related row are separate cache entries that can
briefly disagree — fine for browsing, never for Cart, which must re-price on the server.

Metadata (`utils/product-metadata.ts`): localized name as title; the localized
description when it exists in the page's locale, else `catalog.meta.productDescription`;
self canonical and both-locale alternates; the first image as `openGraph.images`; always
indexable. No JSON-LD `Product` (PD-7): it waits for Checkout, since a bag is not a
purchase.

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
  purchase slot (whose `[data-product-action]` now holds Add to Bag inside the panel, PD-B
  filled; still no sticky mobile purchase bar, PD-14), quick facts (a
  `type-small` `dl` of material and fit under a hairline, omitted when both are empty; the
  Details tab keeps the full list), "Part of" links (Arabic `ضمن {collection}`, since
  collection names already carry مجموعة). The lead sits above the price because price and sizes are one island.
- **Share row** (`product-share.tsx`, the `share` slot, last in the info column): "Share
  it:", server-rendered links to X and WhatsApp built by the pure `utils/share-links.ts`
  (no SDK), and a Share button, the `share-button.tsx` island as the list's last `li`
  (owner decision 2026-09-15). The button opens the device share sheet, which is how
  Instagram, TikTok and Messenger are reached: the first two have no web share URL and
  Messenger's needs a Facebook app id. A dismissed sheet (`AbortError`) does nothing; any
  other share error, or no Web Share API (most desktops), copies the link and raises a
  "Link copied" success toast (or a "Couldn't copy the link" error toast; see *Cart* →
  *Toasts*). The shared URL is absolute, from `SITE_URL` through `lib/site-url.ts` (the
  same origin as `metadataBase`). A hairline above it unless the facts `dl` is directly
  above.
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
and readiness rule, unit-tested, and `purchaseReadiness` is the **Cart contract** (Add to
Bag consumes it; see *Cart*). POS now agrees on the NULL variant price (PD-C, fixed by
#203). Selection is component state, not URL state (PD-12).

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
option; sold-out and unavailable values stay enabled, struck through in `text-text-secondary`
(not `text-disabled`, ~2.3:1 and hard to see) inside a dashed `bg-surface-soft` cell, with
visually hidden "sold out" text — never `disabled`, never colour alone. Price and status share one polite
live region rendered with the first paint. `purchase-panel-slot.tsx` resolves strings and
a map of pre-formatted prices on the server, so the island never formats a number.
`fillTemplate` lives in `lib/utils/fill-template.ts`: importing it from
`catalog-controls-state.ts` pulled nuqs into this route. The island measured +1.2 KB gz
of eager JS. Its `action` slot holds Add to Bag with a 1..10 quantity stepper at the inline
start (owner decision 2026-09-15; see *Cart* → *Surfaces*); the stepper is the cart
slice's, never the panel's.

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

## Cart

Plan `2026-09-15-001-feat-storefront-cart`; decisions are cited by their CD numbers there.
A guest bag in `localStorage`: the browser holds **intent only** (`slug`, options,
quantity); names, images, prices, availability and totals always come from the server's
quote. No checkout, payment, account, server cart, reservation or expiry. The route and UI
noun are "Bag" (`/bag`); the domain, API, store, types and slice say `cart` (CD-1).

### Pieces

| Where | What |
| --- | --- |
| Product page | `AddToBagButton` (boundary 14) in `PurchasePanel`'s `action` slot, composed by `products/[slug]/page.tsx` (CD-11) |
| Every product card | `QuickAdd` (boundary 20) in `ProductCard`'s `action` slot, composed by `ProductGrid`, `RelatedProducts` and `NewArrivals` — never by `features/products` |
| Every page | `BagTrigger` (boundary 15) in `Header`'s `bag` slot, composed by `app/[locale]/layout.tsx`; `Header` imports no feature slice |
| Drawer | `bag-drawer.tsx`, lazy, mounted by the trigger |
| `/bag` | `app/[locale]/bag/page.tsx` (server shell: `h1`) + `BagView` (boundary 16) |
| Every page | `AppToaster` (boundary 17) in the locale layout; every bag message is a toast |
| Shared by drawer and page | `use-bag-controller.ts`, `cart-line.tsx`, `quantity-stepper.tsx` |
| Pure, unit-tested | `utils/cart-lines.ts`, `cart-storage.ts`, `reconcile.ts`, `bag-view-model.ts`, `quantity-control.ts`, `add-to-bag-action.ts`, `quick-add-model.ts`, `bag-trigger-label.ts`, `plural-templates.ts`, `drawer-close-focus.ts`; `schemas/persisted-cart.ts`; `api/quote-cart.ts`, `api/use-cart-quote.ts` (its pure parts) |

### Persisted shape (v1)

Key `moon-fashion-cart` (`constants.ts`), value
`{ "version": 1, "lines": [{ "slug", "options": { key: value }, "quantity" }] }`. Never a
price, stock, name, image or promo state (R2). Limits mirror the server contract (CD-7), so
a change moves both: `MAX_LINE_QUANTITY` 10, `MAX_CART_LINES` 30, slug ≤80 chars and the
public slug pattern, ≤5 options, key ≤40, value ≤60.

`schemas/persisted-cart.ts` is a **hand-written guard**, not Zod (see *Bundle budget*).
Read policy (`cart-storage.ts` `parseCart`):

- Never written (`null`) → empty bag, no write.
- Malformed JSON, a malformed envelope, or any `version` other than 1 → reset to empty and
  rewrite. **An unknown version resets**, so rolling back after a future v2 ships wipes
  every v2 bag; a v2 must add a migration here and ship its reader before its writer.
- Lines are judged one by one; an invalid line is dropped, the rest kept. Invalid: not a
  plain object; a bad slug; `quantity` not an integer 1..10 (`"2"`, `1.5`, `NaN` fail);
  options not a plain object, more than 5, a key or value empty or too long, a non-string
  value, or a key spelled `__proto__`, `constructor` or `prototype`.
- Accepted lines are rebuilt from the named fields, so extra keys (`price`, `name`) vanish
  on rewrite. Duplicates by line key merge into the first occurrence (sum capped at 10),
  and only the first 30 distinct lines are kept.
- Any repair rewrites storage. Storage that throws (private mode, quota, disabled site
  data) keeps an in-memory bag for the session and never throws.

Line identity (CD-2) is `cartLineKey`: slug plus options sorted by key (code-unit order),
JSON-encoded, used for merging, React keys and quote keys. Same slug + options merges; a
different option is a new line. The cost: a renamed slug or option value, or canonical
key-set drift on the server, strands a line as unavailable (visible, never substituted).

### Store (CD-8)

`store/cart-store.ts` is a module-level external store read with `useSyncExternalStore`;
no provider. The server snapshot is `{ hydrated: false }`, so SSR never pretends to know
the bag; the first client subscription reads storage and notifies. A `storage` event from
another tab re-reads (last write wins). Mutations run the pure reducer, write storage
(failure keeps memory) and notify. `add(identity, { quantity?, hint? })` returns
`added | merged | capped | full` with `addedQuantity`, the pieces that actually landed: the
request is normalised to an integer 1..10 (NaN and <1 → 1, fractions truncate), a merge
caps at 10 (8 + 5 → `merged`, 2), and `capped`/`full` add 0.
Session state lives beside it and is never persisted: the drawer (`open` only), previous
unit prices per line key, price-update flags, announced quote keys and Add to Bag hints.
`restore({ line, index, hint })` is Remove's Undo: the pure `restoreLine` puts the line back
at its store index (clamped) with its quantity, and the hint returns with it; a no-op when a
line with that key is already there or the bag is full (unit-tested).

**Add to Bag hint** (in memory only, R2 kept): `add(identity, { hint })` stores
`{ name (LocalizedText), imageUrl, unitPrice }` by line key when `addedQuantity > 0` (an
`added` or `merged` outcome, never `capped` or `full`); `remove`, `clear` and a canonical rewrite drop it. The
page passes the localized name and first image URL to `AddToBagButton`; the unit price is
the purchase panel's exact `displayedPrice` for a `ready` selection, read through
`PurchaseSelectionContext.unitPrice` (`purchaseReadiness` is unchanged). No
`sessionStorage` or display cache: after a full reload the bag waits for the quote.

### Quote

`api/quote-cart.ts` calls `POST /api/v1/catalog/cart/quote` **from the browser** (CD-4)
through `apiFetch`: base `NEXT_PUBLIC_API_URL`, `credentials: 'omit'`, no catalog token, no
`server-only`. The body carries only `slug`, `options`, `quantity` per line; the response is
validated by hand against the request (line count, index, slug, statuses, numeric fields)
and anything off throws `INVALID_RESPONSE`. The server side (edge chain, `STOREFRONT_ORIGINS`
CORS, limiter, `no-store`) is `apps/server/CLAUDE.md` → *Public catalog*. An environment
without `NEXT_PUBLIC_API_URL` at build, or without the storefront origin in the API's
`STOREFRONT_ORIGINS`, shows the bag's failed state on every quote.

`api/use-cart-quote.ts` (CD-9): TanStack `useQuery` keyed `['cart-quote', cartQuoteKey]`
(line keys with quantities, in store order), `staleTime: 0`, `refetchOnMount: 'always'`,
previous data kept while a new key loads, `retry: shouldRetryQuery` (the app policy: at
most 2, only network/timeout (status 0) or 5xx, never `INVALID_RESPONSE`; 400 and 429 are
not retried). Enabled only while a bag surface shows (the drawer open, or `/bag`) and the
bag is hydrated and non-empty; other pages never quote. Quantity-only changes re-quote after
`QUOTE_DEBOUNCE_MS` (300ms), so stepper presses coalesce; an add, remove or canonical rewrite
re-quotes immediately.

### Reconciliation (`utils/reconcile.ts`)

Quote lines join stored lines **by line key**, never by position; rows render newest first.

- `ok` → priced. `reduced` → shows and totals the allowed quantity with "Only {count}
  available", but the stored quantity changes only when the shopper presses the stepper or
  Remove (CD-15); both stepper buttons stay enabled then, and either press commits a quantity
  the quote allows. `soldOut`, `variantUnavailable`, `productUnavailable` → kept, flagged,
  excluded from the subtotal, never auto-removed; stepper disabled, Remove enabled. A
  `productUnavailable` line shows the image placeholder, "A piece that is no longer
  available", the stored option text and Remove.
- A line whose quantity changed waits (`pending`) for its own verdict; + holds at the last
  quoted `maxQuantity` meanwhile (10 before any quote). It keeps the previous quote's line
  total, dimmed and `aria-busy`, so the figure never blanks between stepper presses.
- A line with no quote line but a hint is `provisional`: the hint's name, image and unit
  price, still `pending`, no line total, in no count or subtotal, stepper limit 10. As soon
  as a quote line exists for the key, quote data wins. With no hint the row still shows its
  stored options, stepper and Remove; name, photo and price are placeholders, and its
  accessible names use `bag.pendingPiece` ("This piece").
- The **only store write** is the canonical rewrite: options spelled differently from the
  quote's canonical ones are rewritten and merged, once per settled quote key. A second
  quote is therefore a fixed point.
- "Price updated" is in-session only (CD-16): the unit price differs from the one remembered
  for that key earlier in the session. No cross-visit notice, since that would persist a price.
- Summary: subtotal and pieces only ever come from a quote, never computed on the client.
  `current` when its key equals the current lines; otherwise `stale`, which keeps the
  previous quote's subtotal and counts on screen in `text-text-secondary` (a `color`
  transition), `aria-busy`, with a visually hidden "Updating". Excluded pieces = the pieces
  that quote answered − its `itemCount`. Quantity changes are announced only from a
  `current` quote (`settledQuantity`). Subtotal only: no shipping, tax, discount or
  delivery text (R10).
- View states: `empty`; `loading` (no quote yet: one local row per line, as above, and a
  visually hidden "Updating"); `failed` (no rows: "{count} pieces in your bag", the error and Try again; a 400
  `VALIDATION_ERROR` offers Empty bag instead, the only use of `clear`); `ready`.
- The header count is the local sum of stored quantities on every page (CD-18), including
  sold-out and unavailable lines; the header never reads the quote.

### Surfaces

- **Add to Bag** (CD-11; CD-13 overridden by the owner, 2026-09-15): `ready` adds the
  stepper's quantity of `readiness.options` and raises a toast with **View bag**; the drawer
  does not open. A success "Added to your bag: {name}" for one piece or `bag.addedQuantity`
  "Added to your bag: {name} ({count})" for more (the page's localized name, in memory only);
  a merge that hits 10 part-way (8 in the bag + 5), or `capped` (already 10), is an info
  "You can add up to 10 of this piece"; `full` (30 lines) is an error "Your bag is full…" and
  adds nothing. `needsSelection` keeps the button enabled: a press focuses the first
  unselected option's radio, shows "Choose a {option}" under that option's legend
  (`text-error` garnet with `CircleAlert`, legend turns ink; owner feedback 2026-09-15: the
  grey status-line prompt was hard to see, and errors read as red) and raises the same text
  as an error toast; choosing a value dismisses it. The inline prompt is not a live region
  (the toast announces it) and keeps `min-h-6` reserved, so the cells and Add to Bag never
  move under a second tap. `soldOut` reads "Sold out", `aria-disabled`, focusable, inert.
- **Product page quantity** (owner decision 2026-09-15, overriding plan Unit 5's "one piece
  per press"): a − / value / + stepper at the row's inline start, Add to Bag taking the rest,
  in one `flex-wrap` row (the button's `basis-40` wraps it onto its own line when narrow). It
  is the bag's `QuantityStepper` and `quantityControl(value, { status: 'unquoted' })`: − stops
  at 1, + at 10 with the capped notice as its description; labels are `bag.quantity` /
  `increase` / `decrease` filled with the page's name. Starts at 1 on the server and first
  client render, resets to 1 when an add lands pieces, stays usable under `needsSelection`,
  and is not rendered when sold out. No server change: the quote already caps a line at 10.
- **Header trigger** (CD-12): the same 44px `Link` to `/bag`. After hydration and off
  `/bag`, an unmodified primary click opens the drawer and the link carries
  `aria-haspopup="dialog"`; on `/bag` it navigates and carries `aria-current="page"`; a
  modified click or a click before hydration navigates. The badge is `aria-hidden`, hidden
  until hydrated and when empty, "99+" past 99; the accessible name is the pluralised
  "Bag, {count} items", plain "Bag" when empty.
- **Drawer loading** (CD-19, as built): `React.lazy(loadDrawer)` inside
  `<Suspense fallback={null}>`, mounted on the first open and kept mounted so its close
  transition runs. `loadDrawer()` (`load-drawer.ts`) is warmed on the trigger's
  `pointerenter`/`focus` (Add to Bag no longer opens the drawer, so it no longer warms it). It replaced `next/dynamic`, which measured ~1.2 KB gz
  of extra eager JS on every page for a component that never renders on the server.
- **Drawer**: Headless UI `Dialog`, a full-height panel from the inline end at every width
  (`max-w-[26rem]`, full width below that), backdrop, Escape and backdrop close. Title `h2`
  "Bag" is focused on open (`data-autofocus`); opened only from the header Bag link, with no
  description line. Line photographs mount only while open. Footer: Subtotal, the empty `[data-checkout-action]`, "View bag", "Continue
  shopping" (closes). Escape, the backdrop, the X and Continue shopping return focus to the
  header Bag link (Headless UI's restore). Following a line name, View bag or the empty
  state's link, or any pathname change, closes it and focus lands on `#main-content` once
  the leave transition has ended. Evidence (`@headlessui/react` 2.2.10): the transition keeps
  providing `Open | Closing` until the leave ends (`Transition.Child`'s state bits in
  `dist/components/transition/transition.js`), so `Dialog` keeps `FocusTrap`'s `RestoreFocus`
  on, and the trap's `useOnUnmount` (`dist/components/focus-trap/focus-trap.js`, the
  restore hook) focuses the element focused before opening in a microtask, **without checking
  where focus is**. An early `focus()` on `#main-content` (the old rAF) was overridden ~300ms
  later. `AfterTrapUnmount`, rendered inside the `Dialog`, queues a nested microtask from its
  own unmount cleanup, so it runs after that restore; the decision is
  `shouldFocusMainAfterDrawerUnmount` (`utils/drawer-close-focus.ts`, unit-tested: navigation
  close, not reopened, really unmounted). During the leave focus stays on the pressed link.
- **`/bag`**: static per locale, outside `(catalog)`, `noindex, nofollow`, no canonical, no
  `loading.tsx` (`app/bag-route.test.ts`). Before hydration one reserved `aria-busy` region
  one row tall (no fake row count) beside the summary in its final layout (heading,
  Subtotal, placeholder figure and pieces line, Continue shopping), so a non-empty bag never
  flashes the empty state and the summary never changes shape. From 1024 a 8/4 grid with the summary sticky
  under the header; below, linear. Summary: Subtotal, pieces, excluded pieces, the empty
  `[data-checkout-action]`, Continue shopping to `/shop`.
- **Remove**: the row fades 180ms (instant under reduced motion), then unmounts; focus
  moves to the next row's name link (or its Remove when the product is gone), else the
  previous row, else the empty-state heading (`tabIndex=-1`). As the line leaves the store
  the controller reads its index, quantity and hint and raises "{name} removed from your
  bag" with **Undo** (`restore`). Raised after the fade, not at the press, so an Undo can
  never run before the removal it undoes.

**Placeholders and reveals** (`app/globals.css`, CSS only). `[data-bag-placeholder]`
(`BagPlaceholder` in `cart-line.tsx`, a `bg-surface-soft` shape; the frame keeps its 4:5
`rounded-media-sm`) holds opacity 0 for 150ms, fades in, then breathes 1 → 0.55 over 1.6s,
alternating; the loop fills nothing so the delayed entrance wins meanwhile. Never
`ProductImagePlaceholder`, which means "no photograph". `[data-bag-reveal]` fades content in
over `--motion-fast` on mount only: placeholder and content are differently keyed elements,
and figures, the name wrapper and the unit price keep their element across stale → current
and hint → quote, so a stepper press or a quote arrival never replays it. Under reduced
motion both are `animation: none`: placeholders show at once and hold still.

**Checkout seam** (CD-17): an empty `[data-checkout-action]` in the drawer footer and the
page summary (`empty:hidden`). No Checkout button and no Clear bag control until Checkout
exists; readiness rules belong to that plan. **Now filled on the page only** (`2026-09-15-002`, CO-4):
`BagSummary`'s slot holds `CheckoutEntry`; the drawer's stays empty, so the flow is drawer →
View bag → `/bag` → Checkout. Still no Clear bag control. Quote stock is advisory (CD-6): Checkout must
re-validate with reservations under lock, never trust a quote. PD-B is filled; PD-14 (no
sticky mobile purchase bar) and PD-7 (no JSON-LD `Product`) stand.

### Toasts (owner decisions, 2026-09-15)

1. **Sonner** (`sonner` 2.0.8) is the toast library.
2. **Every info and error message** in the bag, product-page and filter flows is a toast.
3. **Add to Bag raises a toast with View bag instead of opening the drawer**; the drawer opens
   only from the header Bag link. This overrides plan CD-13.
4. **Field validation stays visible inline as well** ("Choose a size", the filter sheet's
   price error): a transient toast alone is missed by keyboard and screen-reader users. The
   toast is the announcement; the inline text is visual, is no longer a live region, and
   stays associated through `aria-describedby`.

**The toaster.** `AppToaster` (boundary 17), one per page, a direct child of `<body>`. Headless
UI's `Dialog` marks only the subtree that owns it inert (`header` for the drawer, `main` for
the filter sheet), so toasts stay visible, announced and clickable over a dialog. Sonner's
`<section>` is the one polite live region (`aria-live="polite"`, always mounted), named
"Notifications (Alt+T)"; Alt+T moves focus into the toasts, **including over the open
drawer**, so its Undo is reachable by keyboard with no in-drawer copy. Verified in the
installed source (2026-09-15, `@headlessui/react` 2.2.10, `sonner` 2.0.8): `Dialog` gives
`FocusTrap` `RestoreFocus | TabLock | AutoFocus | InitialFocus` but never `FocusLock`, and
the trap's window `focus` listener and `onBlur` reclaim focus only under `FocusLock`
(`dist/components/focus-trap/focus-trap.js`); `useInertOthers`' `disallowed` is the one
`body > *` holding the dialog's owner and `allowed` walks only up to `<body>`
(`dist/hooks/use-inert-others.js`, called from `dist/components/dialog/dialog.js`); and
`useRootContainers` counts every other `body > *`, the toaster included, as inside, so a
press on a toast is not an outside click. Sonner's `keydown` listener on `document` focuses
its `<ol>` (`tabIndex=-1`), and its `onBlur` / unmount cleanup return focus to the element
focused before (`Toaster` in `dist/index.mjs`). Because Headless UI inerts only `header`,
the drawer itself marks the skip link, `main` and the footer `inert` while open (owner
decision 2026-09-15), releasing exactly the elements it set as the close starts, so the page
behind is unreachable by Tab, Shift+Tab or a screen reader and `main` is focusable again
before a navigation close focuses it. Known limit, not fixed: Escape while in a toast also
closes the drawer (Headless UI's window `keydown`). Bottom centre in both
directions (owner decision 2026-09-15), full width minus 16px below 600px, at most 3 visible,
pausing on hover and focus. `unstyled` + semantic utilities, an ink pill (owner decision
2026-09-15): `rounded-media`, `bg-action text-on-action`, no border,
`shadow-(--shadow-overlay)` (a floating surface), `type-small`, 16px lucide icon at the
inline start (`CircleCheck` success and `Info` info in the text colour; `CircleAlert` error
in `text-error` on a small `bg-surface` badge, since garnet fails contrast on ink), the
action an underlined 44px text button, a 44px close button named "Dismiss". The toast sets
`--focus-ring-color` to its text colour so the focus ring stays visible on ink. Durations: success/info 4s, error 7s (`TOAST_DURATION_MS`). Reduced motion: Sonner's
own `prefers-reduced-motion` rule removes its transitions, and the global rule zeroes the
rest. Two unlayered rules in `globals.css` set the body face and restore the focus ring,
because Sonner's runtime sheet is unlayered and injected later. Every call goes through
`showToast` / `dismissToast` (`components/feedback/show-toast.ts`).

**Lazy loading** (owner decision 2026-09-15: keep Sonner and the ink pill, off the initial
JS). No file imports `sonner` statically except `import type`; `loadSonner` in
`show-toast.ts` is the one memoized `import('sonner')` (a rejection is not cached), so the
module-level `ToastState` behind `toast` is the same instance `Toaster` subscribes to.
`AppToaster` holds the loaded `Toaster` in state (not `React.lazy`, so a failed chunk
renders nothing rather than reaching an error boundary, and the next request retries) and
loads it on the first of `requestIdleCallback` (timeout 5s; a 1ms `setTimeout` where it does
not exist) or the first toast, which calls `toasterGate.request()`. **The ready gate** opens
one `requestAnimationFrame` after `Toaster` has mounted, and closes again on unmount.
`showToast` / `dismissToast` run through `createToastQueue` (`toast-queue.ts`, pure and
unit-tested): calls before the module is loaded *and* the gate is open are held in call
order and flushed together; after that they run synchronously; a failed load logs, drops
what was held and never throws to the caller. Sonner itself would keep a pre-mount toast
(`Observer.subscribe` replays `getActiveToasts()`, `dist/index.mjs`), so the gate exists for
the live region: the `aria-live` `<section>` and the Alt+T `keydown` listener are both
inside `Toaster`, and a message added in the same moment its region appears is not
reliably announced. Consequences: **Alt+T does nothing until the toaster has loaded**
(normally idle shortly after hydration), and on a cold cache the first toast raised before
idle waits for the Sonner chunk to download plus one frame. A `dismissToast` before load
also triggers the load.

| Event | Tone | Action | Id / dedupe | Inline counterpart |
| --- | --- | --- | --- | --- |
| Add, all pieces landed | success "Added to your bag: {name}" (or "({count})") | View bag → `/bag` | `add-to-bag`: a second add replaces it | none (the header count changes) |
| Add capped part-way, or already 10 | info "You can add up to 10 of this piece" | View bag | `add-to-bag` | the stepper's + description at 10 |
| Add to a full bag | error "Your bag is full…" | View bag | `add-to-bag` | none |
| Add while a choice is missing | error "Choose a {option}" | none | `choose-option`; dismissed on selection | garnet prompt under the legend, `aria-describedby` on the fieldset; focus to the option |
| Quantity change | info "{name}, quantity {n}. Subtotal {subtotal}", after a current quote settles | none | `bag-quantity:{lineKey}`: rapid changes replace | the dimmed then updated figures |
| Remove | info "{name} removed from your bag", after the fade | Undo → `restore` | `bag-removed:{lineKey}`: two lines, two toasts | the row leaves; focus hand-off unchanged |
| Settled current quote with issues, first time this session | info "Your bag was updated" + pluralised counts; not for a quote about to be canonically rewritten | none | `bag-quote`; once per quote key via `announcedQuoteKeys`, read from the live store | per-line notices |
| Quote failure | error "We couldn't update your bag" | Try again → quote retry | `bag-quote`; once per quote key | the failed state's text and Try again |
| Share link copied / copy failed | success "Link copied" / error "Couldn't copy the link" | none | `share-link` | none; a dismissed share sheet raises nothing |
| Filter sheet price error | error (the inline text) | none | `catalog-price-error`; replaced as the text changes, dismissed when fixed or the sheet closes | garnet text under the inputs, `aria-describedby` |
| Header count | never a toast | | | the link's name carries it |

The drawer over `/bag` mounts two controllers; only the surface pressed raises quantity and
remove toasts, the live-store check marks a quote key before either raises it, and the stable
ids are the second guard. Not messages, so untouched: the catalog result-count live region,
`product-grid-skeleton.tsx`, the hero carousel, the purchase panel's price/status region.

**Bundle.** The toaster is mounted on every page (it is in the locale layout), but Sonner
itself is a lazy chunk; see *Bundle budget* for the measurements.

### Copy

All strings resolve on the server (`utils/bag-strings.ts`) and ride island props; no client
reads the catalogue. Counts are per-category keys (`zero one two few many other`, each with
`{count}`) selected with `Intl.PluralRules` by `selectPlural`; both locales carry all six for
the parity test, so the Arabic `one` and `two` forms also carry `{count}` ("{count} قطعة",
"{count} قطعتان") where natural Arabic would drop the numeral. `bag.notice.variantUnavailable`
is option-generic ("This option is no longer available"), not size-specific. All bag Arabic
copy is a first draft in the feminine-singular register, pending the native review on #201.

### Bundle budget (owner decision, 2026-09-15)

Measured method, for comparison next time: `next build`, then gzip -9 each
`/_next/static/chunks/*.js` referenced by `.next/server/app/en.html` and sum. `/en` eager
went from 244,959 B to 250,921 B with the cart (`24cf33e`; `/en/bag` 252,138 B): **+5.96 KB**,
over the plan's +5 KB budget;
the owner accepted the overage. The cost is the header island itself (store, hand-written
persisted-cart guard, the count label with `Intl.PluralRules`, the announcer, since removed
for the toaster; the toaster's own cost is measured below). `zod/v4/mini`
was removed from the eager path (the store went from 9.5 to 2.0 KB gz, `c197a58`), and the
storefront imports no Zod outside `features/checkout` (the checkout route's own chunk; a test
enforces it). Inlining the `BAG_HREF` import saved 7 B and was not done. These
bytes are not comparable with the older "195.2 KB" figures, which used a different method.
The product route measured +12.1 KB after Add to Bag (Unit 5), before the Zod removal; it
was not re-measured since. The drawer is a separate lazy chunk (~10.6 KB gz).

**Quick Add** (2026-09-20) adds an eager island to the catalog routes and to the homepage
rail whenever the catalog answers with photographs; it adds nothing to a page with no
product card. It reuses the store, the toast module and `variant-selection.ts` the bag
already ships, so what is new is the component and two lucide glyphs. Not measured
against a baseline: those routes are dynamic (`ƒ`), so there is no prerendered
`.next/server/app/*.html` to sum. The route chunks that carry it gzip to 3.7-7.6 KB
**including their neighbours**, which is an upper bound, not the island's cost.

**Sonner** (2026-09-15, same method). With the toaster loaded eagerly, `/en` was
**258,816 B** (from 244,959 on `main`, and 251,064 before the toaster and loading work),
`/en/bag` 260,450 B, `/en/products/silk-midi-dress` 255,525 B. Sonner's imported surface
(`Toaster` + `toast`, minified, React external) is 9,629 B gz. The owner chose to keep Sonner
and its look but lazy-load it (see *Toasts* → *Lazy loading*). Lazy (`29f2bdf`, same method):
`/en` **250,616 B** (+5,657 B over `main`, −8,200 B from the eager toaster), `/en/bag`
252,128 B, `/en/products/silk-midi-dress` 247,233 B (measured with `next start` and
`API_URL` set; without it the product lookup throws and the page renders not-found). No eager
chunk contains Sonner markers; Sonner ships as one lazy chunk. What remains on every page is
the header bag island, about 0.66 KB over the plan's 5 KB budget and below the ~6.1 KB the
owner accepted; `/en`, `/ar`, `/en/bag` and `/ar/bag` still build static (`●`).

### Implementation outcomes

- Server batched reads use a bounded `IN ($1, …, $n)` list, not `ANY($1)`, because pg-mem
  did not support the latter.
- Quantity re-quote debounce: 300ms.
- **Open:** how the server's `sanitizeBody` treats option values that look like tags was
  not verified; such a value could be rewritten before matching and resolve
  `variantUnavailable`.
- Dropped-variant warnings are not logged on the quote path.

### Open for the screenshot review

Browser-only; no storefront DOM or browser harness exists, so none of this is proven by a test.

- Drawer: slide side and close-button position in RTL; full width at 320; long Arabic names.
- Remove fade and focus hand-off, including rapid double removes; Undo in the drawer and on
  `/bag` puts the line back in place with its quantity and photograph.
- Rapid stepper presses: the line total and subtotal stay in place, dim and return to ink
  with no width change; one toast after the quote settles.
- The header drawer opened right after Add to Bag with a quote already on screen: the new
  line shows the page's name, photograph and price at once, and no line total until its quote.
- Toasts: bottom inline end at 1440, full width at 320 in Arabic (message, action and close
  on one row or wrapping without overflow); no duplicate with the drawer open over `/bag`;
  Sonner's swipe and stacking under reduced motion.
- Lazy toaster: press Add to Bag the moment the product page renders (cold cache, before
  idle): the toast appears and is announced once; rapid presses give one replacing toast,
  none lost or doubled; Alt+T works once the page has idled; the ink pill is unchanged.
- Keyboard Undo over the open drawer (source-verified, not yet seen in a browser): remove a
  line, Alt+T, Tab to Undo, Enter; the line returns and focus goes back to the drawer row.
  Also Escape while focus is in a toast (it closes the drawer too), and that Shift+Tab from a
  toast and a screen reader's browse mode no longer reach the skip link, `main` or the footer
  while the drawer is open (the drawer marks them inert), and that they are usable again as
  soon as it closes, including focus landing on `main` after View bag.
- Placeholders never flash on a fast quote (150ms delay); the breathing reads as quiet,
  not as shimmer; content fades in once and never on a stepper press.
- A row with no quote and no hint (throttled network): options, stepper and Remove usable;
  focus after removing a neighbour lands on its Remove.
- Announcement wording and timing in both locales (VoiceOver/NVDA).
- Focus after closing: Escape, backdrop, the X and Continue shopping return to the header Bag
  link; a line name, View bag or the empty state's link lands on `#main-content` after the
  slide-out, with no visible ring flashing on the Bag link in between (both locales, and
  under reduced motion). Reopen the drawer during the slide-out: focus stays in the drawer.
- Remote line images (needs `MEDIA_ORIGIN`); the iOS safe-area footer.
- `/bag` line layout at 320, 375 and 768-1023; the sticky summary from 1024 clearing the header.
- No hydration warnings; `/bag` reload at 320 and 1440: reserved region → placeholder rows
  → content with no empty flash and no summary jump; the failed state with the API stopped.
- Reduced motion: placeholders static and immediately visible, no reveal fades.
- Arabic: the provisional name's `lang`, "هذه القطعة" in stepper and Remove names.
- Product page stepper row at 320, 375 and 1440 in both locales: the stepper and button
  edges line up, the Arabic button wraps below the stepper at 320 with no horizontal
  scroll, and the stepper sits at the inline start (right in Arabic).
- 8 of a selection in the bag, stepper at 5, Add to Bag: the line reaches 10 and the toast
  says "You can add up to 10 of this piece"; the stepper is back at 1 afterwards. A sold-out
  product shows no stepper; Tab runs Decrease, Increase, then Add to Bag.
- Keyboard and screen-reader path: `docs/ACCESSIBILITY.md` → *Manual scenarios* 8.

## Checkout (base UI)

Plan `2026-09-15-002-feat-storefront-checkout-ui`; decisions are cited as CO-n there.
Bag → `/checkout` → contact, delivery address, delivery structure and the quote's summary →
validated form state → the commerce seam. **No order is created, no stock is reserved and no
payment is taken.** The commerce strategy (API-first, gateway-first, IPN/webhook, manual
confirmation, COD or a mix) is deliberately undecided, and nothing here depends on it.

### Availability (CO-22)

`CHECKOUT_ENABLED` (`features/cart/utils/checkout-availability.ts`) comes from
`NEXT_PUBLIC_CHECKOUT_ENABLED`, read at `next build`: `true` or `false` wins; otherwise it is on
unless `NODE_ENV === 'production'`. Off: no Bag entry, and `/checkout` is a prerendered 404.
**Production leaves it unset until a commerce strategy exists; preview deployments set `true`.**
The route and its code stay compiled and tested either way. `features/cart/constants.ts`
re-exports the value as `CHECKOUT_ENTRY_ENABLED` for the entry.

### Entry and readiness

`checkoutReadiness` (cart slice, pure) returns `hydrating | empty | checking |
failed{rejected} | blocked{unavailable, limited, blockedKeys} | ready{quoteKey, pieces,
subtotal, priceUpdated}`. It blocks on no current quote, a pending row, a failed quote, any
sold-out or unavailable line and any `reduced` line. **A price change never blocks**: the new
price shows and the bag-updated notice says so (owner, 2026-09-15). `strict: false` on `/bag`
(a focus refetch of an unchanged bag keeps the link, and keyboard focus with it); `strict: true`
on submit. `CheckoutEntry` in `BagSummary`'s slot is a link only when ready, otherwise an
`aria-disabled` button described by a reserved reason line. No entry in the drawer (CO-4).
`reconcileBag`'s announcement mark key carries an issue signature (`issueMarkKey`), because the
quote key ignores stock and price: a second sell-out under the same lines is announced too.

### Page

`app/[locale]/checkout/page.tsx`: static per locale, `noindex, nofollow`, outside `(catalog)`,
no `loading.tsx` (`app/checkout-route.test.ts`). The normal header and footer, a "Back to bag"
link, the rising `h1`, then `CheckoutView` (boundary 18). Before the bag hydrates: one reserved
busy region, no fields. An empty bag: the Bag's empty state, no form. Otherwise a 12-column grid
from 1024 (form 7, summary 4, sticky at the inline end); below, the summary comes first. The
summary is first in source order at every width, so from 1024 Tab reaches Edit bag before the
fields (accepted, CO-19).

### Fields

| Field | Required | Input | `autocomplete` | Limit |
| --- | --- | --- | --- | --- |
| Full name | yes | text | `name` | 100 |
| Mobile number | yes | `tel`, `dir="ltr"` | `tel` | 30 as typed |
| Email | no | `email`, `dir="ltr"` | `email` | 254 |
| Governorate | yes | text (`GovernorateField`) | `shipping address-level1` | 50 |
| City or area | yes | text | `shipping address-level2` | 50 |
| Street | yes | text, hint "Street name and building number" | `shipping address-line1` | 150 |
| Floor and apartment | no | text | `shipping address-line2` | 50 |
| Landmark or directions | no | text | `off` | 200 |

Rules live in the pure `checkoutFieldError`, which the `zod/v4/mini` schema wraps. Messages are
keys (`required`, `phoneInvalid`, `emailInvalid`, `tooLong`) resolved from `checkout.errors`.
Phone: Arabic digits mapped, spaces, hyphens, dots and parentheses removed, an optional leading
`+`, 8-15 digits, and no Egyptian prefix rule (owner). **Governorate is free text** (owner): no
list of all 27, which would imply delivery everywhere. `GovernorateField` is the one component a
supported-coverage select replaces once delivery zones exist. Lengths fit `online_orders` (CO-8).

### Validation UX (owner decision 2026-09-15)

Inline errors (icon, text and border, in a reserved row linked by `aria-describedby`) show once a
field was left (`isBlurred`) or after Continue. They are computed from the value with the pure
rule, never read from TanStack's per-cause error maps: form-core keeps a form `onSubmit` error in
the field's `errorMap` until the next submit, so a fixed field would still show it. Continue on
an invalid form focuses the first invalid field in DOM order (`firstInvalidField`); a field that
already has focus is blurred and refocused on the next frame so it is announced again. **No toast
for form validation.** Toasts are only for events outside the fields: the bag's quote updates and
failures (the controller's) and the outcome.

### Submit machine and commerce seam

`utils/submit-machine.ts` (pure): `idle → validating → verifying{refreshed} → submitting →
outcome`. `verifying` ignores readiness until the pre-submit `refresh()` has settled (in the
commit that enters it, TanStack still reports the previous quote) and accepts `ready` only for
the current lines' key; a second press while busy is ignored. The form is `method="post"` and
`noValidate`, with `preventDefault` first, so personal data can never become a GET query.
`buildSubmission` sends trimmed contact and address, the normalised phone and the intent lines
with `quoteKey` (untrusted, a correlation value only): never a price. `features/checkout/commerce/index.ts`
exports the active strategy, today `unavailableCommerce` (`{ kind: 'unavailable' }`, no I/O).

**Commerce invariants.** Before any order is final the future implementation MUST, on the server,
revalidate products, variants and stock, reprice every line, determine delivery and calculate the
payable total. The quote shown on Checkout is authoritative for the UI only and is never a
transaction guarantee. **Seam invariants:** the submission travels in a body, never a URL; a
redirect outcome goes only to an allowlisted origin; submission and form values are never logged
or sent to error reporting; credentials are explicit per adapter; success clears the draft.

### Copy

"Online ordering isn't open yet…" (`checkout.outcome.unavailablePreview`) is **development and
preview QA copy only**: production cannot reach it (CO-22), and the commerce plan replaces it.
Delivery wording stays neutral, with no timing, coverage, fees or couriers
(`checkout-strings.test.ts` guards it). The CTA is "Continue". All checkout Arabic is a first
draft in the feminine-singular register, pending the native review on #201.

### Draft persistence (CO-16)

`sessionStorage` key `moon-fashion-checkout`, `{ version: 1, draft }`: non-empty contact and
address strings only, written after 400ms of quiet and on `pagehide`, read once before the form's
first render as its `defaultValues`. A malformed or other-version draft is removed; a field
survives only as a known key holding a string within its limit. Retention is the browsing
session (a reopened or duplicated tab restores it), never `localStorage`; no "Remember my details"
control; no payment data, tokens, prices or the quote. Storage that throws means no draft, never
an error. **Any new third-party script on this origin requires re-reviewing this persistence**:
it could read the draft.

### Delivery method

`DeliveryMethodSection` takes `methods` (empty today) and renders one neutral sentence; the
summary shows "Delivery: Confirmed later", with no figure and no Total. The required radio group
lands with real delivery rules and is not built ahead of them.

### Bundle (2026-09-15, same method as *Cart* → *Bundle budget*)

Built with `NEXT_PUBLIC_CHECKOUT_ENABLED=true`: `/en` **250,785 B** (250,616 before), `/en/bag`
**253,846 B** (252,128 before, +1.7 KB: the entry, its model and the plural strings; the plan's
budget was +1 KB), `/en/checkout` and `/ar/checkout` **282,495 B**, +28.6 KB over `/en/bag`
(plan budget +25 KB) for TanStack Form, `zod/v4/mini` and the island. Both overages are recorded
for the owner, not worked around. No eager chunk on `/en` or `/en/bag` contains TanStack Form,
Zod or Sonner markers. The "before" figures are the lazy-toaster measurement (`29f2bdf`); this
build also carried unrelated uncommitted working-tree changes, so the deltas are approximate.

### Open for the screenshot review

Browser-only; no storefront DOM or browser harness exists.

- The summary disclosure at 320 and 375 in both locales; the sticky column with a long bag at
  1024 and 1440 (the list scrolls, Subtotal stays visible).
- The field grid at 768; `dir="ltr"` phone and email alignment in Arabic.
- Focus after an invalid Continue with the phone keyboard open; the refocus announcement in
  VoiceOver and NVDA.
- The notice's inline-start rule; the outcome row; the Bag entry's reason line in Arabic at 320.
- Keyboard and screen-reader path: `docs/ACCESSIBILITY.md` → *Manual scenarios* 9.

## Guideline overrides and copy decisions

- §12·11 Newsletter and §12·12's "newsletter if not already above" are excluded by the
  brief; §12·04's editorial brand moment is replaced by a promo banner for a new collection or
  an offer (user decision, 2026-09-14; copy in `home.banner`, href/slots/crop in
  `features/home/data/promo-banner.ts`, and offer
  terms only ever from the business), and its "Explore the story →" is dropped (an
  About-shaped destination); §12·12's
  Customer Care column is omitted until Shipping/Returns/Contact pages are planned. No
  FAQ, Blog, About, Newsletter or policy text anywhere.
- §12·08 is **The Moon Selection** (owner brief, 2026-09-21), renamed from The Edit.
  Copy is `home.selection` (title, description, link — no eyebrow). Its **grid is the
  original one**: a 2x2 `ProductCard` feature plus four standard cards. An asymmetric
  editorial spread sharing nothing with `ProductCard` was built against the brief and
  the owner preferred the cards after seeing it; the spread is in the history at
  `cebe648` rather than deleted. Its heading is the section's own, not `SectionHeading`.
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

Six slices exist. `features/checkout` owns the checkout page (form, schema, draft, submit
machine, commerce seam) and imports from `cart` (the controller, readiness, reconcile, bag
strings) and `products` (price, names, the image placeholder); `cart` **never imports
`checkout`**, which is why checkout readiness and the Bag entry live in the cart slice. `features/home` composes the homepage from static, typed mock data
and imports from `products` and `collections`. `features/catalog` is the listing
composition slice (URL state, route table, intro, category row, grid, controls,
pagination, empty states, and the product page's related row) and imports from both.
`products` and `collections` own their catalog API functions and DTOs and still do not
import each other; the one reverse edge is `products/api/list-catalog-products.ts` taking
`CatalogProductQuery` from `features/catalog/search-params.ts` (a dependency-free
module). Keep it the only one: `ProductDetail` takes its category and collection hrefs
from the page (which may call `catalogPath`) rather than importing it, and the related
row lives in `catalog`, not `products`. `features/cart` owns the bag (store, quote,
drawer, page island) and imports from `products` (readiness, price, names, the image
placeholder, `PurchaseSelectionContext`) and `catalog`'s pure utilities; `features/products`
**never imports `features/cart`** — the product page composes both (Add to Bag into the
panel's `action` slot), and the layout composes `BagTrigger` into the header. A slice
follows this shape:

```
features/<slice>/
  api/        # calls into lib/api, feature-specific query hooks
  components/ # feature-owned UI, not reused elsewhere
  schemas/    # validation schemas or hand-written guards for this feature's data
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
- Catalog reads call the API at request time from the server (see *Catalog*), so
  `next build` still makes no API call. `NEXT_PUBLIC_API_URL` is used by exactly one
  caller, the bag's browser quote (see *Cart*), and must be an origin the API's
  `STOREFRONT_ORIGINS` allows. The first **statically rendered** page that fetches data must have `API_URL`
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
*Rendering and caching*), chosen on their own merits. `/en/bag` and `/ar/bag` are SSG
(`●`): the page reads no request data and the bag fills in the browser after hydration. `/en/checkout` and `/ar/checkout` are SSG too when
Checkout is enabled in the build, and a prerendered 404 when it is not (CO-22).
The catch-all and 404 are unchanged. Each future feature (checkout, a session) chooses its own
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
