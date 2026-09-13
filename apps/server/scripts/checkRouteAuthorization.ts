/**
 * Fails when the endpoint manifest's `authorization` disagrees with the middleware (#162).
 *
 * The manifest said `POST /feedback` needed a token while the route had no auth at all, and
 * nothing noticed, because `check:api-docs` compares endpoint sets and request shapes and
 * never authorization. This walks `createApp()` for each route's real chain —
 * `verifyToken`, `requireRole(...)`, or neither — and compares it with the manifest entry.
 *
 * A disagreement is one of two kinds, and they are handled differently on purpose:
 *
 * - **The manifest is weaker than the route.** The manifest under-documents a stricter
 *   route; correct the manifest.
 * - **The route is weaker than the manifest.** A caller the manifest refuses gets in. That
 *   is a security decision for the owner, never something to settle by loosening the
 *   manifest, so each one is an entry in `UNDER_PROTECTED_ROUTES` with a reason, and the
 *   list is an exact ratchet: a new one fails, and fixing one fails until it is removed.
 *
 * What it cannot see: a check made inside a controller. The manifest's `predicate` is where
 * those are written down, and this gate does not compare it.
 *
 * Usage: tsx scripts/checkRouteAuthorization.ts
 */
import {
  EXPECTED_UNDER_PROTECTED,
  UNDER_PROTECTED_ROUTES,
  endpointDetailsManifest,
} from '../src/http/endpointManifest';
import { liveServedRoutes } from './gates/servedRoutes';
import { findAuthorizationDrift, hasFailures } from './gates/routeAuthorization';

/** Served, deliberately outside the manifest: the probes and the document itself. */
const UNMANIFESTED = [
  'GET /api/health',
  'GET /api/health/live',
  'GET /api/health/ready',
  'GET /openapi.json',
];

const report = findAuthorizationDrift({
  served: liveServedRoutes(),
  manifest: endpointDetailsManifest,
  exceptions: UNDER_PROTECTED_ROUTES,
  expectedUnderProtected: EXPECTED_UNDER_PROTECTED,
  unmanifestedAllowed: UNMANIFESTED,
  minimumEntries: 100,
});

function section(title: string, why: string, items: string[]): void {
  if (items.length === 0) return;
  console.error(`\n✗ ${title} (${items.length})\n  ${why}\n`);
  for (const item of items) console.error(`    ${item}`);
}

section('Implausible input', 'The gate would pass while proving nothing.', report.implausible);
section(
  'Manifest entry not matched to a served route',
  'Remove the entry, or mount what was intended.',
  report.notServed
);
section('Listed twice in the manifest', 'Only the first entry is compared.', report.duplicated);
section(
  'requireRole ahead of verifyToken',
  'requireRole reads req.user, which only verifyToken sets, so the route refuses everyone.',
  report.misordered
);
section(
  'Route weaker than the manifest, with no recorded decision',
  'The middleware admits a caller the manifest refuses. Do not loosen the manifest: fix the route, ' +
    'or add an UNDER_PROTECTED_ROUTES entry with a reason and raise the count only with the owner.',
  report.underProtected
);
section(
  'Under-protected exception that no longer applies',
  'The route now matches its manifest. Remove the entry and lower EXPECTED_UNDER_PROTECTED.',
  report.staleExceptions
);
section(
  'Manifest weaker than the route',
  'The middleware is stricter than documented. Correct the manifest entry to match it.',
  report.manifestWeaker
);
section('Ratchet out of step', 'The count must equal the true number exactly.', report.ratchet);

if (hasFailures(report)) {
  console.error('');
  process.exit(1);
}

console.log('');
console.log(`✓ ${report.checked} manifest entries agree with their route's middleware.`);
console.log(
  `  (${EXPECTED_UNDER_PROTECTED} under-protected routes await an owner decision; see UNDER_PROTECTED_ROUTES.)`
);
console.log('  Checks made inside controllers are not visible here.');
console.log('');
process.exit(0);
