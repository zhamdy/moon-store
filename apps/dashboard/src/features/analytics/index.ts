// Public barrel for the "analytics" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/analytics/pages/..., etc.) is a
// boundaries lint violation.

export { default as Dashboard } from './pages/Dashboard';
export { default as Exports } from './pages/Exports';
export { default as ReportBuilder } from './pages/ReportBuilder';
export { default as AiInsights } from './pages/AiInsights';
export { default as AdvancedAnalytics } from './pages/AdvancedAnalytics';
