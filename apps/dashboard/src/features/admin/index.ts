// Public barrel for the "admin" feature slice.
//
// R6: this file is the slice's curated public surface — export only what other
// slices or app/ legitimately need, not everything the slice contains.
// R7: cross-slice imports must go through this barrel only; importing a path
// inside another slice's internals (features/admin/pages/..., etc.) is a
// boundaries lint violation.

export { default as Users } from './pages/Users';
export { default as Settings } from './pages/Settings';
export { default as AuditLog } from './pages/AuditLog';
export { default as Backup } from './pages/Backup';
export { default as Branches } from './pages/Branches';
