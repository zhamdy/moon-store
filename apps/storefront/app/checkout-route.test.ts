import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

// The checkout page (plan 2026-09-15-002, Units 6-7) is static, browser-state only, outside
// `(catalog)`, and a real 404 when Checkout is off in this build (CO-22).

const APP = __dirname;
const LOCALE = path.join(APP, '[locale]');
const CHECKOUT = path.join(LOCALE, 'checkout');
const PAGE = path.join(CHECKOUT, 'page.tsx');
const LOADING_FILES = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'];

describe('/checkout route', () => {
  it('exists at app/[locale]/checkout/page.tsx, outside (catalog), with no unlocalized twin', () => {
    expect(existsSync(PAGE)).toBe(true);
    expect(path.relative(APP, PAGE).split(path.sep)).not.toContain('(catalog)');
    expect(existsSync(path.join(LOCALE, '(catalog)', 'checkout'))).toBe(false);
    expect(existsSync(path.join(APP, 'checkout'))).toBe(false);
  });

  it('has no loading file at or above its segment', () => {
    const found = [APP, LOCALE, CHECKOUT].flatMap((dir) =>
      LOADING_FILES.map((file) => path.join(dir, file)).filter((file) => existsSync(file))
    );
    expect(found.map((file) => path.relative(APP, file))).toEqual([]);
  });

  it('is static, noindex, titled from checkout.metaTitle, and localized links only', () => {
    const source = readFileSync(PAGE, 'utf8');
    expect(source).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    expect(source).toMatch(/\bgetCheckoutMetadataStrings\(/);
    expect(source).toMatch(/export\s+function\s+generateStaticParams\b/);
    expect(source).toMatch(/from '@\/i18n\/navigation'/);
    expect(source).not.toMatch(/from 'next\/link'/);
  });

  it('404s behind the one build switch, imported rather than re-derived', () => {
    const source = readFileSync(PAGE, 'utf8');
    expect(source).toMatch(
      /import \{ CHECKOUT_ENABLED \} from '@\/features\/cart\/utils\/checkout-availability'/
    );
    expect(source.match(/!CHECKOUT_ENABLED\)\s*\{\s*notFound\(\);/g)?.length).toBe(2);
    expect(source).not.toMatch(/NEXT_PUBLIC_CHECKOUT_ENABLED|NODE_ENV/);
  });
});
