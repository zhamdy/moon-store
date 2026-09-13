// The canonical import path for shared components. A feature reaches every component
// below through `../../shared` (or `@/shared`) and never through the directory the
// component happens to live in, so moving one between `overlays/` and `data-display/`
// is not a 30-file rewrite. `client/eslint.config.mjs` enforces this; the four
// compatibility shims that used to offer a second path (`components/PageHeader` and
// friends) were deleted in #56.
//
// ## What must not be re-exported here
//
// Nothing that statically pulls a heavy dependency. `lib/exportUtils` used to be on
// this list and imports `xlsx` (a 283 kB chunk), while its only four callers import
// `shared/lib/exportUtils` directly — so the re-export was reached by nobody and cost
// a `xlsx` edge from the barrel to every consumer of it.
//
// Measured honestly: removing it changed no chunk. Rollup already tree-shook the
// unused re-export, and `xlsx` was, before and after, statically imported by exactly
// the four route chunks whose pages export spreadsheets. So this is not a size fix,
// and anyone re-deriving it from the build output should expect to find nothing.
//
// It is removed because relying on tree-shaking to keep 283 kB out is a silent
// failure mode, not a guarantee: it holds only while nothing in that module graph
// acquires a side effect at module scope, and the day it stops holding, the barrel
// puts `xlsx` in front of every page that imports a button. A dependency that
// expensive should be reached deliberately, by the pages that actually want it,
// rather than be one `export *` away from everything.
//
// The rule is about static cost, not layering — a heavy module is still shared code
// and still lives under `shared/`. Before adding an entry here, check what it drags
// in behind it.

// Foundation & Providers
export * from './providers/DirectionProvider';
export * from './hooks/useDirection';
export * from './hooks/useDebouncedValue';
export * from './lib/idUtils';
export * from './components/forms';
export * from './components/data-display';
export * from './components/overlays';
export * from './components/data-table';
export * from './components/navigation';
export * from './types';
