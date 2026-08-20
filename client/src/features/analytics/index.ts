// Public barrel for the "analytics" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/analytics/pages/..., etc.) is a
// boundaries lint violation.
//
// Empty on purpose: no files have moved into this slice yet.
