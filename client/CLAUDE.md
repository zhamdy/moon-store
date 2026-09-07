# Client (`client/`)

Subsystem contracts for the React SPA. These load when you work under `client/`; the
always-loaded root `CLAUDE.md` holds the project-wide rules, including the `features/`
placement checklist.

## Offline queue

The queue in `localStorage` is replayed by `client/src/shared/hooks/useOffline.ts`. A failed
replay backs off, and a rejection the server will repeat parks for a cashier rather than
retrying forever — see the **Offline queue replay contract** in `docs/CONVENTIONS.md`
before changing the hook or its store.

`queryClient` sets **`networkMode: 'always'` on mutations**, and that one line is what
makes the queue reachable at all. React Query's default (`'online'`) *pauses* a mutation
fired while `navigator.onLine` is false rather than executing it: no request goes out, so
nothing rejects, so `onFailure` never runs — and the checkout's offline fallback, the only
writer to `moon-offline-queue`, lives inside `onFailure`. Until #53 the persisted queue
therefore never received a single sale. Do not remove it without replacing the path into
the queue.

**A sale is queued whenever the server gave no verdict, not when the browser admits to
being offline.** The condition is `failure.kind === 'offline' || 'network'` — the two
kinds `classifyMutationError` assigns when no response arrived at all. `navigator.onLine`
reports a link, not a reachable API: on shop wifi a captive portal or a dead server leaves
it true while nothing gets through, and keying on it meant those sales were silently
dropped onto the generic retry path while identical failures with the flag false were
queued and replayed.

Every queued entry carries the same `Idempotency-Key` the failed request used, so a replay
of a request that *did* land collapses onto the original sale instead of charging twice.

## PWA install and update policy

`client/config/pwa.ts`. Two decisions there are load-bearing:

**`registerType: 'prompt'`, never `autoUpdate`.** Under `autoUpdate` a new service worker
calls `skipWaiting`, claims the page and reloads it — with a half-rung-up cart on screen if
that is what is there, because nothing in a service worker knows what a checkout is. Under
`prompt` the new worker sits in `waiting` until every tab for the origin closes, so an
update lands between shifts. The cost is that a till left running for days keeps the old
build; for a point of sale that is the right side of the trade. Nothing calls `updateSW()`
— an "update now" affordance is fine to add, but it has to know whether a checkout is open.

**Cache what the shop knows, never what a person did.** Only `/api/v1/products` is
runtime-cached. `/api/v1/sales` used to be, with NetworkFirst: a till is shared, Cache
Storage is per-origin rather than per-user and is not cleared on logout, so that left one
cashier's transaction history readable by the next and served it back for an hour with no
way to tell it from a live response. Sales, refunds, shifts, customers and audit responses
all fail that test.

Install icons live in `client/public/pwa-{192x192,512x512}.png`, generated from
`pwa-icon.svg` beside them — the manifest referenced both for a long time while neither
existed, which is a failed install with no error anywhere.

## Forms on HeroUI inputs

**HeroUI's `Input` and `Textarea` hold their own controlled value**, so react-hook-form's
imperative `setValue` is overwritten on the very next render. A field that a user types
into works — `onChange` reaches HeroUI's internal state — while a field the code fills
silently stays empty.

That is not theoretical: the delivery dialog's customer picker had populated
`customer_name`, `phone` and `address` through `setValue` since it was written, and none of
it ever reached the DOM (#103). Any field written programmatically must be bound with
`Controller` and `value` / `onValueChange`, not `{...register()}`.

`{...register()}` remains correct for fields only ever typed into, which is most of them.

## Accessibility

`docs/ACCESSIBILITY.md` is the record: what is scanned, what is asserted by hand, and what
no automated check can prove. Read it before adding a surface or relaxing a rule.

Three `jsx-a11y` rules are **`error`**, not `warn` — `click-events-have-key-events`,
`no-static-element-interactions`, `no-interactive-element-to-noninteractive-role`. They
were held at `warn` while the *Known gaps* list in that document had entries, so the count
and the locations stayed visible; #103, #104 and #105 emptied it. If a fix genuinely
cannot land with a rule at `error`, record the gap in that document **with an issue** and
drop the rule back deliberately. A file-level disable hides the location and outlives the
excuse.

Two patterns to reach for, both already in the tree:

- **A control that sits on a card is a sibling of it, never a child.** `<Card isPressable>`
  renders a `<button>`; anything interactive inside it is a nested control — invalid HTML,
  axe's `nested-interactive`, and a card whose accessible name swallows the inner label.
  The POS product grid, Collections and Bundles all use a `relative` wrapper with the
  controls positioned over the card. Name them per row (`"<name>: Edit"`): a bare "Edit"
  repeats on every card and identifies none of them.
- **A live region must be mounted before the thing it announces happens.** A region
  rendered alongside its own message has no content *change* to announce. `DataTable` keeps
  one persistent `sr-only` region for loading, result count and empty state together —
  one table, one announcement source. `EmptyState` takes `announce={false}` for callers
  that already own one.
