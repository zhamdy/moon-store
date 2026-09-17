# Code review run — storefront homepage, header and footer

- Branch: `zhamdy/feat-storefront-homepage` (base: merge-base with `zhamdy/feat-storefront-foundation`, `26c4401`)
- Mode: autofix (invoked from `/dev-code`)
- Plan: `docs/plans/2026-09-13-002-feat-storefront-homepage-header-footer-plan.md` (`plan_source: explicit`)
- Team: correctness, testing, maintainability, project-standards, agent-native (always-on);
  shaheen-react (React/TS islands), dan-frontend-races (observers, animations, hydration),
  performance (images, motion bundle). learnings-researcher skipped: `docs/solutions/` does not exist.
- Round 2: one focused correctness + races re-review of the fix diff.

## Findings (after 0.60 gate and dedup)

| Sev | Finding | Route | Outcome |
| --- | --- | --- | --- |
| P2 | Reduced-motion block zeroed durations but not `animation-delay`, so hero/menu staggers still popped in one by one (races) | safe_auto | **Fixed** — delays zeroed in `globals.css` |
| P2 | `HeaderShell` looked the hero up once; the locale layout persists across client navigation, so 404 → home left the header stuck (correctness; races residual) | gated_auto | **Fixed** — setup re-runs per `usePathname()`, resets to `auto` first |
| P2 | Motion runtime ~46 KB gz eager vs the plan's 6–14 KB budget: `motion/react` named exports do not tree-shake apart (performance) | manual | **Fixed** — `Reveal` uses its own `IntersectionObserver`; `Parallax` uses `scroll()` + `motion/mini` `animate`; measured 8.9 KB gz |
| P2 (round 2) | `scroll(animation, { target })` never reaches the native ScrollTimeline for this offset and leaks a scroll handler per mount | manual | **Fixed** — function form of `scroll()` driving `animation.time`; doc claim corrected |
| P3 (round 2) | First header observation transitioned instead of cutting (`surfaceReady` set in the same style change) | safe_auto | **Fixed** — `surfaceReady` set one frame later |
| P3 | `CATALOG_CARD_SIZES` exported from one section and imported by another (maintainability) | safe_auto | **Fixed** — moved beside `ProductCard` |
| P3 | Lookbook mosaic classes coupled to the data array by position (maintainability) | advisory | Left as is; both arrays are five entries and colocated in the slice |

## Requirements completeness (explicit plan)

R1–R14 and Units 1–10: all addressed in the diff. R8's "motion package meaningfully used" is now
satisfied by `Parallax` alone (`scroll` + `animate`), not by the React hooks the plan named — a
deliberate deviation for the R11 bundle budget, recorded in `apps/storefront/CLAUDE.md`.

## Residual actionable work

None routed to a downstream resolver. Items for the user (human-owned):

- Arabic copy under `home.*` in `messages/ar.json` awaits review.
- `home.benefits.*` wording is generic and marked unconfirmed until a real policy exists.
- Visual review on screenshots (1440/375 EN+AR, 320/768/1024 EN) per the standing rule; the
  parallax one-frame offset on a reload with restored scroll is unconfirmed in a browser.

## Advisory / residual risks

- A hero streamed behind Suspense in a future page would mount after `HeaderShell`'s effect; the
  header would stay `auto` (overlay) with no observer. Not applicable to any current page.
- `/en` ↔ `/ar` relies on Next remounting the `[locale]` layout subtree for a new segment value.
- Reduced-motion is read once per mount by both motion leaves (documented).
- Testing gaps (all documented as browser-review territory by the plan): `HeaderShell` lifecycle,
  `Reveal` observer flip, `Parallax` reduced-motion/no-attach, an R6 word audit, and a bundle-size
  guard for `motion/react` (a `no-restricted-imports` rule would make the contract mechanical).

## Verdict

Ready with fixes applied. Four CI-equivalent gates green after the fixes (typecheck, lint, test,
build; `/en` and `/ar` SSG).
