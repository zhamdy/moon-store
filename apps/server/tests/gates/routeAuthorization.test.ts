/**
 * Proves `check:route-auth` can fail (#162): each case feeds the gate a manifest that
 * disagrees with real `verifyToken` / `requireRole` middleware on a real Express router.
 */
import express, { Router, type RequestHandler } from 'express';
import { describe, expect, it } from 'vitest';
import { requireRole, rolesRequiredBy, verifyToken } from '../../middleware/auth';
import type { DetailedEndpointEntry } from '../../src/http/endpointManifest';
import { EXPECTED_UNDER_PROTECTED, UNDER_PROTECTED_ROUTES } from '../../src/http/endpointManifest';
import {
  deriveAuthorization,
  liveServedRoutes,
  servedRoutesOf,
} from '../../scripts/gates/servedRoutes';
import {
  findAuthorizationDrift,
  hasFailures,
  type UnderProtectedException,
} from '../../scripts/gates/routeAuthorization';

const ok: RequestHandler = (_req, res) => {
  res.end();
};

function fixture() {
  const router = Router();
  router.get('/open', ok);
  router.get('/token', verifyToken, ok);
  router.get('/admin', verifyToken, requireRole('Admin'), ok);
  router.get('/misordered', requireRole('Admin'), verifyToken, ok);
  const app = express();
  app.use('/api/v1/t', router);
  return { app, router, served: servedRoutesOf(app, [['/api/v1/t', router]]) };
}

const auth = {
  public: { kind: 'public' as const, roles: [], predicate: null },
  any: { kind: 'authenticated' as const, roles: ['Admin', 'Cashier', 'Delivery'], predicate: null },
  admin: { kind: 'authenticated' as const, roles: ['Admin'], predicate: null },
};

const entry = (
  path: string,
  authorization: DetailedEndpointEntry['authorization']
): DetailedEndpointEntry => ({
  method: 'GET',
  path: `/api/v1/t${path}`,
  classification: 'S',
  authorization,
});

const AGREEING: DetailedEndpointEntry[] = [
  entry('/open', auth.public),
  entry('/token', auth.any),
  entry('/admin', auth.admin),
];

function run(
  manifest: DetailedEndpointEntry[],
  exceptions: UnderProtectedException[] = [],
  expected = exceptions.length
) {
  const { served } = fixture();
  const report = findAuthorizationDrift({
    served: served.filter((r) => !r.path.endsWith('/misordered')),
    manifest,
    exceptions,
    expectedUnderProtected: expected,
    unmanifestedAllowed: [],
    minimumEntries: 1,
  });
  return { report, failed: hasFailures(report) };
}

describe('route walker', () => {
  it('reads each route and its middleware out of a real app', () => {
    const { served } = fixture();
    expect(served.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /api/v1/t/open',
      'GET /api/v1/t/token',
      'GET /api/v1/t/admin',
      'GET /api/v1/t/misordered',
    ]);
  });

  it('derives public, token-only, role-gated and misordered chains', () => {
    const [open, token, admin, misordered] = fixture().served;
    expect(deriveAuthorization(open!.handlers)).toEqual({ kind: 'public' });
    expect(deriveAuthorization(token!.handlers)).toEqual({ kind: 'authenticated', roles: 'any' });
    expect(deriveAuthorization(admin!.handlers)).toEqual({
      kind: 'authenticated',
      roles: ['Admin'],
    });
    expect(deriveAuthorization(misordered!.handlers)).toEqual({ kind: 'misordered' });
  });

  it('applies router-level auth middleware to the routes after it', () => {
    const router = Router();
    router.use(verifyToken);
    router.get('/x', ok);
    const app = express();
    app.use('/api/v1/r', router);
    const [x] = servedRoutesOf(app, [['/api/v1/r', router]]);
    expect(deriveAuthorization(x!.handlers)).toEqual({ kind: 'authenticated', roles: 'any' });
  });

  it('refuses a router mounted outside the route table rather than skipping it', () => {
    const { app } = fixture();
    expect(() => servedRoutesOf(app, [])).toThrow(/not in routeTable/);
  });

  it('finds a plausible number of routes in the real app', () => {
    const live = liveServedRoutes();
    expect(live.length).toBeGreaterThan(150);
    expect(live.some((r) => deriveAuthorization(r.handlers).kind === 'public')).toBe(true);
  });
});

describe('requireRole tagging', () => {
  it('exposes its roles without changing what it enforces', () => {
    const middleware = requireRole('Admin', 'Cashier');
    expect(rolesRequiredBy(middleware)).toEqual(['Admin', 'Cashier']);
    expect(rolesRequiredBy(verifyToken)).toBeNull();

    let status = 0;
    const res = {
      status(code: number) {
        status = code;
        return { json: () => undefined };
      },
    };
    middleware({ user: { role: 'Delivery' } } as never, res as never, () => undefined);
    expect(status).toBe(403);
  });
});

describe('manifest authorization gate', () => {
  it('passes when every entry agrees with its middleware', () => {
    expect(run(AGREEING).failed).toBe(false);
  });

  it('fails an under-protected route: token-only where the manifest says Admin', () => {
    const { report, failed } = run([
      entry('/open', auth.public),
      entry('/token', auth.admin),
      entry('/admin', auth.admin),
    ]);
    expect(report.underProtected[0]).toContain('GET /api/v1/t/token');
    expect(failed).toBe(true);
  });

  it('fails a public route the manifest says needs a token', () => {
    const { report, failed } = run([
      entry('/open', auth.any),
      entry('/token', auth.any),
      entry('/admin', auth.admin),
    ]);
    expect(report.underProtected[0]).toContain(
      'manifest: Admin+Cashier+Delivery; middleware: public'
    );
    expect(failed).toBe(true);
  });

  it('passes an under-protected route only while it is a listed, counted exception', () => {
    const manifest = [
      entry('/open', auth.public),
      entry('/token', auth.admin),
      entry('/admin', auth.admin),
    ];
    const exception = { key: 'GET /api/v1/t/token', reason: 'owner decision pending' };
    expect(run(manifest, [exception]).failed).toBe(false);
    // The count is a ratchet in both directions.
    expect(run(manifest, [exception], 2).report.ratchet).not.toEqual([]);
  });

  it('fails an exception that no longer applies, so fixing a route forces the list down', () => {
    const { report, failed } = run(AGREEING, [{ key: 'GET /api/v1/t/token', reason: 'fixed' }]);
    expect(report.staleExceptions).toEqual(['GET /api/v1/t/token']);
    expect(failed).toBe(true);
  });

  it('fails a manifest weaker than its route', () => {
    const { report, failed } = run([
      entry('/open', auth.public),
      entry('/token', auth.any),
      entry('/admin', auth.any),
    ]);
    expect(report.manifestWeaker[0]).toContain('GET /api/v1/t/admin');
    expect(failed).toBe(true);
  });

  it('fails a manifest entry for a route that is not served', () => {
    const { report, failed } = run([...AGREEING, entry('/ghost', auth.admin)]);
    expect(report.notServed).toContain('GET /api/v1/t/ghost');
    expect(failed).toBe(true);
  });

  it('fails requireRole placed ahead of verifyToken', () => {
    const { served } = fixture();
    const report = findAuthorizationDrift({
      served,
      manifest: [...AGREEING, entry('/misordered', auth.admin)],
      exceptions: [],
      expectedUnderProtected: 0,
      unmanifestedAllowed: [],
      minimumEntries: 1,
    });
    expect(report.misordered).toEqual(['GET /api/v1/t/misordered']);
  });

  it('refuses to pass on implausible input', () => {
    const report = findAuthorizationDrift({
      served: [],
      manifest: [],
      exceptions: [],
      expectedUnderProtected: 0,
      unmanifestedAllowed: [],
      minimumEntries: 100,
    });
    expect(report.implausible).toHaveLength(2);
    expect(hasFailures(report)).toBe(true);
  });

  it('keeps the real exception count equal to the real list', () => {
    expect(UNDER_PROTECTED_ROUTES).toHaveLength(EXPECTED_UNDER_PROTECTED);
  });
});
