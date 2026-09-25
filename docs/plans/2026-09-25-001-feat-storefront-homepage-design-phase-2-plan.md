---
title: 'feat: Storefront Design Phase 2 — Homepage'
type: feat
status: active
date: 2026-09-25
---

# feat: Storefront Design Phase 2 — Homepage

Target: `apps/storefront` only. Paths are relative to the repository root.
Branch: `zhamdy/storefront-homepage-phase-2` (local only), cut from
`zhamdy/storefront-design-system-phase-1` at `c20861e`. Design System Phase 1 is **frozen**:
this plan consumes its tokens and primitives and changes them only where a homepage
requirement exposes a real gap (listed under _Design-system gaps_).

## Overview

Phase 1 moved the whole storefront onto the 2026-09-25 design system's tokens, faces and
primitives but deliberately left page compositions alone. The homepage therefore renders
in the new faces and colours while still being composed for the old system: three
different section-header patterns, legacy token aliases, Bronze used as the default link
colour, per-callsite uppercase/tracking overrides that the primitives now own, two dark
full-bleed sections back to back, and a product-card grid that makes no commerce claim.

Phase 2 applies the design system **deliberately** to the homepage: hierarchy, rhythm,
image sizing, typography, spacing and motion, section by section. The information
architecture (ten sections, in order) is preserved. No API, cart, checkout, catalog
contract or backend change.

## Problem Frame

The homepage is the reference surface for every later page phase. If it ships with the
old composition habits in the new skin, Shop, Collections and PDP will copy them. Equally,
several open questions are art-direction or business calls, not engineering, and must be
decided by the owner rather than settled silently in code (see _Owner decisions_).

## Requirements Trace

- R1. Each of the ten sections is reviewed and gets an explicit keep / refine / restructure / simplify decision.
- R2. Clear distinction between **editorial/campaign** sections (hero, strip, Silk Edit, Featured, Campaign slot, Lookbook) and **commerce** sections (New Arrivals, Categories, Selection, Benefits).
- R3. Correct face per role: Instrument Serif / Amiri for display only; Hanken / Tajawal for UI, body, prices; no uppercase or tracking in Arabic.
- R4. Square media everywhere (owner-approved rule); token-driven radii only.
- R5. Consistent containers (`Container` page/wide) and spacing tokens (`section-y`, `section-y-commerce`); no ad-hoc `py-*` section padding.
- R6. Ink is the primary action colour; Bronze restrained to accent roles (one per view at most as a solid, links on light only where they are the section's accent).
- R7. Better mobile composition: copy never over a face, campaign copy below the photograph on phones, one clear anchor per viewport.
- R8. EN/AR parity and RTL correctness (logical properties, photographs never mirrored, photo-anchored overlays physical).
- R9. Motion concentrated in Hero, Strip, Featured, Campaign slot and Lookbook; commerce sections calm; reduced motion shows the final state with an identical layout.
- R10. No new client boundary, homepage stays SSG (`●`), eager JS on `/en` within +1 KB gz of `255,390 B`.
- R11. No change to APIs, cart/quote/checkout logic, catalog data contracts or `apps/server`.

## Scope Boundaries

- Only `app/[locale]/page.tsx`, `features/home/**`, and the homepage's use of shared components.
- Shop, Collections, Product detail, Bag, Checkout: **not modified**. A shared component
  (`SectionHeader`, `ProductCard`) changes only when a homepage requirement
  exposes a design-system gap, and the change must be additive (new optional prop / variant)
  so other pages render byte-identically.
- Header/footer/mobile menu: frozen with Phase 1.
- Copy: no new marketing claims. New strings only where a section gains a visible label
  (Lookbook heading already exists in both catalogues; eyebrows if D1 allows).
- Newsletter (§12·11) stays excluded by the brief.

### Deferred

- Real photography swaps (by file drop, no code).
- The marquee stop control (WCAG 2.2.2, open gap) unless D7 reopens it.
- Catalog page compositions (Phase 3+).

## Context & Research

### Current homepage (`app/[locale]/page.tsx`, SSG)

| #   | Section (user's name) | Component                                                      | Surface                         | Heading pattern                                                          | Padding                   |
| --- | --------------------- | -------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------ | ------------------------- |
| 1   | Hero                  | `hero/hero.tsx` + `hero-carousel.tsx` (client, boundary 7)     | ink, full-bleed, `h-svh`        | sr-only `h1`; slide `h2` `type-display md:type-display-xl` **uppercase** | —                         |
| 2   | Editorial strip       | `editorial-strip/*` (CSS marquee)                              | sand (`bg-surface-soft`)        | sr-only `h2`                                                             | `py-10 lg:py-14`          |
| 3   | New Arrivals          | `new-arrivals/*` (client rail, boundary 19)                    | ivory                           | own header, `type-h2` + `type-small` lead                                | `py-16 md:py-20 lg:py-24` |
| 4   | Silk Edit promo       | `promo-banner/promo-banner.tsx`                                | ink, full-bleed, `90svh` / 16:9 | gold rule + `TextReveal` `type-h1` (clamp override)                      | —                         |
| 5   | Featured collection   | `featured-collection/*`                                        | **dark** (`bg-dark-surface`)    | gold rule + `TextReveal` `type-h2 lg:type-h1`                            | `py-20 lg:py-28`          |
| 6   | Shop by Category      | `category-grid/*` + `collections/components/category-tile.tsx` | ivory                           | `SectionHeading` (home-local)                                            | `section-y`               |
| 7   | Campaign              | **`components/promotion/promotion-banner.tsx`** (BOGO offer)   | dark, 21:9 capped 40rem         | gold rule + `TextReveal` `type-h1 md:type-display`                       | —                         |
| 8   | The Edit              | `moon-selection/*` ("The Moon Selection")                      | ivory                           | own header, gold rule + `type-h1 lg:type-display`                        | `section-y`               |
| 9   | Benefits              | `benefits/*`                                                   | sand (`bg-surface-alt`)         | sr-only `h2`                                                             | `py-16 lg:py-20`          |
| 10  | Lookbook              | `lookbook/*`                                                   | ivory                           | **sr-only only**                                                         | `section-y`               |

Unused in the tree: `features/home/components/campaign/campaign.tsx` ("Dressed for the
night.", `home.campaign.*`) — replaced in slot 07 by the promotion on 2026-09-21 but never
deleted; editorial slots `moment` / `moment-wide` have files and no renderer.

### Audit findings (screenshots at 1440 and 390, EN and AR, real local API; source read)

**Hierarchy and typography**

1. Three header patterns for the same job: home `SectionHeading` (Categories), New
   Arrivals' own header, Moon Selection's own header. The design-system `SectionHeader`
   is unused on the homepage (its doc says "until the homepage phase").
2. Heading steps are chosen ad hoc: `type-h2`, `type-h1`, `type-display`, a raw
   `text-[clamp(3rem,5.2vw,5rem)]` override on the Silk Edit title. Two signature
   sections (Silk Edit, Campaign) and one commerce section (Selection) all reach display
   size, so the page has no clear top of hierarchy below the hero.
3. Hero collection names are forced `uppercase` at display size; the design system sets
   sentence case except eyebrows and button labels. (No effect in Arabic.)
4. `EditorialLink` now owns `type-label` (uppercase EN, untracked AR), but four sections
   still pass `uppercase tracking-[0.12em] rtl:tracking-normal min-h-11 gap-4 pb-2` and
   custom hover colours (`hover:text-luxury`, `hover:text-metallic`) — duplicated and
   slightly different per section.
5. Legacy `type-h1…h4` aliases everywhere on the page; they resolve correctly but hide the
   role (`type-h4` on category labels and benefit titles).

**Colour and surfaces** 6. Legacy aliases in every section: `bg-dark-surface`, `bg-surface-alt`, `text-metallic`,
`text-luxury`, `text-text-inverse`, `from-scrim-strong`, `via-editorial-secondary/25`. 7. Bronze is the default link tone on light sections ("View all", "Explore the selection")
and the Benefits icon colour, and category tiles tint Bronze on hover — more Bronze than
the "one accent" rule allows. 8. **Rhythm defect:** Silk Edit (ink, full-bleed) is immediately followed by Featured
collection (dark band). At 1440 they read as one ~1,900px dark block; the Featured
section's own top padding is lost in it. 9. Surface sequence today: ink · sand · ivory · **ink · dark** · ivory · dark · ivory · sand · ivory · (footer) espresso.

**Composition and imagery** 10. Silk Edit and the Campaign slot use the same formula (full-bleed photograph, gold
rule, display title, one link, physical-left copy). Two identical signature moments
four sections apart dilute both. 11. On phones the Silk Edit and Campaign copy sits over the photograph on a scrim; the
design system moves campaign copy below the image onto Espresso so it never covers a face. 12. Moon Selection renders `ProductCard`s from the editorial mock set: photographs and
display-face names with **no price, no link, no action** (by design, HIGH-1). In the
commerce register this reads as a broken product grid rather than as editorial. 13. Lookbook has no visible heading, caption or destination: the page ends on five
unlabelled photographs before the footer. 14. Category tiles use `aspect-3/4` and one oversized lead tile; on mobile a 70vw
snap rail. Works; the lead tile's `row-span-2` makes the 1440 grid top-heavy relative
to the product grid below. 15. Section padding is inconsistent (`py-16/20/24`, `py-20/28`, `py-10/14`, `section-y`).

**Motion** 16. Five sections use the word-masked `TextReveal` or long staggered choreography;
commerce sections (New Arrivals `--motion-rise:48px`, Categories 72px, Selection 40px + 120ms step) move almost as much as the editorial ones. 17. Reduced motion is honoured (global rule zeroes durations **and** delays; Reveal never
marks pending; Parallax detaches; marquee stops) — verified: 0 pending reveals, 0
running animations on `/en` with `prefers-reduced-motion: reduce`. 18. The strip still has no stop control for keyboard/touch (documented WCAG 2.2.2 gap).

**Arabic / RTL** 19. Arabic display now renders in Amiri (Phase 1). Masked entrances (`TextReveal`, the
hero `data-enter="line"` mask with `pb-[0.12em]`) were tuned for Lora/Instrument
descenders; Amiri's taller marks need the mask padding re-checked. 20. Photo-anchored copy is correctly physical (`rtl:ms-auto`) in the Campaign slot and
Silk Edit; rails, arrows and marquee follow reading direction. No RTL defect found.

**Tests that touch the homepage:** `hero-carousel-state.test.ts`, `rail-scroll.test.ts`,
`load-new-arrivals.test.ts`, `commerce-hrefs.test.ts`, `promo-banner.test.ts`,
`lib/editorial/assets.test.ts` (slot ↔ file guard), `reveal-policy.test.ts`,
`messages.test.ts` (EN/AR parity). No DOM test covers a home section.

### Standing contract to respect (`apps/storefront/CLAUDE.md`)

Client-boundary list (no additions), `Reveal`/`data-motion` system and "reveal and hover
never share an element", header boundary on the hero, `slideMediaVisible` download rule,
`[data-rail]` geometry and `FALLBACK_PRODUCTS = 8`, HIGH-1 (mock data makes no commerce
claim), image pipeline (`editorialImages` registry, asset guard), "No eyebrows" owner rule
of 2026-09-14 (see D1), Motion §5 marquee rules.

## Section-by-section direction

Legend: **Keep** (tokens only) · **Refine** (same composition, tuned) · **Restructure visually** (new composition, same content and IA) · **Simplify** (remove chrome).

### 1. Hero — Refine

- Keep the full-bleed carousel, four slides, autoplay/stop rules, `slideMediaVisible`, scrims.
- Collection name: drop `uppercase`; `type-display-xl` sentence case (D5). Arabic Amiri at its own display leading; re-tune the line mask padding for Amiri.
- Eyebrow line → `type-eyebrow` on dark (Champagne via surface accent), not a raw `text-metallic` caption.
- CTA: plain `EditorialLink underline="always"`; remove `hover:text-metallic` override (surface accent already resolves to Champagne).
- Collection index: `type-label`, current item ivory + gold rule (unchanged behaviour).
- Tokens: `bg-dark-surface` → `bg-bg` under `data-surface="ink"`; scrims → `from-image-shade` tokens.
- Motion: unchanged sequence (120 → 560ms), total ≤ 1.2s, per guideline §12·01.

### 2. Editorial strip — Keep (refine tokens and scale)

- Keep the marquee, alternating words and square photographs, 34s set, hover pause, RM stop.
- Words at `type-display` (Instrument EN / Amiri AR); strip photos move from a raw 180px constant to a token-derived height so the band scales at 390 (currently the words dominate the phone viewport).
- Band padding → `section-y-commerce`-scale token pair; surface stays Sand.
- Motion: strongest ambient motion on the page; no entrance added.

### 3. New Arrivals — Refine (commerce, calm)

- Header → `SectionHeader layout="commerce" size="section"` (title "Just in" / "جديدنا", lead only with a real catalogue, "View all" as an Ink `EditorialLink`).
- Rail controls → `IconButton variant="outline" directional`.
- Padding → `section-y-commerce`. Card captions stay `stacked`, QuickAdd `above`.
- Motion: one header rise (16px) and a fade-rise on the first four cards (24px, 70ms step); no image wipe.

### 4. Silk Edit promo — Restructure visually

- Desktop (`banner-wide`): keep the 16:9 full-bleed photograph; copy moves from a centred block to a **start-aligned** column on the photograph's empty side (physical, as today), title at `type-display` (remove the raw clamp override).
- Phones: **copy below the photograph** on Espresso (design-system imagery rule), photograph at `aspect-campaign` mobile (4:5) with no text over it; removes the mobile floor scrim.
- Keep one `EditorialLink`. Eyebrow only if D1 allows ("New collection" / "مجموعة جديدة" already in copy).
- Motion: image settle + `TextReveal` title (signature), body/link fades.

### 5. Featured collection — Restructure visually

- Fix the dark-on-dark adjacency with Silk Edit (finding 8): move to **Ivory** (D4), keeping the experimental overlap from guideline §12·05.
- Grid: large image columns 1–7, pause column 8, text + small image 9–12 (design-system asymmetry rule); small image overlaps the large one's inline-end edge on desktop only.
- Phones: large image full-width, text, small image offset to the inline end at ~60% width; no overlap.
- Title `type-section-title` in display face; body `type-body-lg measure`; Ink link.
- Motion: signature — image wipe on the large frame, element parallax on the small one (desktop only), `TextReveal` title.

### 6. Shop by Category — Refine (commerce)

- Header → `SectionHeader layout="commerce" size="section"`.
- Tiles: `aspect-portrait` (3:4) kept; lead tile spans 2 columns but **one row** at 1024+ (removes the top-heavy block); 5 tiles become 2 + 3 at 1440. Mobile snap rail unchanged.
- Remove the Bronze hover tint; label in `type-title` Ivory over the `image-shade` gradient with an Ivory underline that draws on hover/focus.
- Motion: calm — a single fade-rise for the row (no 72px rises, no per-tile stagger beyond 3).
- `CategoryTile` is rendered only by the homepage, so it is edited in place.

### 7. Campaign — Refine (and decide the slot, D2)

- Today the slot is the BOGO promotion; the "Dressed for the night." campaign component is dead code.
- Direction (if D2 = keep the promotion): make it the page's **one cinematic moment** — `aspect-cinema` capped at 40rem on desktop, copy below the photograph on phones (as §4), optionally on the Midnight surface (D6) to separate it from the Silk Edit's Espresso.
- Title `type-section-title`/`type-display` (one step below Silk Edit so the two signature moments are not twins), terms as `type-caption` small print, one `EditorialLink`.
- Motion: settle + scroll parallax on the photograph, `TextReveal` title.

### 8. The Edit (The Moon Selection) — Simplify / restructure visually (D3)

- The current grid imitates commerce without making claims (finding 12).
- If D3 = **editorial**: re-present as an editorial selection, not product cards — one large 4:5 feature + four 4:5 frames with **caption-only** (name in `type-product-title`, no price row, no action slot, no card chrome), `SectionHeader layout="split"`, one Ink link to `/shop`. Keeps HIGH-1 intact.
- If D3 = **catalogue-fed**: read an existing collection through the existing listing (`listCatalogProducts` with a collection scope — no API change), render real `ProductCard`s with QuickAdd like New Arrivals, and hide the section when the collection is empty or the API cannot answer (no static fallback, per MED-3).
- Either way: commerce register, calm motion (fade-rise, one image wipe on the feature at most).

### 9. Benefits — Simplify

- Keep the Sand band and the three items (copy is still launch-blocked; unchanged).
- Icons in `text-text` (remove Bronze), titles `type-title`, body `type-supporting`, dividers `border-border`.
- Padding → `section-y-commerce`; visible heading stays sr-only.
- Motion: one fade for the list (no per-item rise).

### 10. Lookbook — Refine

- Add a small visible header (`SectionHeader layout="split" size="section"`: "Lookbook" / "ألبوم الموسم", no link — there is no lookbook route) so the page does not end on unlabelled images (D8 confirms copy).
- Keep the desktop 12-column mosaic with per-image element parallax and the 78vw mobile snap rail; add the rail's fractional-next-card cue at 768–1023.
- Square frames, `aspect-*` tokens instead of raw classes in `lookbook.ts`.
- Motion: signature — per-image parallax (desktop), image wipes staggered by column.

### Resulting rhythm

ink (Hero) · sand (Strip) · ivory (New Arrivals) · **ink** (Silk Edit) · ivory (Featured) ·
ivory (Categories, separated by hairline + spacing) · **ink or midnight** (Campaign slot) ·
ivory (Selection) · sand (Benefits) · ivory (Lookbook) · espresso (footer). No two dark
sections adjacent; editorial and commerce alternate.

## Component reuse strategy

| Need                    | Reuse                                                                                  | Change                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Section headers         | `components/ui/section-header.tsx`                                                     | additive motion + display size (G1, G2); home `SectionHeading` retired                                                            |
| Links                   | `EditorialLink` (`tone="text"` default, `underline`)                                   | none; delete per-callsite uppercase/tracking/hover overrides                                                                      |
| Rail controls           | `IconButton variant="outline" directional`                                             | none                                                                                                                              |
| Eyebrow (if D1)         | `Eyebrow`                                                                              | none (on dark it resolves to Champagne through the surface accent)                                                                |
| Product tiles           | `ProductCard` + `QuickAdd`                                                             | none                                                                                                                              |
| Category tiles          | `features/collections/components/category-tile.tsx`                                    | edited in place (homepage is its only renderer)                                                                                   |
| Full-bleed photo + copy | new home-local `CampaignFrame` (`features/home/components/campaign-frame.tsx`, server) | used by Silk Edit and the Campaign slot: photograph, scrim side, copy placement (overlay desktop / below on phones), motion hooks |
| Motion                  | `Reveal`, `TextReveal`, `Parallax`, `Marquee`                                          | none                                                                                                                              |
| Containers/spacing      | `Container`, `section-y`, `section-y-commerce`, `grid-editorial`                       | none                                                                                                                              |

Home-local and not promoted to `components/ui` in this phase: `CampaignFrame` (only the
homepage uses it; Collections can promote it in its own phase).

## Design-system gaps (the only shared changes allowed)

- **G1 `SectionHeader` has no motion hooks.** The homepage needs `data-motion` on title/lead/action with offsets, and the primitive deliberately has none. Add an optional `motion?: 'none' | 'calm' | 'editorial'` that only sets `data-motion`/offset attributes; default `none` keeps every existing caller identical.
- **G2 `SectionHeader` has no display step.** Editorial headers (Featured, Lookbook split) need `type-display`/`type-section-title` choices beyond `section | page`. Add `size: 'display'`. Additive.
- **Not a gap: `CategoryTile`.** It lives in `features/collections/components/` but the homepage's `CategoryGrid` is its only renderer (verified by search), so its Bronze hover and `type-h4` label are changed in place as homepage work, not as a design-system change.
- Not gaps (use as is): `aspect-cinema|campaign|portrait|product`, `image-shade`, `section-y*`, `Eyebrow`, `IconButton`, `EditorialLink`.
- Legacy token aliases (`dark-surface`, `surface-alt`, `metallic`, `luxury`, `text-inverse`, `scrim-strong`) are **migrated off on the homepage only**; the aliases stay for other pages until their phase.

## Responsive behaviour

| Width      | Rules                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 320–389    | One anchor per viewport; campaign copy below photos; strip photos smaller; category rail 70vw; selection 2-up captions without price rows; no horizontal scroll at 320.                          |
| 390–767    | As above; hero description clamps to 3 lines (existing).                                                                                                                                         |
| 768–1023   | Featured stacks with offset small image; category grid 2-up (last tile full row as today); lookbook rail with fractional card; Silk Edit uses overlay only when `banner-wide` (landscape ≥ 4:3). |
| 1024–1439  | 12-column editorial grid; Featured overlap on; lookbook mosaic; category 2+3.                                                                                                                    |
| 1440–1920+ | `--container-max` 1440 for commerce, `--container-wide` 1680 for Featured/Lookbook; full-bleed photographs capped in height (40rem / 50rem) with explicit `w-full` (CLAUDE.md learning).         |
| 200% zoom  | Grids reflow to 2-up, editorial splits stack, no horizontal scroll (verified tool: 640px viewport).                                                                                              |

## Arabic / RTL considerations

- Display headings in Amiri (Bold on the smaller steps per the type scale), UI/body in Tajawal; Latin digits/letters fall through to Hanken/Instrument (prices, "EGP" never appears on home except New Arrivals prices).
- No uppercase, no letter-spacing on Arabic headings, eyebrows keep the gold rule as their marker.
- Re-tune every mask (`TextReveal`, hero line mask) for Amiri's ascenders/descenders and tashkeel (e.g. "مختاراتُ", "إطلالات"): mask padding in `em`, checked at every display step.
- Photo-anchored overlays stay **physical** (Silk Edit, Campaign, hero scrims); layout and rails mirror via logical properties; directional icons flip (`IconButton directional`, `EditorialLink` arrow already rotates).
- Marquee and parallax run in reading direction (existing `moon-marquee-rtl`).
- Arabic `measure` 30em; body 17px; Arabic headline line-height 1.25–1.5 — verify two-line wraps don't collide with the gold rule.
- Copy parity: every new/changed key lands in both catalogues (`messages.test.ts`), feminine-singular register.

## Motion strategy

| Level           | Sections                                       | What moves                                                                                                                                                                                                          |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signature       | Hero, Strip, Featured, Campaign slot, Lookbook | Hero load sequence ≤ 1.2s; marquee drift + in-frame pan; Featured image wipe + small-image parallax + `TextReveal`; Campaign settle + parallax + `TextReveal`; Lookbook per-image parallax + column-staggered wipes |
| Editorial-quiet | Silk Edit                                      | settle + `TextReveal` title; body/link fade (one step calmer than Campaign since they are four sections apart)                                                                                                      |
| Calm            | New Arrivals, Categories, Selection, Benefits  | header 16px rise, content fade-rise ≤ 24px, ≤ 4 staggered items, 70ms step; no wipes except at most one Selection feature                                                                                           |

Rules: transform/opacity/clip-path only; no scroll-jacking; reveal and hover never share an
element; nothing moves inside the rail items on phones; `TextReveal` only on the three
signature headings (Silk Edit, Featured, Campaign); **reduced motion** = final state, same
layout (global rule + Reveal policy + Parallax detach + marquee stop) — every unit
re-verifies with `reduced_motion='reduce'` (0 pending reveals, 0 running animations).

## Implementation sequence (units)

- [ ] **U0 Baseline** — screenshots (1440/1024/768/390, EN/AR, motion on/off), `/en` eager JS (255,390 B), CLS/LCP on `/en` and `/ar`. No code.
- [ ] **U1 DS gaps G1–G2** — `SectionHeader` `motion` + `size="display"` (additive); jsdom test opt-in for attribute output; Shop/Collections/PDP untouched (diff check).
- [ ] **U2 Home token + type migration** — mechanical: legacy aliases → canonical tokens; `type-h*` → role names; remove per-callsite `uppercase/tracking/min-h-11/hover:text-*` on `EditorialLink`; padding → section tokens. Visual diff expected only where tokens differ.
- [ ] **U3 Hero** (§1) incl. Amiri mask tuning.
- [ ] **U4 Strip** (§2).
- [ ] **U5 New Arrivals** (§3).
- [ ] **U6 `CampaignFrame` + Silk Edit** (§4).
- [ ] **U7 Featured collection** (§5, needs D4).
- [ ] **U8 Categories** (§6).
- [ ] **U9 Campaign slot** (§7, needs D2/D6); delete dead code only if D2 says so.
- [ ] **U10 Moon Selection** (§8, needs D3).
- [ ] **U11 Benefits** (§9).
- [ ] **U12 Lookbook** (§10, D8).
- [ ] **U13 Rhythm + docs** — whole-page spacing pass; `apps/storefront/CLAUDE.md` (Motion table, headings table, "No eyebrows" per D1, Guideline overrides), `docs/design/editorial-image-brief.md` if crops change.
- [ ] **U14 QA and freeze** — matrix below; bundle and SSG check; plan status → completed.

Each unit: one commit on `zhamdy/storefront-homepage-phase-2`, local only.

## Test / QA matrix

| Check                 | How                                                                                                                                                                                             | Pass                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Unit tests            | `vitest` (existing home suites + messages parity + asset guard + new SectionHeader jsdom test)                                                                                                  | all green                                                                                    |
| Types / lint / format | `typecheck`, `lint`, prettier                                                                                                                                                                   | clean                                                                                        |
| Build                 | `next build` with `NEXT_PUBLIC_CHECKOUT_ENABLED=true`                                                                                                                                           | `/en`, `/ar` still `●` SSG                                                                   |
| Bundle                | gzip -9 eager chunks of `.next/server/app/en.html`                                                                                                                                              | ≤ 255,390 + 1,024 B                                                                          |
| Visual                | Playwright screenshots before/after, 1440/1024/768/390/320 × EN/AR, real local API and API-down (fallback rail)                                                                                 | reviewed section by section; no copy over faces; no dark-dark adjacency                      |
| Overflow / zoom       | `scrollWidth - clientWidth` at each width and at 640px (200%)                                                                                                                                   | 0                                                                                            |
| Reduced motion        | `reduced_motion='reduce'`                                                                                                                                                                       | 0 pending reveals, 0 running animations, identical layout                                    |
| Motion feel           | manual at 1440 and 390                                                                                                                                                                          | signature vs calm hierarchy holds; hero sequence ≤ 1.2s                                      |
| Fonts                 | CDP platform fonts                                                                                                                                                                              | Amiri only on display headings; Tajawal UI; Latin digits Hanken; no uppercase/tracking in AR |
| A11y                  | keyboard path through hero tabs, rail, category tiles, lookbook region; focus visible on ink/sand/ivory; one `h1`; section `aria-labelledby`; contrast of text over photos (scrims) and on Sand | pass; 44px targets on controls                                                               |
| RTL                   | AR at every width: masks, arrows, rails, marquee direction, physical overlays                                                                                                                   | correct                                                                                      |
| CLS / LCP             | Performance observer on `/en` `/ar`                                                                                                                                                             | CLS ≤ baseline; LCP element still hero slide 1                                               |
| Scope guard           | `git diff --stat`                                                                                                                                                                               | only `features/home/**`, `app/[locale]/page.tsx`, additive shared changes, docs              |

## Owner decisions required

- **D1 Eyebrows.** The 2026-09-14 owner rule removed every eyebrow from the homepage; the 2026-09-25 design system includes an `Eyebrow` (gold rule + label). Allow eyebrows on the editorial sections (Silk Edit, Featured, Campaign) only, or keep the no-eyebrow rule? _Recommendation: allow on the three editorial sections only; commerce sections stay without._
- **D2 Slot 07.** Keep the BOGO promotion in the Campaign slot (current), return the "Dressed for the night." campaign pause, or show both (promotion in the Silk Edit's style elsewhere is not recommended)? And may the dead `campaign.tsx`, `home.campaign.*` and the unrendered `moment`/`moment-wide` slots be deleted? _Recommendation: keep the promotion while the offer runs; delete the dead component and slots._
- **D3 The Moon Selection.** Editorial selection (no prices/links, caption-only) or a real catalogue collection (which slug; the section hides when it is empty)? _Recommendation: catalogue-fed if a curated collection exists in the dashboard; otherwise editorial._
- **D4 Featured collection on Ivory.** Moving it off the dark surface fixes the dark-on-dark block after the Silk Edit. Alternative: keep it dark and move the Silk Edit onto Ivory (not recommended: its photograph is bright silk and reads best on dark). _Recommendation: Featured on Ivory._
- **D5 Hero collection names in sentence case** ("Evening", not "EVENING"), per the design system. _Recommendation: yes._
- **D6 Midnight surface for the Campaign slot** (the design system's "one nocturnal moment per page") to separate it from the Silk Edit's Espresso. _Recommendation: yes, if the photograph holds on navy._
- **D7 Marquee stop control** (WCAG 2.2.2 open gap). Reopen the removed CSS-only toggle in this phase? _Recommendation: yes — this is the redesign touching the strip anyway._
- **D8 Lookbook visible heading** ("Lookbook" / "ألبوم الموسم", no link). _Recommendation: yes._

Units U7, U9, U10, U12 (and U4 for D7) wait on their decisions; U0–U6, U8, U11 can proceed.

## Risks

- Amiri masks clipping diacritics — mitigated by U3/U6 checks at every display step.
- Shared-component drift into Shop/Collections — mitigated by additive props and a diff-scoped scope guard.
- Bundle creep from a home-local `CampaignFrame` — server component, no client JS expected.
- Catalogue-fed Selection (D3) adds a second catalog read to an SSG page — must use the same revalidate/fallback policy as New Arrivals and keep the page `●`.

## Sources & References

- `apps/storefront/CLAUDE.md` (contract; Motion; Image pipeline; Guideline overrides)
- `docs/design/moon-fashion-website-design-guideline.md` §12 Homepage Direction
- Design system artifact (2026-09-25) README: colour, typography, imagery, motion, RTL rules
- `docs/plans/2026-09-14-001-feat-storefront-homepage-polish-freeze-plan.md` (previous freeze decisions)
- `docs/ACCESSIBILITY.md` → Known gaps (marquee)
