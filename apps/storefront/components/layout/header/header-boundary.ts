/**
 * The DOM attribute a page's hero carries to tell the header "this page opens on a
 * hero: be transparent at the very top". Two consumers read this constant:
 * `header-shell.tsx` (checks for it) and the pages that open on a full-bleed
 * photograph (the homepage's `film-hero.tsx`, the collections index) set it. A page with no element carrying it gets a solid header, so no
 * route matching is involved and future pages need nothing.
 *
 * The one place the string is repeated by hand is the `body:has([data-header-
 * boundary])` rule in app/globals.css, which makes the server HTML overlay before
 * any JS runs — rename all three together.
 */
export const HEADER_BOUNDARY_ATTR = 'data-header-boundary';
