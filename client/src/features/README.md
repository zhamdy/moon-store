# `features/`

Nine domain slices: `auth`, `pos`, `inventory`, `sales`, `customers`, `purchasing`, `fulfillment`,
`analytics`, `admin`. This directory replaces the old technical-kind-at-root layout
(`pages/`, `components/`, `hooks/`, `store/`, `types/`) with domain-first ownership: each slice owns
all of its own artifacts, whatever kind they are.

## Intra-slice shape

Every slice may contain:

```
features/<slice>/
  pages/        # route-level components
  components/   # slice-local components (sub-group under components/<group>/ once a slice has
                #   >=8 component files, e.g. features/analytics/components/charts/)
  hooks/
  store/
  types.ts
  index.ts      # the slice's public barrel (see below)
```

Create only the folders a slice actually populates — an empty `pages/` or `hooks/` directory is not
committed. `index.ts` always exists, even before anything else does.

## Public barrel contract (R6 / R7)

- `index.ts` is the slice's **curated public surface**. Export only what other slices or `app/`
  legitimately need — not everything the slice contains.
- **Cross-slice imports go through the barrel only.** Importing a path inside another slice's
  internals (e.g. `features/pos/components/CartPanel` from `features/inventory/...`) is a boundary
  violation and is rejected by lint once enforcement is turned on.
- A slice may freely import its own internals directly; the barrel restriction applies only to
  *other* slices and to `app/`.

## Placement checklist (R5)

When deciding where a new or moved file belongs:

1. Is it used by two or more slices? -> `shared/`.
2. Is it the app shell or the composition root? -> `app/`.
3. Otherwise -> the one slice that uses it, in the folder matching its kind.
4. Does another slice need it? -> export it from that slice's `index.ts`. Never import deeper.
5. Colocate the test beside the unit.

See `docs/CONVENTIONS.md` and `docs/ARCHITECTURE.md` for the full three-layer model
(`app/` / `features/` / `shared/`) and dependency rules.
