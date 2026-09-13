# Frontend performance budgets

The thing being protected is a cashier on shop wifi. Everything below is measured against
that, not against a developer's laptop.

## Reproducing the baseline

```bash
npm run build --prefix apps/dashboard
npm run budget --prefix apps/dashboard            # check against scripts/budgets.json
npm run budget --prefix apps/dashboard -- --update  # rewrite budgets from this build
```

`apps/dashboard/scripts/bundleBudget.mjs` runs in CI as its own step of the client job.

## What is measured, and why it is not chunk sizes

A per-chunk size cap answers the wrong question. What a till waits for on `/pos` is the
entry **plus every chunk statically reachable from it** — a 20 kB route chunk that
statically imports 400 kB of charting costs 420 kB, and a per-chunk cap passes it happily.
So the script walks the static import graph and sums the closure, **gzipped**, because
bytes on the wire are what the user waits for and raw size roughly triples the number.

Dynamic imports are deliberately excluded. `import()` is a boundary the browser does not
cross until something asks it to; counting those chunks would make lazy-loading register
as a regression, which is exactly backwards.

Three mistakes are baked into the script's comments because all three produced confidently
wrong numbers on the way here:

- The import regex must not require whitespace before `from`. Minified output is
  `}from"./x.js"`, and a pattern expecting a space silently matches nothing, so every
  closure comes out too small and the gate measures air.
- The initial closure must be seeded from **every** script `index.html` references, not
  just the entry module. `vendor-motion` is referenced by the HTML but not statically
  imported by the entry; seeding from the entry alone under-reported the initial load as
  150 KiB when it is 394 KiB.
- From #98 until 2026-09-13 the `from` pattern began with an invisible backspace byte
  (`\x08`, most likely a `\b` that went through a string escape). It matched nothing, so
  each route counted only its own chunk plus bare side-effect imports — the air the first
  bullet warns about, arrived at a different way — and the 2026-09-05 baseline (`/pos` 15,
  `/inventory` 11, `/analytics` 4, `/sales` 9) was measured by it. The initial figure was
  unaffected, because it is seeded from `index.html` rather than walked. The script now
  fails when no chunk yields a single `from"./x.js"` import.

## Baseline (2026-09-13)

Gzipped KiB. Route figures are **marginal** — what navigating there costs on top of what
the initial load already fetched.

| Surface | Measured | Budget |
| --- | --- | --- |
| initial load | 402 | 414 |
| `/pos` | 37 | 42 |
| `/inventory` | 32 | 37 |
| `/analytics` | 127 | 134 |
| `/sales` | 30 | 35 |

Budgets are the measurement plus 5%, floored at +5 KiB. A budget set exactly at the
current size fails on rounding and on an unrelated dependency bump, and a gate that cries
wolf earns an `--update` reflex rather than a reading. The initial budget was left at 414
rather than re-derived: nothing about it was mismeasured, and re-deriving would only loosen it.

`/inventory` and `/sales` were 125 and 123 until #184: each statically loaded
`exportUtils` (`xlsx`), about 93 KiB of spreadsheet export nobody needs until they press
Export. Every export now goes through `shared/hooks/useSpreadsheetExport`, which fetches the
chunk with a dynamic `import()` on the press, shows the button's loading state while it
downloads, and turns a failed load (offline, or a stale deploy) into an error toast. The
Dashboard (`/`, not a budgeted route) got the same treatment. Do not import
`shared/lib/exportUtils` directly: the `HEAVY` check below only guards the initial load, so a
static import from a route would pass it and show up only as a route budget failure.

**What is left worth attacking.** `/analytics` is mostly `vendor-charts`, which that page
genuinely renders. The initial cost is still the vendor set (`vendor-ui-hero`,
`vendor-router`, `vendor-query`, `vendor-motion`, `vendor-forms`) that `index.html` loads
up front.

## Heavy capabilities are off the initial path

The script fails if charting (`recharts`), spreadsheet export (`xlsx`) or the barcode
scanner (`quagga`) becomes reachable from the initial load without a dynamic import.
Verified: none of them is today. The check itself was verified by pointing it at a chunk
that *is* on the initial path and confirming it fails — a gate that cannot fail proves
nothing.

## Virtualization: measured, and not justified

The issue asks for virtualization "only where measurements justify it". They do not.

- **POS product grid** renders **25** cards, from `useProductCatalog`'s default page size,
  behind an explicit "Load more" button.
- **DataTable** paginates at **10** rows.

Virtualization exists to stop thousands of DOM nodes being rendered. Neither surface
renders an unbounded list, so it would add complexity — and a known conflict with the row
and grid semantics established in #54 — to solve a problem that is not there.

Revisit if either bound changes: a page size raised into the hundreds, or an infinite
scroll replacing the explicit "Load more", would make this measurement stale. That is the
trigger to re-run the numbers, not a calendar date.

## Interaction latency

Not yet gated, and deliberately so. POS search, add-to-cart, quantity change and checkout
opening are all local state updates over data already in memory; the honest place to
measure them is a real browser, and a CI runner's timing variance is wider than the
differences worth catching. A latency gate built on that would flake, and a flaky gate
gets skipped.

What exists instead: `e2e/specs/a11y.spec.ts` drives all four interactions in a real
browser, so a change that made one of them hang fails the suite on the timeout. Closing
the gap properly means a stable measurement environment, which is a bigger piece of work
than this one.
