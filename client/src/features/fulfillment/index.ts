// Public barrel for the "fulfillment" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/fulfillment/pages/..., etc.) is a
// boundaries lint violation.

export { default as Deliveries } from './pages/Deliveries';
export { default as OnlineOrders } from './pages/OnlineOrders';
export { default as Storefront } from './pages/Storefront';
