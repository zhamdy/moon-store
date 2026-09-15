/**
 * The one import of the lazy drawer chunk (CD-19): `next/dynamic` in the app router has no
 * `.preload()`, so triggers warm the chunk by calling this before the drawer is needed.
 */
export const loadDrawer = () => import('./bag-drawer');
