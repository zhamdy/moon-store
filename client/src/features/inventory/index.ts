// Public barrel for the "inventory" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/inventory/pages/..., etc.) is a
// boundaries lint violation.
//
// Collections is unrouted and intentionally not exported here.

export { default as Inventory } from './pages/Inventory';
export { default as Categories } from './pages/Categories';
export { default as StockCount } from './pages/StockCount';
export { default as Bundles } from './pages/Bundles';
export { default as SmartPricing } from './pages/SmartPricing';
export { default as BarcodeGenerator } from './components/BarcodeGenerator';
