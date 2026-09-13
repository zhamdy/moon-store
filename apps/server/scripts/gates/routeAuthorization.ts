/**
 * Compares the endpoint manifest's `authorization` against each route's real middleware
 * chain (#162). Pure: the CLI feeds it the live app, the tests feed it known-bad input.
 */
import type { DetailedEndpointEntry } from '../../src/http/endpointManifest';
import { deriveAuthorization, type ServedRoute } from './servedRoutes';

/** Every role a valid token can carry. `verifyToken` alone admits all of them. */
export const ALL_ROLES: readonly string[] = ['Admin', 'Cashier', 'Delivery'];

export interface UnderProtectedException {
  /** `METHOD /api/v1/path`, Express dialect. */
  key: string;
  reason: string;
}

export interface AuthorizationDriftInput {
  served: readonly ServedRoute[];
  manifest: readonly DetailedEndpointEntry[];
  exceptions: readonly UnderProtectedException[];
  expectedUnderProtected: number;
  /** Routes that are served but deliberately not manifested (the health probes). */
  unmanifestedAllowed: readonly string[];
  /** Fewer manifest entries than this means the gate is reading the wrong thing. */
  minimumEntries: number;
}

export interface AuthorizationDriftReport {
  checked: number;
  /** Fatal: the gate would pass while proving nothing. */
  implausible: string[];
  /** The manifest promises an operation the app does not serve. */
  notServed: string[];
  /** Listed twice; the second entry's authorization is never compared. */
  duplicated: string[];
  /** `requireRole` ahead of `verifyToken`: rejects every caller with a 401. */
  misordered: string[];
  /** The manifest is stricter than the middleware and nobody has recorded why. */
  underProtected: string[];
  /** Listed in the exceptions but no longer under-protected: remove it from the list. */
  staleExceptions: string[];
  /** The middleware is stricter than the manifest: correct the manifest. */
  manifestWeaker: string[];
  /** The exception count constant disagrees with reality. */
  ratchet: string[];
}

const toExpress = (path: string) => path.replace(/\{([^}]+)\}/g, ':$1');

function describe(roles: ReadonlySet<string> | 'anonymous'): string {
  return roles === 'anonymous' ? 'public' : [...roles].sort().join('+');
}

export function findAuthorizationDrift(input: AuthorizationDriftInput): AuthorizationDriftReport {
  const report: AuthorizationDriftReport = {
    checked: 0,
    implausible: [],
    notServed: [],
    duplicated: [],
    misordered: [],
    underProtected: [],
    staleExceptions: [],
    manifestWeaker: [],
    ratchet: [],
  };

  if (input.manifest.length < input.minimumEntries) {
    report.implausible.push(
      `Read ${input.manifest.length} manifest entries; expected at least ${input.minimumEntries}.`
    );
  }
  if (input.served.length === 0) {
    report.implausible.push('Walked the app and found no served routes.');
  }

  const servedByKey = new Map<string, ServedRoute>();
  for (const route of input.served) servedByKey.set(`${route.method} ${route.path}`, route);

  const seen = new Set<string>();
  const underProtected = new Set<string>();

  for (const entry of input.manifest) {
    const key = `${entry.method} ${toExpress(entry.path)}`;
    if (seen.has(key)) {
      report.duplicated.push(key);
      continue;
    }
    seen.add(key);

    const route = servedByKey.get(key);
    if (!route) {
      report.notServed.push(key);
      continue;
    }
    report.checked += 1;

    const derived = deriveAuthorization(route.handlers);
    if (derived.kind === 'misordered') {
      report.misordered.push(key);
      continue;
    }

    const actual: ReadonlySet<string> | 'anonymous' =
      derived.kind === 'public'
        ? 'anonymous'
        : new Set(derived.roles === 'any' ? ALL_ROLES : derived.roles);
    const promised: ReadonlySet<string> | 'anonymous' =
      entry.authorization.kind === 'public' ? 'anonymous' : new Set(entry.authorization.roles);

    if (actual === 'anonymous' && promised === 'anonymous') continue;
    const detail = `${key}  (manifest: ${describe(promised)}; middleware: ${describe(actual)})`;

    // The route admits someone the manifest says it refuses.
    const routeWider =
      actual === 'anonymous' ||
      (promised !== 'anonymous' && [...actual].some((r) => !promised.has(r)));
    if (routeWider) {
      underProtected.add(key);
      if (!input.exceptions.some((e) => e.key === key)) report.underProtected.push(detail);
      continue;
    }

    const manifestWider =
      promised === 'anonymous' || [...promised].some((r) => !(actual as Set<string>).has(r));
    if (manifestWider) report.manifestWeaker.push(detail);
  }

  for (const key of servedByKey.keys()) {
    if (!seen.has(key) && !input.unmanifestedAllowed.includes(key)) {
      // `check:api-docs` owns this failure; it is noted so a count here is never misread.
      report.notServed.push(`${key}  (served but not in the manifest)`);
    }
  }

  for (const exception of input.exceptions) {
    if (!underProtected.has(exception.key)) report.staleExceptions.push(exception.key);
  }

  if (input.exceptions.length !== input.expectedUnderProtected) {
    report.ratchet.push(
      `EXPECTED_UNDER_PROTECTED is ${input.expectedUnderProtected} but the list has ${input.exceptions.length} entries.`
    );
  }
  if (underProtected.size !== input.expectedUnderProtected) {
    report.ratchet.push(
      `EXPECTED_UNDER_PROTECTED is ${input.expectedUnderProtected} but ${underProtected.size} routes are under-protected.`
    );
  }

  return report;
}

export function hasFailures(report: AuthorizationDriftReport): boolean {
  return (
    report.implausible.length +
      report.notServed.length +
      report.duplicated.length +
      report.misordered.length +
      report.underProtected.length +
      report.staleExceptions.length +
      report.manifestWeaker.length +
      report.ratchet.length >
    0
  );
}
