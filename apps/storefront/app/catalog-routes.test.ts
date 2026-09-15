import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

// KD-10 invariant (apps/storefront/CLAUDE.md, "a 404 must be a real 404"): a
// `loading.tsx` at or above a catalog segment streams a 200 before the slug page can
// call `notFound()`, silently turning every unknown slug into a soft 404.

const APP = __dirname;
const LOCALE = path.join(APP, '[locale]');
const CATALOG = path.join(LOCALE, '(catalog)');
const LOADING_FILES = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'];
const SLUG_PAGES = [
  path.join(CATALOG, 'shop', '[category]', 'page.tsx'),
  path.join(CATALOG, 'collections', '[slug]', 'page.tsx'),
  path.join(CATALOG, 'products', '[slug]', 'page.tsx'),
];

function directoriesUnder(dir: string): string[] {
  return readdirSync(dir)
    .map((name) => path.join(dir, name))
    .filter((entry) => statSync(entry).isDirectory())
    .flatMap((entry) => [entry, ...directoriesUnder(entry)]);
}

describe('KD-10: catalog 404s stay real 404s', () => {
  it('no loading file exists at or above any catalog route segment', () => {
    const segments = [APP, LOCALE, CATALOG, ...directoriesUnder(CATALOG)];
    const found = segments.flatMap((dir) =>
      LOADING_FILES.map((file) => path.join(dir, file)).filter((file) => existsSync(file))
    );
    expect(found.map((file) => path.relative(APP, file))).toEqual([]);
  });

  it.each(SLUG_PAGES.map((page) => [path.relative(APP, page), page]))(
    '%s resolves its entity and calls notFound()',
    (_name, page) => {
      const source = readFileSync(page, 'utf8');
      expect(source).toMatch(/import\s*\{[^}]*\bnotFound\b[^}]*\}\s*from\s*'next\/navigation'/);
      expect(source).toMatch(/\bnotFound\(\)/);
    }
  );
});
