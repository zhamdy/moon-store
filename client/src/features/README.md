# `features/`

Nine domain slices: `auth`, `pos`, `inventory`, `sales`, `customers`, `purchasing`, `fulfillment`,
`analytics`, `admin`. Each slice owns all of its own artifacts, whatever kind they are — pages,
components, hooks, store, types.

For the full three-layer model (`app/` / `features/` / `shared/`), dependency rules, the barrel
contract (R6/R7), the R5 placement checklist, and slice split/merge criteria, see
[`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md) and
[`docs/CONVENTIONS.md`](../../../docs/CONVENTIONS.md) at the repo root.

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
  index.ts      # the slice's public barrel — curated exports only, see docs/CONVENTIONS.md
```

Create only the folders a slice actually populates — an empty `pages/` or `hooks/` directory is not
committed. `index.ts` always exists, even before anything else does.
