// Public barrel for the "sales" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/sales/pages/..., etc.) is a
// boundaries lint violation.

export { default as SalesHistory } from './pages/SalesHistory';
export { default as Promotions } from './pages/Promotions';
export { default as GiftCards } from './pages/GiftCards';
export { default as Layaway } from './pages/Layaway';
