// Public barrel for the "inventory" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/inventory/pages/..., etc.) is a
// boundaries lint violation.

export { default as Inventory } from './pages/Inventory';
export { default as Categories } from './pages/Categories';
export { default as Collections } from './pages/Collections';
export { default as StockCount } from './pages/StockCount';
export { default as Bundles } from './pages/Bundles';
export { default as SmartPricing } from './pages/SmartPricing';
// BarcodeGenerator is deliberately NOT re-exported here: the only consumer
// (features/pos/pages/BarcodeTools.tsx) imports it via a documented deep
// import instead of the barrel. Keeping this export line, even unused by
// any other slice, was enough for Rollup to pull BarcodeGenerator (and its
// jsbarcode dependency) into the eager entry chunk -- because App.tsx's
// eager `import { Inventory } from '../features/inventory'` makes this
// entire barrel module part of the eager module graph, and an unused named
// re-export was still deemed reachable rather than tree-shaken. See
// BarcodeTools.tsx's import for the other half of this fix.
