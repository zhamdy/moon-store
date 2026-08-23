import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { endpointDetailsManifest, endpointManifest } from '../src/http/endpointManifest';

const root = resolve(__dirname, '..', '..');

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('API contract conformance guardrails', () => {
  it('keeps legacy success flags out of module controllers', () => {
    const modulesRoot = resolve(root, 'server/src/modules');
    const controllers = readdirSync(modulesRoot, { recursive: true })
      .filter((path) => path.toString().endsWith('controller.ts'))
      .map((path) => readFileSync(resolve(modulesRoot, path.toString()), 'utf8'))
      .concat(
        readdirSync(resolve(root, 'server/middleware'))
          .filter((path) => path.endsWith('.ts'))
          .map((path) => readFileSync(resolve(root, 'server/middleware', path), 'utf8'))
      )
      .join('\n');
    expect(controllers).not.toContain('success: true');
    expect(controllers).not.toContain('success: false');
  });

  it('documents the canonical pagination and response contracts', () => {
    const conventions = read('docs/CONVENTIONS.md');
    expect(conventions).toContain('paginationMeta(query.page, query.pageSize, total)');
    expect(conventions).toContain("throw new PublicError('NOT_FOUND'");
    expect(conventions).not.toContain('meta: { total, page, limit }');
  });

  it('keeps the React notification collection off legacy limit queries', () => {
    const notifications = read('client/src/app/NotificationCenter.tsx');
    expect(notifications).toContain('params: { page: 1, pageSize: 25 }');
    expect(notifications).not.toContain('params: { limit:');
  });

  it('keeps migrated React collections off oversized and legacy list requests', () => {
    const clientRoot = resolve(root, 'client/src');
    const source = readdirSync(clientRoot, { recursive: true })
      .filter((path) => /\.(ts|tsx)$/.test(path.toString()) && !/\.test\./.test(path.toString()))
      .map((path) => readFileSync(resolve(clientRoot, path.toString()), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/\b(?:limit|page_size|sort_by|sort_order)\s*:/);
    expect(source).not.toMatch(/pageSize\s*:\s*(?:200|500|1000)\b/);
  });

  it('requires every mounted route group to have an explicit contract manifest entry', () => {
    const routerSource = read('server/src/router.ts');
    const manifestSource = read('server/src/http/endpointManifest.ts');
    const mounts = [...routerSource.matchAll(/\['(\/api\/v1\/[^']+)',\s*\w+Router\]/g)].map(
      (match) => match[1]
    );

    expect(mounts).toHaveLength(37);
    expect(new Set(mounts).size).toBe(mounts.length);
    for (const mount of mounts) {
      expect(manifestSource).toContain(`'${mount}':`);
      expect(endpointManifest[mount]).toBeDefined();
    }
  });

  it('validates detailed endpoint manifest classification and authorization completeness', () => {
    expect(endpointDetailsManifest.length).toBeGreaterThan(100);

    const validClassifications = new Set(['P', 'B', 'S', 'M', 'E']);
    for (const entry of endpointDetailsManifest) {
      expect(validClassifications.has(entry.classification)).toBe(true);
      expect(['public', 'authenticated']).toContain(entry.authorization.kind);
      expect(entry.path.startsWith('/api/v1/')).toBe(true);
      expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(entry.method);
    }
  });
});
