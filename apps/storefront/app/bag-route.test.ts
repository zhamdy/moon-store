import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

// The bag page (plan 2026-09-15-001, Unit 7) is static, browser-state only, and lives
// outside `(catalog)`: it needs neither the catalog error boundary nor its KD-10 rules,
// but a `loading.tsx` above it would still wrap it in Suspense for nothing.

const APP = __dirname;
const LOCALE = path.join(APP, '[locale]');
const BAG = path.join(LOCALE, 'bag');
const PAGE = path.join(BAG, 'page.tsx');
const LOADING_FILES = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'];

describe('/bag route', () => {
  it('exists at app/[locale]/bag/page.tsx, outside (catalog)', () => {
    expect(existsSync(PAGE)).toBe(true);
    expect(path.relative(APP, PAGE).split(path.sep)).not.toContain('(catalog)');
    expect(existsSync(path.join(LOCALE, '(catalog)', 'bag'))).toBe(false);
  });

  it('has no loading file at or above its segment', () => {
    const found = [APP, LOCALE, BAG].flatMap((dir) =>
      LOADING_FILES.map((file) => path.join(dir, file)).filter((file) => existsSync(file))
    );
    expect(found.map((file) => path.relative(APP, file))).toEqual([]);
  });

  it('is noindex, nofollow and titled from bag.metaTitle', () => {
    const source = readFileSync(PAGE, 'utf8');
    expect(source).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    expect(source).toMatch(/\bgetBagMetadataStrings\(/);
    expect(source).toMatch(/export\s+function\s+generateStaticParams\b/);
  });
});
