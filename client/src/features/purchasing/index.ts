// Public barrel for the "purchasing" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/purchasing/pages/..., etc.) is a
// boundaries lint violation.

export { default as Distributors } from './pages/Distributors';
export { default as Expenses } from './pages/Expenses';
export { default as PurchaseOrders } from './pages/PurchaseOrders';
export { default as Vendors } from './pages/Vendors';
