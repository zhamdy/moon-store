// Public barrel for the "auth" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/auth/pages/..., etc.) is a
// boundaries lint violation.

// Note: react-refresh/only-export-components would normally flag a
// non-component export sharing a file with components; it does not fire
// here because this barrel only re-exports (no local component defined),
// but useAuthStore is a store hook, not a component, by design.
export { useAuthStore } from './store/authStore';
export { default as ProtectedRoute } from './components/ProtectedRoute';
export { default as Login } from './pages/Login';
