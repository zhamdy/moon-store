/**
 * Measures what a route actually costs to load, and fails when that grows past its budget.
 *
 * ## Why not just check chunk sizes
 *
 * A per-chunk size cap answers the wrong question. What a cashier waits for on `/pos` is
 * the entry chunk *plus every chunk statically reachable from it* — a 20 kB route chunk
 * that statically imports 400 kB of charting costs 420 kB, and a per-chunk cap would pass
 * it. So this walks the static import graph from each route's chunk and sums the closure.
 *
 * Static is the operative word. `import()` is a boundary the browser does not cross until
 * something asks it to, so a dynamically imported chunk is deliberately *not* counted —
 * that is the whole mechanism by which analytics or a scanner stays off the POS path, and
 * counting it would make lazy-loading look like a regression.
 *
 * ## Why gzip
 *
 * Bytes on the wire are what a till on shop wifi waits for. Raw size is what a bundler
 * reports and roughly triples the number, so budgets written against it drift away from
 * anything a user experiences.
 *
 * Usage:
 *   node scripts/bundleBudget.mjs            # check against budgets.json
 *   node scripts/bundleBudget.mjs --update   # rewrite budgets.json from this build
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const DIST = path.join(import.meta.dirname, '..', 'dist');
const ASSETS = path.join(DIST, 'assets');
const BUDGETS = path.join(import.meta.dirname, 'budgets.json');

/**
 * A chunk's *static* imports. Vite emits these as `from"./x.js"` / `import"./x.js"`;
 * a dynamic one appears inside `import("./x.js")` and in the `__vitePreload` dependency
 * array, and neither of those forms matches here — which is the point.
 */
function staticImports(source) {
  const found = new Set();
  // Two forms, and the whitespace matters: minified output is `}from"./x.js"` with no
  // space before `from`, so a pattern requiring one silently matches nothing and every
  // closure comes out too small. That is exactly how this was wrong first time round.
  const withFrom = /from\s*["']\.\/([A-Za-z0-9_.-]+\.js)["']/g;
  // A bare side-effect import. `import(` — a dynamic one — cannot match, because the
  // quote must follow directly, and NOT counting those is the entire point.
  const sideEffect = /(?:^|[;}\s])import\s*["']\.\/([A-Za-z0-9_.-]+\.js)["']/g;
  for (const re of [withFrom, sideEffect]) {
    let m;
    while ((m = re.exec(source))) found.add(m[1]);
  }
  return found;
}

const files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
const sources = new Map(files.map((f) => [f, readFileSync(path.join(ASSETS, f), 'utf8')]));
const gzipped = new Map(
  files.map((f) => [f, gzipSync(readFileSync(path.join(ASSETS, f))).length])
);
const graph = new Map([...sources].map(([f, s]) => [f, staticImports(s)]));

/** Everything the browser must have before this chunk can run. */
function closure(entries) {
  const seen = new Set();
  const stack = Array.isArray(entries) ? [...entries] : [entries];
  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file) || !graph.has(file)) continue;
    seen.add(file);
    for (const dep of graph.get(file)) stack.push(dep);
  }
  return seen;
}

const totalOf = (set) => [...set].reduce((n, f) => n + (gzipped.get(f) ?? 0), 0);

/**
 * Everything index.html itself pulls — the entry module plus every vendor chunk it lists
 * as a script or modulepreload. Seeding from the entry alone undercounts: `vendor-motion`
 * is referenced by the HTML but not statically imported by the entry, and the browser
 * fetches it on first load regardless of which of the two asked for it.
 */
const html = readFileSync(path.join(DIST, 'index.html'), 'utf8');
const entryFiles = [...html.matchAll(/assets\/([A-Za-z0-9_.-]+\.js)/g)]
  .map((m) => m[1])
  .filter((f) => graph.has(f));
if (entryFiles.length === 0) throw new Error('could not find any entry chunk in index.html');

/**
 * Routes are matched by chunk name rather than by reading the router: Vite names a route's
 * chunk after its module, and a rename that silently stopped matching would make a budget
 * pass by measuring nothing — so an unmatched route is a failure below, not a skip.
 */
const ROUTES = ['pos', 'inventory', 'analytics', 'sales'];

const measured = { initial: Math.round(totalOf(closure(entryFiles)) / 1024) };
const missing = [];
for (const route of ROUTES) {
  const chunk = files.find((f) => new RegExp(`^${route}-[A-Za-z0-9_-]+\\.js$`).test(f));
  if (!chunk) {
    missing.push(route);
    continue;
  }
  // The route's own closure minus what the entry already brought: the marginal cost of
  // navigating there, which is what a budget on a route should mean.
  const own = closure(chunk);
  const shared = closure(entryFiles);
  const marginal = [...own].filter((f) => !shared.has(f));
  measured[route] = Math.round(totalOf(new Set(marginal)) / 1024);
}

if (missing.length) {
  console.error(`\n✗ No chunk found for: ${missing.join(', ')}.`);
  console.error('  A renamed route would otherwise make this gate pass while measuring nothing.');
  process.exit(1);
}

/**
 * Heavy dependencies that must not be reachable *statically* from the initial load. These
 * are the ones the issue names: charting, spreadsheet export, and the barcode scanner —
 * none of which a cashier needs before the first sale.
 */
const HEAVY = {
  recharts: /recharts|vendor-charts/,
  xlsx: /exportUtils/,
  quagga: /barcode|quagga/,
};
const initialClosure = closure(entryFiles);
const leaked = Object.entries(HEAVY).filter(([, re]) => [...initialClosure].some((f) => re.test(f)));

/**
 * Budgets sit above the measurement, not on it. A budget equal to the current size fails
 * on rounding and on an unrelated dependency bump, and a gate that cries wolf earns a
 * `--update` reflex rather than a reading. The 5 KiB floor matters for the small route
 * numbers, where 5% is less than the difference between two builds of the same source.
 */
const headroom = (kb) => Math.max(Math.ceil(kb * 1.05), kb + 5);

if (process.argv.includes('--update')) {
  const withHeadroom = Object.fromEntries(
    Object.entries(measured).map(([k, v]) => [k, headroom(v)])
  );
  writeFileSync(BUDGETS, `${JSON.stringify({ gzipKb: withHeadroom }, null, 2)}\n`);
  console.log('Measured this build:');
  console.log(JSON.stringify(measured, null, 2));
  console.log('\nWrote budgets.json (measurement plus headroom):');
  console.log(JSON.stringify(withHeadroom, null, 2));
  process.exit(0);
}

const budgets = JSON.parse(readFileSync(BUDGETS, 'utf8')).gzipKb;
let failed = false;

console.log('\nRoute cost (gzipped KiB, static closure):\n');
for (const [name, actual] of Object.entries(measured)) {
  const budget = budgets[name];
  if (budget === undefined) {
    console.log(`  ${name.padEnd(12)} ${String(actual).padStart(5)}  (no budget set)`);
    continue;
  }
  const over = actual > budget;
  failed ||= over;
  const delta = actual - budget;
  console.log(
    `  ${name.padEnd(12)} ${String(actual).padStart(5)} / ${String(budget).padStart(5)}  ${
      over ? `✗ over by ${delta}` : `✓${delta < 0 ? ` (${delta})` : ''}`
    }`
  );
}

if (leaked.length) {
  failed = true;
  console.error(
    `\n✗ Reachable from the initial load without a dynamic import: ${leaked
      .map(([n]) => n)
      .join(', ')}.`
  );
  console.error('  These must stay behind a route split; a cashier should not wait for them.');
}

if (failed) {
  console.error('\nIf the growth is intended, re-run with --update and say why in the PR.\n');
  process.exit(1);
}
console.log('\nWithin budget.\n');
