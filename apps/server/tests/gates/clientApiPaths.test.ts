/**
 * Proves `check:client-paths` can fail (#162). A gate is only evidence if a known-bad input
 * turns it red; each case here is one way the real dashboard could drift.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractClientCalls,
  findClientPathDrift,
  hasFailures,
  readPostponedPaths,
  type Resolution,
  type SourceFile,
} from '../../scripts/gates/clientApiPaths';
import type { Method, ServedRoute } from '../../scripts/gates/servedRoutes';

const route = (method: Method, path: string): ServedRoute => ({ method, path, handlers: [] });

const SERVED: ServedRoute[] = [
  route('GET', '/api/v1/products'),
  route('GET', '/api/v1/products/:id'),
  route('POST', '/api/v1/products'),
  route('PUT', '/api/v1/products/:id'),
  route('PUT', '/api/v1/products/:id/status'),
  route('GET', '/api/v1/products/lookup'),
  route('POST', '/api/v1/orders'),
  route('GET', '/api/v1/orders/latest'),
];

/** Every fixture declares a resource, so the "found no resource()" sanity check stays quiet. */
const PREAMBLE = `const products = resource<Product>('products');\n`;

function drift(text: string, options: { resolutions?: Resolution[]; postponed?: string[] } = {}) {
  const files: SourceFile[] = [{ path: 'features/x/Page.tsx', text: PREAMBLE + text }];
  const report = findClientPathDrift({
    extraction: extractClientCalls(files),
    served: SERVED,
    postponedPaths: options.postponed ?? ['/bundles'],
    resolutions: options.resolutions ?? [],
    minimumCalls: 1,
  });
  return { report, failed: hasFailures(report) };
}

describe('client API path gate', () => {
  it('passes calls that map onto served routes, templates included', () => {
    const { report, failed } = drift(`
      products.useList();
      products.useOne(id);
      products.useSave();
      products.useAction('status', { method: 'PUT' });
      transport.request({ method: 'GET', path: \`products/\${id}\` });
      useApiQuery(['k'], 'products/lookup');
    `);
    expect(report.unserved).toEqual([]);
    // useSave counts twice: create and update.
    expect(report.checked).toBe(7);
    expect(failed).toBe(false);
  });

  it('fails a transport.request to a route the server does not serve', () => {
    const { report, failed } = drift(
      `transport.request({ method: 'GET', path: 'orders/gone/x' });`
    );
    expect(report.unserved[0]).toContain('GET /api/v1/orders/gone/x');
    expect(failed).toBe(true);
  });

  it('fails when the path exists but not for that method', () => {
    const { report, failed } = drift(`transport.request({ method: 'DELETE', path: 'orders' });`);
    expect(report.unserved[0]).toContain('DELETE /api/v1/orders');
    expect(failed).toBe(true);
  });

  it('fails a resource hook whose URL the server does not serve', () => {
    const { report, failed } = drift(`
      products.useAction('archive', { method: 'PUT' });
      products.useRemove();
    `);
    expect(report.unserved.map((l) => l.split('  ')[0])).toEqual([
      'PUT /api/v1/products/:param/archive',
      'DELETE /api/v1/products/:param',
    ]);
    expect(failed).toBe(true);
  });

  it('never lets an interpolation match a literal route segment', () => {
    // GET /orders/latest is served, but `orders/${x}` names any order, which nothing serves.
    const { report, failed } = drift(`useApiQuery(['o'], \`orders/\${x}\`);`);
    expect(report.unserved[0]).toContain('GET /api/v1/orders/:param');
    expect(failed).toBe(true);
  });

  it('fails a dynamic path with no resolution, and passes it with one', () => {
    const text = `transport.request({ method: 'POST', path });`;
    const unresolved = drift(text);
    expect(unresolved.report.unresolved).toHaveLength(1);
    expect(unresolved.failed).toBe(true);

    const resolved = drift(text, {
      resolutions: [
        {
          file: 'features/x/Page.tsx',
          expression: "transport.request({ method: 'POST', path })",
          calls: [{ method: 'POST', path: 'orders' }],
          reason: 'test',
        },
      ],
    });
    expect(resolved.report.resolved).toHaveLength(1);
    expect(resolved.failed).toBe(false);
  });

  it('checks the calls a resolution names, so a resolution cannot launder a bad path', () => {
    const { report, failed } = drift(`transport.request({ method: 'POST', path });`, {
      resolutions: [
        {
          file: 'features/x/Page.tsx',
          expression: "transport.request({ method: 'POST', path })",
          calls: [{ method: 'POST', path: 'nowhere' }],
          reason: 'test',
        },
      ],
    });
    expect(report.unserved[0]).toContain('POST /api/v1/nowhere');
    expect(failed).toBe(true);
  });

  it('fails a resolution that matches no call site', () => {
    const { report, failed } = drift(`useApiQuery(['k'], 'products');`, {
      resolutions: [
        { file: 'features/x/Page.tsx', expression: 'gone()', calls: [], reason: 'stale' },
      ],
    });
    expect(report.staleResolutions).toHaveLength(1);
    expect(failed).toBe(true);
  });

  it('fails a useSave where only one of create/update is served', () => {
    const { report, failed } = drift(`
      const orders = resource<Order>('orders');
      orders.useSave();
    `);
    expect(report.unresolved[0]).toContain('only POST (create) is served');
    expect(failed).toBe(true);
  });

  it('fails a resource hook on something not declared as a resource in the file', () => {
    const { report, failed } = drift(`imported.useList();`);
    expect(report.unresolved[0]).toContain('not declared as resource()');
    expect(failed).toBe(true);
  });

  it('reports a postponed feature as a known exception rather than a failure', () => {
    const { report, failed } = drift(`useApiQuery(['b'], 'bundles/pos');`);
    expect(report.postponed[0]).toContain('GET /api/v1/bundles/pos');
    expect(report.unserved).toEqual([]);
    expect(failed).toBe(false);
  });

  it('refuses to pass on implausible input', () => {
    const report = findClientPathDrift({
      extraction: extractClientCalls([]),
      served: SERVED,
      postponedPaths: [],
      resolutions: [],
      minimumCalls: 100,
    });
    expect(report.implausible).toHaveLength(3);
    expect(hasFailures(report)).toBe(true);
  });

  it('reads calls out of real dashboard source, not only fixtures', () => {
    const inventory = resolve(
      __dirname,
      '../../../dashboard/src/features/inventory/pages/Inventory.tsx'
    );
    const { calls } = extractClientCalls([
      { path: 'features/inventory/pages/Inventory.tsx', text: readFileSync(inventory, 'utf8') },
    ]);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toContain('PUT products/:param/status');
  });
});

describe('POSTPONED_PATHS reader', () => {
  it('reads the real list, following same-file constants', () => {
    const file = resolve(__dirname, '../../../dashboard/src/shared/lib/postponedFeatures.ts');
    expect(readPostponedPaths(readFileSync(file, 'utf8'))).toContain('/bundles');
  });

  it('throws on an entry it cannot read rather than dropping it', () => {
    expect(() =>
      readPostponedPaths(`export const POSTPONED_PATHS = [elsewhere(), '/x'] as const;`)
    ).toThrow(/cannot read/);
  });
});
