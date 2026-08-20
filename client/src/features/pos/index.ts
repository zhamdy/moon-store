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
export { default as BarcodeTools } from './pages/BarcodeTools';
export { default as StartupPrompt } from './components/StartupPrompt';
// Store hooks, not components; must live in the barrel for cross-slice
// consumers (app/session.ts logout teardown, features/auth's U3 test).
export { useCartStore } from './store/cartStore';
export { useHeldCartsStore } from './store/heldCartsStore';
