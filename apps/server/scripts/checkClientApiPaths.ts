/**
 * Fails when the dashboard calls an API path the server does not serve (#162).
 *
 * Two lists meet here and neither is hand-maintained: the calls are parsed out of
 * `apps/dashboard/src` (see `gates/clientApiPaths.ts` for the three shapes it reads), and
 * the served set is walked out of `createApp()`. A page wired to a route that was renamed,
 * narrowed or never existed fails here instead of 404ing in a shop.
 *
 * Two kinds of call are not plain pass/fail, and both are printed on every run:
 *
 * - **Postponed features.** A call into a feature hidden by
 *   `apps/dashboard/src/shared/lib/postponedFeatures.ts` is reported, not failed. The list
 *   is read from that file, never copied, so reactivating a feature makes its calls count.
 * - **Dynamic paths.** A call whose path or method is not a literal cannot be matched
 *   statically. It fails unless `RESOLUTIONS` names the concrete calls it makes; a
 *   resolution that no longer matches a call site fails too, so the list cannot rot.
 *
 * Usage: tsx scripts/checkClientApiPaths.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { liveServedRoutes } from './gates/servedRoutes';
import {
  extractClientCalls,
  findClientPathDrift,
  hasFailures,
  readPostponedPaths,
  type Resolution,
  type SourceFile,
} from './gates/clientApiPaths';

const dashboardSrc = resolve(__dirname, '..', '..', 'dashboard', 'src');

/**
 * The transport and the hooks that wrap it: they forward a caller's path rather than
 * naming one, and their callers are what this gate reads.
 */
const IMPLEMENTATION = [
  'shared/lib/resource.ts',
  'shared/lib/apiQuery.ts',
  'shared/lib/transport/',
];

/**
 * Call sites whose path or method is chosen at runtime, and the calls they can actually make.
 * Keep each list beside the values the code passes; a stale entry fails the gate.
 */
const RESOLUTIONS: readonly Resolution[] = [
  {
    file: 'features/inventory/pages/Inventory.tsx',
    expression: 'transport.request<Result>({ method, path: `products/${action}`, body })',
    calls: [
      { method: 'POST', path: 'products/import' },
      { method: 'POST', path: 'products/bulk-delete' },
      { method: 'PUT', path: 'products/bulk-update' },
    ],
    reason: 'useCollectionAction(action, method) callers: importer, bulkDiscontinuer, bulkUpdater',
  },
  {
    file: 'features/pos/pages/Register.tsx',
    expression: "transport.request({ method: 'POST', path, body })",
    calls: [
      { method: 'POST', path: 'register/open' },
      { method: 'POST', path: 'register/close' },
      { method: 'POST', path: 'register/movement' },
    ],
    reason: 'useRegisterWrite(path) callers: openRegister, closeRegister, recordMovement',
  },
  {
    file: 'features/pos/pages/Shifts.tsx',
    expression: "transport.request({ method: 'POST', path })",
    calls: [
      { method: 'POST', path: 'shifts/clock-in' },
      { method: 'POST', path: 'shifts/clock-out' },
      { method: 'POST', path: 'shifts/break/start' },
      { method: 'POST', path: 'shifts/break/end' },
    ],
    reason: 'useShiftAction(path) callers: clockIn, clockOut, startBreak, endBreak',
  },
  {
    file: 'features/analytics/pages/Exports.tsx',
    expression:
      "transport .request<Blob>({ method: 'GET', path: `exports/${selected}`, responseType: 'blob' })",
    calls: [
      { method: 'GET', path: 'exports/products' },
      { method: 'GET', path: 'exports/sales' },
      { method: 'GET', path: 'exports/customers' },
    ],
    reason: 'selected is one of SOURCES; the server serves one literal route per source',
  },
  {
    file: 'features/purchasing/pages/PurchaseOrders.tsx',
    expression: 'purchaseOrders.useSave()',
    calls: [{ method: 'POST', path: 'purchase-orders' }],
    reason:
      'createOrder only creates: its save() is fed by the new-order form and never sends an id',
  },
];

function sourceFiles(dir: string): SourceFile[] {
  const files: SourceFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(dashboardSrc, full).split(sep).join('/');
    if (entry.isDirectory()) {
      if (entry.name === 'tests' || entry.name === '__tests__') continue;
      files.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    if (entry.name === 'routeTree.gen.ts' || entry.name.endsWith('.d.ts')) continue;
    if (IMPLEMENTATION.some((p) => rel === p || (p.endsWith('/') && rel.startsWith(p)))) continue;
    files.push({ path: rel, text: readFileSync(full, 'utf8') });
  }
  return files;
}

const extraction = extractClientCalls(sourceFiles(dashboardSrc));
const postponedPaths = readPostponedPaths(
  readFileSync(join(dashboardSrc, 'shared', 'lib', 'postponedFeatures.ts'), 'utf8')
);

const report = findClientPathDrift({
  extraction,
  served: liveServedRoutes(),
  postponedPaths,
  resolutions: RESOLUTIONS,
  minimumCalls: 100,
});

function section(mark: string, title: string, why: string, items: string[]): void {
  if (items.length === 0) return;
  const out = mark === '✗' ? console.error : console.log;
  out(`\n${mark} ${title} (${items.length})\n  ${why}\n`);
  for (const item of items) out(`    ${item}`);
}

section('✗', 'Implausible input', 'The gate would pass while proving nothing.', report.implausible);
section(
  '✗',
  'Client calls a route the server does not serve',
  'Fix the call, or serve the route. A 404 here is a broken page in a shop.',
  report.unserved
);
section(
  '✗',
  'Client call that cannot be resolved statically',
  'Make the path and method literals, or add a RESOLUTIONS entry naming the concrete calls.',
  report.unresolved
);
section(
  '✗',
  'Resolution that matches no call site',
  'The code it described has changed. Update or remove the entry.',
  report.staleResolutions
);
section(
  '•',
  'Known exception: postponed feature calls an unserved route',
  `Hidden by postponedFeatures.ts (${postponedPaths.join(', ')}); must be fixed before reactivating.`,
  report.postponed
);
section('•', 'Resolved dynamic calls', 'Checked through RESOLUTIONS.', report.resolved);

if (hasFailures(report)) {
  console.error('');
  process.exit(1);
}

console.log('');
console.log(
  `✓ ${report.checked} client API calls map to served routes ` +
    `(${report.postponed.length} postponed exceptions, ${report.resolved.length} resolved dynamically).`
);
console.log('');
process.exit(0);
