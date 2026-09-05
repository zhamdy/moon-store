# Accessibility

Target: **WCAG 2.2 AA** on the workflows a shop actually runs — POS checkout, inventory
editing, data tables, navigation, dialogs and authentication.

## What is enforced automatically

| Gate | Where | What it catches |
| --- | --- | --- |
| `eslint-plugin-jsx-a11y` | `client/eslint.config.mjs`, runs in `npm run lint` | Static markup errors: missing alt text, invalid ARIA, labels not tied to controls. |
| axe (`@axe-core/playwright`) | `e2e/specs/a11y.spec.ts`, tagged `@smoke` so it runs on every PR | Computed violations on real rendered pages: names, contrast, ARIA relationships, nested interactive controls. |
| Keyboard and focus assertions | same file | Focus entering a dialog, staying in it, and returning to the trigger; adding to the cart without a pointer. |

The axe gate **blocks on `serious` and `critical` only**, which is the issue's
"newly introduced high-impact violations". `moderate` and `minor` findings are printed in
the test output but do not fail the build — the alternative was either a large unrelated
cleanup or an ignore list, and an ignore list is where a gate goes to die.

A linter cannot see computed colour, and axe cannot tell whether a focus order makes
sense. That is why both exist, and why the list below exists as well.

## Known gaps

Real, reproduced, and not yet fixed. Each has an issue — a gap recorded only in a
document is one nobody is going to pick up. `jsx-a11y` reports these as **warnings**
rather than errors so the count and the locations stay visible; raise the corresponding
rules to `error` as this list empties, which #105 is the last one blocking.

| Gap | Issue | Where | What it costs a user |
| --- | --- | --- | --- |
| Custom customer picker is pointer-only | **#103** (P2) | `features/fulfillment/components/delivery/DeliveryFormDialog.tsx` (trigger and options are `<div onClick>`) | A keyboard or screen-reader user cannot open the picker or choose a customer at all, so the delivery flow is blocked outright. The most serious item here — WCAG 2.1.1 and 4.1.2. |
| Controls nested inside pressable cards | **#104** (P3) | `features/inventory/pages/Collections.tsx`, `features/inventory/pages/Bundles.tsx` | The edit/delete buttons sit inside a card that is itself a `<button>`. Invalid HTML; the inner controls are not separately reachable and the card's accessible name absorbs their labels. Fixed on POS in #54 — the same restructure applies. |
| `role="status"` on a `<td>` | **#105** (P3) | `shared/components/data-table/DataTable.tsx`, `features/analytics/components/DashboardCharts.tsx` | Overrides the cell's table semantics to announce empty states. It works, but a live region should be a sibling of the table rather than a cell inside it. |

Neither `/collections`, `/bundles` nor the delivery dialog is currently an axe-scanned
surface, which is why the scan did not find these three itself — they came from
`jsx-a11y` and from reading. Adding those surfaces is part of #103 and #104.

## Decisions worth knowing

**Direction is derived from locale, and stored nowhere else.** `DirectionProvider` used to
hold its own `moon-store-direction` value in localStorage while `settingsStore.locale`
independently drove `useTranslation().isRtl` and wrote `<html lang>`/`<html dir>`. Two
persisted answers to one question, with nothing keeping them in agreement: when they
disagreed, part of a screen laid out LTR while the rest laid out RTL, and the document
could announce `lang="ar"` with `dir="ltr"`. To change direction now, change the locale.

**Autofocus is deliberate on a till.** `jsx-a11y/no-autofocus` is off. A cashier's first
act is to scan, and a register dialog exists to take one number. WCAG does not prohibit
autofocus; the rule is an opinion about general web pages.

**Reduced motion is honoured globally** (`client/src/app/index.css`), collapsing durations
to a single frame rather than removing animations — `animation: none` can strand an
element on its opening keyframe, invisible.

**Colour tokens are measured, not eyeballed.** `success` and `warning` are defined per
theme in `tailwind.config.js` with their contrast ratios in the comment. HeroUI's default
success (`#17C964`) measures **2.19:1** on a light surface and was in use in table cells.

## Manual scenarios

Things no automated check covers. Run these when changing checkout, dialogs, or the
navigation shell.

1. **Screen reader, full cash sale.** With VoiceOver or NVDA: search a product, add it,
   open checkout, confirm. Every step should be announced without looking — in particular
   the sale result and the receipt dialog opening.
2. **Keyboard-only, no mouse plugged in.** Sign in, ring up two items, apply a discount,
   check out, print. Focus must be visible at every step and never land somewhere invisible.
3. **Arabic RTL end to end.** Same flow with the locale set to Arabic. Reading order,
   arrow-key direction in tabs, and the drawer's opening edge should all mirror; numbers
   and currency should not.
4. **200% browser zoom and 320px width.** Nothing clipped, no horizontal scrolling of the
   page body, controls still reachable.
5. **Reduced motion enabled at the OS level.** Nothing should animate; nothing should be
   missing or stuck invisible as a result.
6. **Offline banner and queue states.** Pull the network: the state change should be
   announced, not only shown.

## Running the checks

```bash
npm run lint --prefix client                   # jsx-a11y, among the rest

# axe + keyboard/focus, against a real browser and a real server
cd e2e && E2E_DATABASE_URL=postgresql://.../moon_store_e2e npx playwright test specs/a11y.spec.ts
```
