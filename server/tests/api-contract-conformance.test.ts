import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
});
