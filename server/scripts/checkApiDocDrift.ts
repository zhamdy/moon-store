/**
 * Fails when a route the server actually serves is missing from the OpenAPI document, or
 * vice versa (#47, #56).
 *
 * ## Why it walks the router rather than reading a list
 *
 * `endpointManifest` and `src/docs/openapi.ts` are both hand-maintained, so comparing them
 * to each other proves only that two people wrote the same thing down. The source of truth
 * for what this server responds to is the Express router itself: `routeTable` mounts every
 * feature router, and each router carries its own layer stack. That is what this reads.
 *
 * A route added in code and forgotten everywhere else is the failure this catches — the
 * one that leaves an endpoint live, undocumented, and outside the health suite that drives
 * itself from the manifest.
 *
 * ## What it does not claim
 *
 * That a documented request *shape* matches the Zod schema enforcing it. This compares the
 * set of `METHOD path` pairs and nothing else. Deriving the spec from the schemas is the
 * larger route recorded in CLAUDE.md; until then, a documented body can still drift from
 * the validator while this passes. Saying that plainly is better than a green check that
 * implies more than it tested.
 *
 * Usage: tsx scripts/checkApiDocDrift.ts
 */
import type { Router } from 'express';
import { routeTable } from '../src/router';
import { openApiSpec } from '../src/docs/openapi';
import { endpointDetailsManifest } from '../src/http/endpointManifest';

type Pair = string; // `GET /api/v1/products/:id`

/** Express keeps its own regexp-encoded path; this is the readable form back out. */
interface Layer {
  route?: { path: string | string[]; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
}

function routesOf(router: Router, mount: string): Pair[] {
  const stack = (router as unknown as { stack?: Layer[] }).stack ?? [];
  const pairs: Pair[] = [];

  for (const layer of stack) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const p of paths) {
        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          if (!enabled || method === '_all') continue;
          const full = `${mount}${p === '/' ? '' : p}`;
          pairs.push(`${method.toUpperCase()} ${full}`);
        }
      }
    } else if (layer.handle?.stack) {
      // A nested router mounted inside a feature router.
      pairs.push(...routesOf(layer.handle as unknown as Router, mount));
    }
  }
  return pairs;
}

/** OpenAPI writes `{id}` where Express writes `:id`. */
function toExpressStyle(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ':$1');
}

/**
 * Mounted directly on the app in `index.ts` rather than through `routeTable`, because the
 * probes must answer before and independently of the feature routers. They are served, so
 * they are listed here; walking only `routeTable` would report them as documented-but-
 * absent and teach everyone to ignore this gate's output.
 */
const MOUNTED_OUTSIDE_ROUTE_TABLE: readonly Pair[] = [
  'GET /api/health',
  'GET /api/health/live',
  'GET /api/health/ready',
];

const served = new Set<Pair>(MOUNTED_OUTSIDE_ROUTE_TABLE);
for (const [mount, router] of routeTable) {
  for (const pair of routesOf(router, mount)) served.add(pair);
}

const documented = new Set<Pair>();
const paths = (openApiSpec as { paths?: Record<string, Record<string, unknown>> }).paths ?? {};
for (const [path, methods] of Object.entries(paths)) {
  for (const method of Object.keys(methods)) {
    if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
    documented.add(`${method.toUpperCase()} ${toExpressStyle(path)}`);
  }
}

const manifested = new Set<Pair>(
  endpointDetailsManifest.map((e) => `${e.method} ${toExpressStyle(e.path)}`)
);

if (served.size === 0) {
  console.error(
    '\n✗ Walked the router and found no routes. This gate would pass while proving nothing.\n'
  );
  process.exit(1);
}

const undocumented = [...served].filter((p) => !documented.has(p)).sort();
const phantom = [...documented].filter((p) => !served.has(p)).sort();
const unmanifested = [...served]
  .filter((p) => !manifested.has(p) && !MOUNTED_OUTSIDE_ROUTE_TABLE.includes(p))
  .sort();

function report(title: string, why: string, items: string[]): boolean {
  if (items.length === 0) return false;
  console.error(`\n✗ ${title} (${items.length})\n  ${why}\n`);
  for (const item of items.slice(0, 40)) console.error(`    ${item}`);
  if (items.length > 40) console.error(`    ... and ${items.length - 40} more`);
  return true;
}

let failed = false;
failed =
  report(
    'Served but not documented',
    'These endpoints answer requests and appear in no OpenAPI path. Add them to src/docs/openapi.ts.',
    undocumented
  ) || failed;
failed =
  report(
    'Documented but not served',
    'The spec promises these and the router does not mount them. Remove them, or mount what was intended.',
    phantom
  ) || failed;
failed =
  report(
    'Served but not in the endpoint manifest',
    'endpointDetailsManifest drives tests/verification/endpointHealth.test.ts, so a route missing here is a route nothing exercises.',
    unmanifested
  ) || failed;

if (failed) {
  console.error('');
  process.exit(1);
}

console.log(
  `\n✓ ${served.size} served routes: all documented and manifested.\n` +
    '  (Set membership only — a documented request shape can still drift from its Zod schema.)\n'
);
