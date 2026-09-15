# Accessibility

Target: **WCAG 2.2 AA** on the workflows a shop actually runs — POS checkout, inventory
editing, data tables, navigation, dialogs and authentication.

## What is enforced automatically

| Gate | Where | What it catches |
| --- | --- | --- |
| `eslint-plugin-jsx-a11y` | `apps/dashboard/eslint.config.mjs`, runs in `npm run lint` | Static markup errors: missing alt text, invalid ARIA, labels not tied to controls. |
| axe (`@axe-core/playwright`) | `e2e/specs/a11y.spec.ts`, tagged `@smoke` so it runs on every PR | Computed violations on real rendered pages: names, contrast, ARIA relationships, nested interactive controls. |
| Keyboard and focus assertions | same file | Focus entering a dialog, staying in it, and returning to the trigger; adding to the cart without a pointer. |

The axe gate **blocks on `serious` and `critical` only**, which is the issue's
"newly introduced high-impact violations". `moderate` and `minor` findings are printed in
the test output but do not fail the build — the alternative was either a large unrelated
cleanup or an ignore list, and an ignore list is where a gate goes to die.

A linter cannot see computed colour, and axe cannot tell whether a focus order makes
sense. That is why both exist, and why the list below exists as well.

## Known gaps

**Storefront editorial strip has no stop mechanism (WCAG 2.2.2, open).** The homepage
marquee moves for more than five seconds. It pauses on hover and stops under reduced
motion, but its visible pause toggle was removed by owner decision (2026-09-14), so a
keyboard or touch user without the reduced-motion setting cannot stop it. Closing the gap
means restoring the CSS-only toggle described in `apps/storefront/CLAUDE.md` → *Motion* §5.

**Storefront bag has no automated keyboard, focus or announcement check (open).** The
storefront has no DOM or browser harness and is not axe-scanned by `e2e/`. The bag's rules
(stepper limits, focus target after Remove, announcement text and once-per-quote policy)
are pure functions with unit tests, but the drawer's focus trap and return, the live
regions actually speaking, and the Remove focus hand-off are proven only by manual
scenario 8 below.

**#111 — HeroUI buttons wired with `onClick` were pointer-only.** Fixed, and recorded here
because the way it hid is the useful part. HeroUI's `Button` is react-aria based: it
intercepts key events and dispatches `onPress`, suppressing the native click, so a handler
on `onClick` fires for a mouse and never for a keyboard. 209 buttons across 59 files were
in that state — roughly two thirds of the app's actions — while every gate was green.

Nothing here could have caught it. axe sees a `<button>` with a correct role and name.
`jsx-a11y` sees a real button, so `click-events-have-key-events` does not apply — that rule
exists for `<div onClick>`. The unit tests drove dialogs directly rather than opening them.
It took the keyboard-only delivery spec added for #103, and that spec only ran after the
change had merged, at which point it turned `main` red.

The lesson is not "add a rule" — the rule exists now
(`no-restricted-syntax` in `apps/dashboard/eslint.config.mjs`, with
`heroUiButtonKeyboard.test.tsx` pinning the behaviour so the rule cannot become
superstition after a HeroUI upgrade). It is that **a component library can take a
keyboard away from valid markup**, and no static check will tell you. Only driving the
interface the way a person does will.

#103 (pointer-only customer picker), #104 (controls nested inside pressable cards) and
#105 (`role="status"` on a `<td>`) are the earlier three, all fixed.

**#113 — does a combobox keep its accessible name while its listbox is open?** Closed, and
the answer was no, but not for the reason the question assumed.

Measured in Chromium against the same HeroUI versions this app ships, with the listbox
open:

| | closed | open |
| --- | --- | --- |
| combobox named by `aria-label` | `combobox "Select Customer"` | name intact, but `ignored: true`, `ariaHiddenSubtree` |
| its ancestor | — | `aria-hidden="true"` on the wrapper the modal is portaled into |
| `getByRole('combobox', { name })` | 1 match | **0 matches** |

The name never went anywhere: it is an attribute, and no amount of hiding empties it. The
*element* did. **HeroUI's `usePopover` calls `ariaHideOutside([popover])` unconditionally**
whenever a popover opens — it never consults `isNonModal`, which defaults to `true` in that
same hook, and which react-aria's own equivalent guards on. Everything not containing the
popover is hidden, and from inside a modal that is the dialog, every field in it, and the
combobox that owns the open listbox. A screen-reader user choosing from that list is
choosing from a control that is not in the tree.

`useExposedWhileListboxOpen` in the delivery slice drops that `aria-hidden` from the field's
ancestors while the listbox is open, and leaves react-aria's own hiding
(`ariaHideOutside([input, popover])`, which correctly hides the *siblings*) alone. The
signal it works is the E2E spec: it locates the picker by role and name throughout, with no
`data-testid` indirection.

Two things measured on the way that did **not** match what #111 recorded, and are worth not
rediscovering. HeroUI's `label` prop does emit an `aria-labelledby` pointing at an id that
does not exist — but Chromium skips a wholly dangling reference and falls back to
`aria-label`, so the name computed correctly all along. On `Input` the same prop names the
field *twice* (`"Customer Name Customer Name"`), because its reference list includes both
the label and the input itself. Neither is a missing name; both are still markup worth
keeping out.

The rule the four CI runs bought stands on its own: **once a popover is open, locate by
name from the page rather than chaining through the dialog** — the popover contributes a
second `dialog` of its own, so `getByRole('dialog')` is ambiguous there even now that the
modal is back in the tree.

Record the next gap here **with an issue** rather than only in a comment or a commit
message, and drop the rule that catches it back to `warn` only if the fix genuinely cannot
land with it.

The delivery dialog, `/collections` and `/bundles` are all axe-scanned surfaces now, and
`e2e/specs/a11y.spec.ts` also creates a delivery order keyboard-only — the half axe cannot
score, and the half that found #111.

### What is still not proven

The empty-state fix is the case where a DOM assertion is weakest evidence: a live region
with the right attributes and the right text can still fail to speak, and neither axe nor
`toHaveTextContent` can tell you. The unit tests pin the structure — one region, mounted
before the transition, updated rather than remounted — and a spoken check with a real
screen reader remains a manual step, in the same category as the other entries below.

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

**Reduced motion is honoured globally** (`apps/dashboard/src/app/index.css`), collapsing durations
to a single frame rather than removing animations — `animation: none` can strand an
element on its opening keyframe, invisible.

**Storefront sold-out sizes stay selectable.** On the product page each option is a
`<fieldset>` of native radios (`features/products/components/purchase-panel.tsx`), and a
sold-out or unavailable value is never `disabled`: disabled radios are skipped by arrow keys
and hidden by many screen readers, so a shopper could not find out that M is sold out. The
value is struck through in `text-disabled` and its label carries visually hidden
"{value}, sold out" text, so the state is never colour alone. Price and availability share
one polite live region rendered with the first paint, because a region mounted alongside its
message announces nothing.

**The storefront gallery is a vertical tablist of thumbnails.** With two or more images the
thumbnails are a WAI-ARIA tablist (`aria-orientation="vertical"`, labelled) with a roving
tabindex and automatic activation: Up/Down move, Left/Right move in reading direction
(mirrored in RTL), Home/End jump, and movement wraps. The large image frame is the one
`tabpanel`, labelled by the active tab and itself a tab stop (it holds no focusable content),
with an inset focus ring. Zoom in place is pointer-only by design (a fine hovering pointer at
1024 and above); keyboard and touch users rely on browser zoom. One image: no tablist.

**The storefront product details are horizontal tabs.** Description / Details / Shipping &
returns are WAI-ARIA tabs with Left/Right (mirrored in RTL) and Home/End, wrapping; inactive
panels are `hidden`, and a panel with no focusable content is itself a tab stop. The tab bar
is sticky under the site header, so focus must never land beneath either.

**Storefront checkout validation is announced by focus, not by toasts.** Errors are inline
(icon, text and border) and linked with `aria-describedby`; none is a live region. Continue on
an invalid form moves focus to the first invalid field in DOM order, so the screen reader reads
its label, "invalid" and the error once. A field that already has focus is blurred and focused
again on the next frame, because `focus()` on the focused element fires nothing. The storefront
elsewhere pairs field errors with a toast; checkout deliberately does not (owner decision
2026-09-15), to avoid two announcements at once.

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
7. **Storefront product page, keyboard and screen reader.** The storefront is not
   axe-scanned by `e2e/`, so this is the only check it gets. On a product with mixed stock
   (`cashmere-pullover` in a seeded catalog), in EN and AR: Tab enters each size fieldset
   once, arrow keys move and select, and the focus ring is visible and never under the
   sticky header. VoiceOver/NVDA announce something like "M, sold out, 2 of 3, selected",
   and the price/status change is spoken. Gallery: Tab reaches the selected thumbnail once;
   Up/Down, reading-direction Left/Right (mirrored in AR), Home/End move and wrap, and each
   change is announced as the selected tab. Tab again reaches the image panel, its ring is
   visible inside the frame, and its alt text is read. Details tabs: Tab reaches the active
   tab once; Left/Right (mirrored in AR) and Home/End switch, and Tab moves into the panel.
   Focus is never hidden under the sticky header or the stuck details tab bar. At 320px
   there is no horizontal page scroll: a long category in the breadcrumb truncates, and the
   thumbnail column and the tab bar stay inside the page (the bar scrolls sideways itself).
8. **Storefront bag, keyboard and screen reader.** Also not axe-scanned. In EN and AR,
   with `silk-midi-dress` (sizes), `cashmere-pullover` (mixed stock) and `silk-slip-dress`
   (sold out). **Add to Bag:** with no size chosen, the button is enabled; pressing it
   moves focus to the size group's first radio, "Choose a size" appears under the legend and
   is spoken once (from the error toast, not from the inline text); choosing a size removes
   the toast. With a size chosen, pressing it keeps focus on the button, the drawer does
   **not** open, and "Added to your bag: {name}" is spoken from a toast in the bottom inline
   corner. **First toast after load:** Sonner is lazy-loaded, so with the cache cleared,
   reload and press Add to Bag as soon as the page renders: the toast still appears and is
   spoken once (the queue waits for the "Notifications" region to exist first). Alt+T does
   nothing until the toaster has loaded, normally moments after the page settles. On a sold-out product the
   button reads "Sold out", is announced as dimmed/unavailable, stays in the Tab order and
   does nothing, and no quantity stepper is present. Pressing it an eleventh time for one
   line raises "You can add up to 10 of this piece". **Toasts:** each is spoken once through
   the "Notifications (Alt+T)" region and never takes focus; Alt+T moves focus into the
   toasts, Tab reaches the action (View bag, Undo, Try again) and Dismiss, each a 44px target,
   and focus returns to where it was when the toasts close. Success and info toasts stay
   about 4s, errors about 7s, and hovering or focusing one pauses it. A second Add to Bag
   replaces the toast rather than stacking one. **Product page
   stepper:** Tab reaches Decrease, then Increase, then Add to Bag. The group is named
   "Quantity, {name}"; Decrease is unavailable at 1; at 10 Increase is unavailable and
   carries the up-to-10 description. With 3 chosen, Add to Bag's toast reads "Added to your
   bag: {name} (3)"; with 8 already in the bag and 5 chosen, it reads "You can add
   up to 10 of this piece". After either, the value is back at 1. With no size chosen the
   stepper still works and Add to Bag still moves focus to the size group. **Drawer:** opens
   only from the header Bag link. Tab stays inside it; Escape and a backdrop
   click close it and focus returns to the header Bag link; following a line
   name or View bag closes it and focus lands on the page's main region, never on a stale
   trigger. The header link is announced as "Bag, 3 items" (plain "Bag" when empty), with a
   popup hint off `/bag` and as the current page on `/bag`; its count is never announced on
   its own. **Stepper:** each is a group named "Quantity, {name}"; the buttons are named
   "Decrease/Increase quantity, {name}", stay focusable when unavailable, and at the limit
   + carries the description "Only {count} available" (stock) or the up-to-10 notice.
   Decrease is unavailable at 1. Sold-out and unavailable lines have both unavailable and
   Remove available. **Remove:** after the row fades, focus is on the next line's name (else
   the previous one, else the "Your bag is empty" heading), never on `body`, and "{name}
   removed from your bag" is spoken from a toast with Undo. On `/bag`, Alt+T then Tab reaches
   Undo, and pressing it puts the line back in its place with its quantity. **In the open
   drawer:** Remove a line with Enter; focus lands on the next line's name. Press Alt+T
   within 4s: focus leaves the drawer for the toast (the toast stops its timer). Tab once:
   the "Undo" action (Tab again: Dismiss). Press Enter: the line is back in place with its
   quantity, the toast closes, and focus returns to the line name that held it before Alt+T,
   still inside the drawer; Tab and Shift+Tab stay in the drawer again. While the drawer
   is open, Shift+Tab from a toast and a screen reader's browse mode must not reach the skip
   link, the page content or the footer (the drawer makes them inert). Undo by pointer
   works too. Try two removals in quick succession: two toasts. **Navigation close:** open
   the drawer from the header Bag link, Tab to a line name (or View bag) and press Enter:
   the drawer slides out and, once it has gone (~300ms), focus is on the page's main region
   (the next Tab reaches the first link of the new page), not on the header Bag link. Open it
   again and press Escape (then the X, then Continue shopping): each time focus returns to
   the header Bag link.
   **Toasts**, each spoken once, never repeated on reopening, never two for one event with the
   drawer open over `/bag`:

   | Action | Expected |
   | --- | --- |
   | Change a quantity (several quick presses) | One "{name}, quantity {n}. Subtotal {subtotal}" toast after the update, replacing any earlier one for that line |
   | Open a bag whose quote has a sold-out, limited or re-priced line | An info toast "Your bag was updated" plus the counts |
   | Stop the API, open the bag | An error toast "We couldn't update your bag" once; Try again reachable in the toast (Alt+T) and in the bag |
   | Share on a desktop without Web Share | "Link copied" toast; with the clipboard blocked, "Couldn't copy the link" |
   | Filter sheet: min above max, leave the field | The price error spoken once from a toast; the garnet text stays under the inputs |

   **`/bag`:** Tab order runs lines then the summary; the subtotal reads "Updating" while a
   change is pending; the page never announces or shows "Your bag is empty" for a non-empty
   bag while loading. At 320px and 200% zoom, no horizontal page scroll in the drawer or
   the page, and the stepper and Remove stay 44px targets; in Arabic the toast sits bottom
   left (bottom right in EN) and spans the width at 320. **Reduced motion:** the drawer
   appears without sliding, a removed row disappears without fading, toasts appear and leave
   without sliding or scaling, and focus still moves.
9. **Storefront checkout, keyboard and screen reader.** Also not axe-scanned. Needs a build or
   dev server with Checkout enabled. In EN and AR, with `silk-midi-dress` in the bag. **Entry:**
   on `/bag`, Tab reaches Checkout after the summary figures; with a sold-out line
   (`silk-slip-dress`) it is announced as dimmed/unavailable with its reason ("Remove 1
   unavailable piece to continue") and does nothing. Focus the Checkout link, switch tabs and
   come back: focus is still on it. **Form:** Tab order is Back to bag, the summary toggle
   (below 1024; from 1024, Edit bag), then Full name, Mobile number, Email, Governorate, City or
   area, Street, Floor and apartment, Landmark, Continue. Each field is read with its label,
   "required" (or the visible "Optional"), and the Street hint. Tab through an empty required
   field: its error appears after leaving it and is read when you return. Press Continue on an
   empty form: focus moves to Full name and "This is required" is read once, with no toast. Press
   Enter inside that empty Full name again: it is read again. Fix a field: its error disappears
   as you type. Phone accepts `٠١٠٠١١١٢٢٣٣` and `+20 100 111 2233`; `123` gives "Enter a phone
   number of 8 to 15 digits". No field or error ever sits under the sticky header. **Summary:**
   below 1024 the toggle is announced as "Summary, 1 piece, 2,850 EGP, collapsed/expanded";
   from 1024 a long bag's line list is a labelled region you can Tab into and scroll. It says
   "Delivery: Confirmed later" and has no Total. **Bag changes:** with the form half filled,
   set the variant's stock to 0 in the dashboard and return to the tab: "Your bag was updated"
   is spoken once from a toast, and the notice above the form names the piece. Press Continue:
   focus moves to that notice's heading, and Return to bag is the next Tab. **Outcome
   (preview):** with a valid form and ready bag, Continue reads "Checking your bag" and then shows
   "Online ordering isn't open yet…" with Back to bag and Continue shopping, plus one toast;
   nothing navigates. **Draft:** refresh, and the typed details are back without being announced.
   At 320px and 200% zoom there is no horizontal page scroll, long Arabic errors wrap, and every
   input is 48px tall. Reduced motion: the heading does not rise and the chevron does not turn.

## Running the checks

```bash
npm run lint --prefix apps/dashboard                   # jsx-a11y, among the rest

# axe + keyboard/focus, against a real browser and a real server
cd e2e && E2E_DATABASE_URL=postgresql://.../moon_store_e2e npx playwright test specs/a11y.spec.ts
```
