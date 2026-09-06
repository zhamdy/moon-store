/**
 * How much of the API's request surface is derived, measured against the router (#102).
 *
 * Conversion lands module by module, so this is a ratchet rather than a pass/fail: it
 * pins the exact number of operations still to convert, and fails if that number moves in
 * either direction. Failing when it *falls* is the half that matters — a ratchet left
 * above the true count has silently stopped ratcheting, which is the same failure the
 * server's `--max-warnings` number is documented to avoid.
 *
 * It walks the real Express router for the same reason `checkApiDocDrift` does: every
 * other list is hand-maintained, so comparing two of them proves only that somebody wrote
 * the same thing down twice.
 */
import type { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { routeTable } from '../src/router';
import {
  EXPECTED_UNCONVERTED,
  requestContracts,
  unconvertedOperations,
} from '../src/docs/requestContracts';
import { indexContracts } from '../src/http/requestContracts';

interface Layer {
  route?: { path: string | string[]; methods: Record<string, boolean> };
  handle?: { stack?: Layer[] };
}

function routesOf(router: Router, mount: string): string[] {
  const stack = (router as unknown as { stack?: Layer[] }).stack ?? [];
  const pairs: string[] = [];

  for (const layer of stack) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      for (const path of paths) {
        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          if (!enabled || method === '_all') continue;
          pairs.push(`${method.toUpperCase()} ${mount}${path === '/' ? '' : path}`);
        }
      }
    } else if (layer.handle?.stack) {
      pairs.push(...routesOf(layer.handle as unknown as Router, mount));
    }
  }
  return pairs;
}

/** Mounted on the app rather than through `routeTable`, so they must be added by hand. */
const HEALTH_PROBES = ['GET /api/health', 'GET /api/health/live', 'GET /api/health/ready'];

/** OpenAPI writes `{id}`; Express writes `:id`. Compare in Express's dialect. */
function toExpressStyle(path: string): string {
  return path.replace(/\{([^}]+)\}/g, ':$1');
}

const served = new Set<string>(HEALTH_PROBES);
for (const [mount, router] of routeTable) {
  for (const pair of routesOf(router, mount)) served.add(pair);
}

const classified = new Set<string>([
  ...requestContracts.map((contract) => toExpressStyle(contract.key)),
  ...unconvertedOperations.map((operation) => toExpressStyle(operation.key)),
]);

describe('request contract coverage', () => {
  it('describes only operations the server actually serves', () => {
    // A contract for a route that no longer exists documents a promise nothing keeps, and
    // would keep the ratchet looking healthier than it is.
    const orphaned = [...classified].filter((key) => !served.has(key));
    expect(orphaned).toEqual([]);
  });

  it('never lets two entries claim one operation', () => {
    expect(() => indexContracts(requestContracts)).not.toThrow();

    const keys = [
      ...requestContracts.map((contract) => contract.key),
      ...unconvertedOperations.map((operation) => operation.key),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('makes every deliberate omission carry a reason a person wrote', () => {
    // `none` and `custom` are claims a test cannot verify on its own. The reason is what
    // makes them reviewable rather than a way to make the number go down.
    for (const operation of unconvertedOperations) {
      expect(
        operation.reason.trim().length,
        `${operation.key} has an empty reason`
      ).toBeGreaterThan(10);
      expect(['none', 'custom']).toContain(operation.classification);
    }
  });

  it('holds the count of unconverted operations exactly', () => {
    const unclassified = [...served].filter((key) => !classified.has(key)).sort();

    expect(
      unclassified.length,
      unclassified.length > EXPECTED_UNCONVERTED
        ? `New operations landed without a request contract:\n  ${unclassified.join('\n  ')}`
        : 'Contracts were added without lowering EXPECTED_UNCONVERTED in src/docs/requestContracts.ts — ' +
            'a ratchet above the true count has stopped ratcheting.'
    ).toBe(EXPECTED_UNCONVERTED);
  });

  it('has converted the pilot module completely, not partially', () => {
    // A half-converted module is the worst state: the document looks derived and is not.
    const usersRoutes = [...served].filter((key) => key.includes(' /api/v1/users'));
    const usersClassified = [...classified].filter((key) => key.includes(' /api/v1/users'));

    expect(usersClassified.sort()).toEqual(usersRoutes.sort());
  });
});
