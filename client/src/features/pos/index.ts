// Public barrel for the "pos" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/pos/pages/..., etc.) is a
// boundaries lint violation.

export { default as POS } from './pages/POS';
export { default as Register } from './pages/Register';
export { default as Shifts } from './pages/Shifts';
export { default as CustomerDisplay } from './pages/CustomerDisplay';
// BarcodeTools is deliberately NOT re-exported here: App.tsx already reaches
// it via a deep dynamic import (`lazy(() => import('../features/pos/pages/
// BarcodeTools'))`), the same documented deep-import exception used for
// every other lazy route. Re-exporting it from this barrel made it
// statically reachable from App.tsx's *eager* `import { POS } from
// '../features/pos'`, which pulled BarcodeTools (and its jsbarcode
// dependency via BarcodeGenerator) into the eager entry chunk instead of
// keeping it exclusive to its own lazy chunk -- the root cause of the
// bundle regression this fix addresses.
export { default as StartupPrompt } from './components/StartupPrompt';
// Store hooks, not components; must live in the barrel for cross-slice
// consumers (app/session.ts logout teardown, features/auth's U3 test).
export { useCartStore } from './store/cartStore';
export { useHeldCartsStore } from './store/heldCartsStore';
