// Public barrel for the "customers" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/customers/pages/..., etc.) is a
// boundaries lint violation.
//
// Warranty is unrouted and intentionally not exported here.

export { default as Customers } from './pages/Customers';
export { default as Feedback } from './pages/Feedback';
export { default as Segments } from './pages/Segments';
