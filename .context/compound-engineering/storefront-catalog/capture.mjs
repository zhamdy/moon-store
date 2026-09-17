// Throwaway Shop + Collections capture (plan 2026-09-14-002, Unit 13). Not committed.
// Run by the user, reviewed by the implementer.
//
// Prerequisites
//   1. API on :3001 over a disposable/dev database with migration 014 and the seed:
//        cd apps/server && npm run migrate && npm run seed && npm run dev
//      (set MEDIA_LOCAL_ROOT to a scratch dir: see apps/server/CLAUDE.md, smoke tip)
//      Set CATALOG_SERVER_TOKEN on the API (>= 32 bytes) if you want the trusted bucket;
//      this script makes ~250 page loads, well inside the 300 per-IP default, but a
//      second run inside 15 minutes can hit it without the token.
//   2. Storefront production build on :3000, with the same CATALOG_SERVER_TOKEN and
//      MEDIA_ORIGIN=http://localhost:3001 in the build and runtime env:
//        cd apps/storefront && npm run build && npm run start
//   3. From the repository root:
//        node .context/compound-engineering/storefront-catalog/capture.mjs
//
// Env
//   STOREFRONT_URL        default http://localhost:3000
//   STOREFRONT_DIR        default apps/storefront (for .next/static and .env.local)
//   CATALOG_SERVER_TOKEN  the configured token; else read from STOREFRONT_DIR/.env*.local
//                         or .env. Used only to scan .next/static for a leak.
//
// Error state (manual, second run): stop the API, then run
//   node .context/compound-engineering/storefront-catalog/capture.mjs --error-state
// It loads a filter URL no one has requested (so the data cache cannot answer), waits for
// hydration and screenshots the client error screen, and checks the HTML for API error text.
//
// Uses the Playwright installed in e2e/ (no database, none of the e2e harness).
// Output: .context/compound-engineering/storefront-catalog/captures/<timestamp>/summary.json
// Exit code 1 when any hard assertion fails (listed under `failures`).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const require = createRequire(join(ROOT, 'e2e/package.json'));
const { chromium } = require('@playwright/test');

const BASE = (process.env.STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const APP_DIR = resolve(ROOT, process.env.STOREFRONT_DIR ?? 'apps/storefront');
const ERROR_STATE = process.argv.includes('--error-state');

const WIDTHS = [320, 375, 768, 1024, 1440];
const HEIGHT = { 320: 640, 375: 812, 768: 1024, 1024: 768, 1440: 900 };
const LOCALES = ['en', 'ar'];

// Seed facts (apps/server/src/database/seed.ts): prices 180..6750 EGP, 34 products (some
// inactive, so 2 pages of 24 on /shop), `kimonos` has only a discontinued product,
// `winter-tailoring` is upcoming and `summer-2025` archived, no product or collection images.
const PAGES = [
  { id: 'shop', path: '/shop' },
  { id: 'shop-filtered', path: '/shop?stock=in&min=500&max=3000' },
  { id: 'category-dresses', path: '/shop/dresses' },
  { id: 'new-in', path: '/new-in' },
  { id: 'collections', path: '/collections' },
  { id: 'collection-silk', path: '/collections/silk' },
  { id: 'category-empty-kimonos', path: '/shop/kimonos' },
  { id: 'zero-results', path: '/shop?min=100000' },
  { id: 'out-of-range', path: '/shop?page=50' },
];

const STATUS_EXPECTATIONS = [
  ['/en/shop', 200],
  ['/ar/shop', 200],
  ['/en/shop/dresses', 200],
  ['/en/shop/kimonos', 200],
  ['/en/new-in', 200],
  ['/en/collections', 200],
  ['/en/collections/silk', 200],
  ['/en/shop?page=abc&sort=best', 200],
  ['/en/shop?min=100000', 200],
  ['/en/shop/not-a-category', 404],
  ['/ar/shop/not-a-category', 404],
  ['/en/collections/winter-tailoring', 404],
  ['/en/collections/summer-2025', 404],
  ['/en/collections/not-a-collection', 404],
  ['/en/products/anything', 404],
];

const out = join(HERE, 'captures', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(out, { recursive: true });

const summary = {
  base: BASE,
  startedAt: new Date().toISOString(),
  failures: [],
  status: [],
  pages: [],
  filterSheet: [],
  reducedMotion: [],
  named: {},
  homepage: [],
  eagerJs: null,
  bundleScan: null,
  manual: [
    'Keyboard-only: Filter -> sheet -> apply -> summary remove -> Sort -> pagination (Unit 11).',
    'Screen reader: result count announced after a filter apply; pagination lands on the results heading.',
    'Contrast: filter summary text, the dimmed pending grid, sold-out badge.',
    'Error state: stop the API and run with --error-state (see header).',
    'Compare homepage/*.png with .context/compound-engineering/storefront-freeze/captures/<latest>.',
    'AD-12: phones grid shift with filters active; Sort wrap at 320; sticky utility row question.',
  ],
};

function fail(message) {
  summary.failures.push(message);
  console.error(`FAIL ${message}`);
}

// Scroll through so every Reveal fires before a full-page screenshot.
async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.6));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

async function overflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
}

function watchIssues(page) {
  const issues = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') issues.push(`${m.type()}: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => issues.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on('response', (res) => {
    const type = res.request().resourceType();
    // Card links point at /products/<slug>, which 404s by design; prefetches are expected.
    if (res.status() >= 400 && type !== 'document' && !res.url().includes('/products/')) {
      issues.push(`${res.status()} ${type} ${res.url().slice(0, 140)}`);
    }
  });
  return issues;
}

async function newPage(browser, { width, height, locale, reducedMotion = false }) {
  const context = await browser.newContext({
    viewport: { width, height: height ?? HEIGHT[width] },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    locale: locale === 'ar' ? 'ar-EG' : 'en-US',
  });
  const page = await context.newPage();
  return { context, page, issues: watchIssues(page) };
}

async function hydrated(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------------------
// Error-state mode: the API is stopped by the user.
// ---------------------------------------------------------------------------------------
if (ERROR_STATE) {
  const browser = await chromium.launch();
  const results = [];
  for (const [locale, width] of [
    ['en', 375],
    ['en', 1440],
    ['ar', 375],
  ]) {
    // A price bound nobody has requested, so the data cache has no entry for it.
    const min = 50 * (1000 + Math.floor(Math.random() * 90000));
    const url = `${BASE}/${locale}/shop?min=${min}`;
    const { context, page, issues } = await newPage(browser, { width, locale });
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((e) => ({ error: e.message }));
    await hydrated(page);
    await page.waitForTimeout(1500);
    const html = await page.content();
    const leaked = ['ECONNREFUSED', 'fetch failed', 'ApiError', 'NETWORK_ERROR', 'TIMEOUT', 'localhost:3001']
      .filter((needle) => html.includes(needle));
    const retryButton = await page.getByRole('button', { name: locale === 'en' ? 'Try again' : /./ }).count();
    const tag = `error-${locale}-${width}`;
    await page.screenshot({ path: join(out, `${tag}.png`), fullPage: true });
    results.push({
      tag,
      url,
      httpStatus: response?.status?.() ?? response?.error ?? null,
      h1: await page.locator('h1').first().textContent().catch(() => null),
      retryButtons: retryButton,
      leakedErrorText: leaked,
      issues,
    });
    if (leaked.length) fail(`${tag}: API error text in HTML: ${leaked.join(', ')}`);
    await context.close();
  }
  await browser.close();
  summary.errorState = results;
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`Error-state captures written to ${out}`);
  console.table(results.map(({ tag, httpStatus, h1, leakedErrorText }) => ({ tag, httpStatus, h1, leaked: leakedErrorText.join(' ') })));
  process.exit(summary.failures.length ? 1 : 0);
}

// ---------------------------------------------------------------------------------------
// 1. HTTP status (asserted on the wire, not the rendered page).
// ---------------------------------------------------------------------------------------
for (const [path, expected] of STATUS_EXPECTATIONS) {
  let status;
  let robots = null;
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    status = res.status;
    const html = await res.text();
    robots = html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? null;
  } catch (error) {
    status = `error: ${error.message}`;
  }
  summary.status.push({ path, expected, status, robots });
  if (status !== expected) fail(`status ${path}: expected ${expected}, got ${status}`);
}

const browser = await chromium.launch();

// ---------------------------------------------------------------------------------------
// 2. Every page x width x locale: viewport + full-page screenshot, overflow, issues.
// ---------------------------------------------------------------------------------------
for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    const { context, page, issues } = await newPage(browser, { width, locale });
    const dir = join(out, `${locale}-${width}`);
    mkdirSync(dir, { recursive: true });
    for (const { id, path } of PAGES) {
      issues.length = 0;
      const response = await page.goto(`${BASE}/${locale}${path}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: join(dir, `${id}-top.png`) });
      await settle(page);
      const o = await overflow(page);
      await page.screenshot({ path: join(dir, `${id}-full.png`), fullPage: true });
      const facts = await page.evaluate(() => ({
        h1: document.querySelector('h1')?.textContent?.trim() ?? null,
        cards: document.querySelectorAll('[data-catalog-grid] > li').length,
        resultCount: document.getElementById('catalog-result-count')?.textContent ?? null,
        brokenImages: [...document.images]
          .filter((img) => img.complete && img.currentSrc && img.naturalWidth === 0)
          .map((img) => img.currentSrc.slice(0, 120)),
        leakedKeys: document.body.innerText.match(/\b(catalog|products|common|navigation)\.[a-zA-Z0-9.]+/g) ?? [],
        eagerImages: [...document.querySelectorAll('[data-catalog-grid] img[loading="eager"]')].length,
      }));
      const row = {
        tag: `${locale}-${width}`,
        id,
        httpStatus: response?.status() ?? null,
        noHorizontalOverflow: o.scrollWidth === o.innerWidth,
        ...o,
        ...facts,
        issues: [...issues],
      };
      summary.pages.push(row);
      if (!row.noHorizontalOverflow) fail(`${row.tag} ${id}: horizontal overflow ${o.scrollWidth} > ${o.innerWidth}`);
      if (facts.brokenImages.length) fail(`${row.tag} ${id}: broken images`);
      if (facts.leakedKeys.length) fail(`${row.tag} ${id}: leaked message keys ${facts.leakedKeys.join(' ')}`);
    }

    // Filter sheet open on /shop.
    await page.goto(`${BASE}/${locale}/shop`, { waitUntil: 'networkidle' });
    const trigger = page.locator('button[aria-haspopup="dialog"]').first();
    if ((await trigger.count()) === 0) {
      fail(`${locale}-${width}: no Filter button on /shop`);
    } else {
      await trigger.click();
      await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(700);
      const o = await overflow(page);
      await page.screenshot({ path: join(dir, 'filter-sheet.png') });
      const sheet = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        const r = d?.getBoundingClientRect();
        return {
          open: !!d,
          focused: document.activeElement?.outerHTML.slice(0, 120) ?? null,
          rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
        };
      });
      summary.filterSheet.push({ tag: `${locale}-${width}`, ...sheet, noHorizontalOverflow: o.scrollWidth === o.innerWidth });
      await page.keyboard.press('Escape');
    }
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------
// 3. Reduced motion: content visible without scrolling through.
// ---------------------------------------------------------------------------------------
for (const locale of LOCALES) {
  for (const width of [375, 1440]) {
    const { context, page } = await newPage(browser, { width, locale, reducedMotion: true });
    for (const { id, path } of PAGES.filter((p) => ['shop', 'collection-silk', 'collections'].includes(p.id))) {
      await page.goto(`${BASE}/${locale}${path}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: join(out, `reduced-${locale}-${width}-${id}.png`), fullPage: true });
      const pending = await page.evaluate(() =>
        [...document.querySelectorAll('[data-reveal]')].filter((el) => el.getAttribute('data-reveal') === 'pending').length
      );
      summary.reducedMotion.push({ tag: `${locale}-${width}`, id, pendingReveals: pending });
      if (pending > 0) fail(`reduced ${locale}-${width} ${id}: ${pending} Reveal(s) held pending`);
    }
    await context.close();
  }
}

// ---------------------------------------------------------------------------------------
// 4. Named checks.
// ---------------------------------------------------------------------------------------
{
  // 1024 ar: category row scrolls; utility row fits (count its visual lines).
  const { context, page } = await newPage(browser, { width: 1024, locale: 'ar' });
  await page.goto(`${BASE}/ar/shop`, { waitUntil: 'networkidle' });
  summary.named.ar1024Rows = await page.evaluate(() => {
    const row = document.querySelector('[data-category-row]');
    const toolbar = document.querySelector('[data-catalog] > div');
    const items = toolbar
      ? [...toolbar.children].flatMap((el) =>
          getComputedStyle(el).display === 'contents' ? [...el.children] : [el]
        ).filter((el) => el.getBoundingClientRect().height > 0)
      : [];
    const tops = [...new Set(items.map((el) => Math.round(el.getBoundingClientRect().top)))];
    return {
      categoryRow: row ? { scrollWidth: row.scrollWidth, clientWidth: row.clientWidth, scrolls: row.scrollWidth > row.clientWidth, links: row.querySelectorAll('a').length } : null,
      utilityRow: toolbar ? { height: Math.round(toolbar.getBoundingClientRect().height), itemLines: tops.length, overflows: toolbar.scrollWidth > toolbar.clientWidth } : null,
    };
  });
  await page.locator('[data-category-row]').screenshot({ path: join(out, 'named-ar-1024-category-row.png') }).catch(() => {});
  await page.locator('[data-catalog] > div').first().screenshot({ path: join(out, 'named-ar-1024-utility-row.png') }).catch(() => {});
  await page.goto(`${BASE}/ar/shop?stock=in&min=500&max=3000`, { waitUntil: 'networkidle' });
  await page.locator('[data-catalog] > div').first().screenshot({ path: join(out, 'named-ar-1024-utility-row-filtered.png') }).catch(() => {});
  await context.close();
}

{
  // 375 en: a product whose name falls back to Arabic, and a no-image card.
  const { context, page } = await newPage(browser, { width: 375, locale: 'en' });
  let found = null;
  for (const query of ['', '?page=2']) {
    await page.goto(`${BASE}/en/shop${query}`, { waitUntil: 'networkidle' });
    const span = page.locator('[data-catalog-grid] article h3 span[lang="ar"]').first();
    if ((await span.count()) > 0) {
      const card = page.locator('[data-catalog-grid] > li', { has: span }).first();
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await card.screenshot({ path: join(out, 'named-en-375-arabic-fallback-card.png') });
      found = await span.evaluate((el) => ({
        text: el.textContent,
        dir: el.getAttribute('dir'),
        fontFamily: getComputedStyle(el).fontFamily,
        overflowsCard: el.closest('li').scrollWidth > el.closest('li').clientWidth,
        page: location.search || '?page=1',
      }));
      break;
    }
  }
  summary.named.en375ArabicFallback = found ?? 'not found on pages 1-2 (seed has 3 name_en: null products; check they are active)';
  if (!found) fail('named: no Arabic-fallback product name found on /en/shop');

  await page.goto(`${BASE}/en/shop`, { waitUntil: 'networkidle' });
  const noImage = page.locator('[data-catalog-grid] > li').filter({ has: page.locator('[aria-hidden="true"] img') }).first();
  if ((await noImage.count()) > 0) {
    await noImage.screenshot({ path: join(out, 'named-en-375-no-image-card.png') });
    summary.named.noImageCard = 'captured';
  } else {
    summary.named.noImageCard = 'no image-less card on page 1';
  }
  await context.close();
}

{
  // Loading skeleton: best effort. A fast local API may stream the grid before the fallback paints.
  const { context, page } = await newPage(browser, { width: 375, locale: 'en' });
  const min = 50 * (2000 + Math.floor(Math.random() * 90000));
  await page.goto(`${BASE}/en/shop?max=${min}`, { waitUntil: 'commit' });
  let seen = false;
  for (let i = 0; i < 30 && !seen; i += 1) {
    seen = await page
      .evaluate(() => !!document.querySelector('p[role="status"]') && !document.querySelector('[data-catalog]'))
      .catch(() => false);
    if (seen) await page.screenshot({ path: join(out, 'named-en-375-skeleton.png') });
    else await page.waitForTimeout(50);
  }
  summary.named.skeletonCaptured = seen;
  await context.close();
}

{
  // Filter sheet at 320 with the min field focused; the viewport is shortened to stand in
  // for the on-screen numeric keyboard, which headless Chromium cannot show.
  const { context, page } = await newPage(browser, { width: 320, locale: 'en' });
  await page.goto(`${BASE}/en/shop`, { waitUntil: 'networkidle' });
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  const input = page.locator('[role="dialog"] input[inputmode="numeric"]').first();
  await input.click();
  await input.fill('500');
  await page.screenshot({ path: join(out, 'named-320-sheet-min-focused.png') });
  await page.setViewportSize({ width: 320, height: 340 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, 'named-320-sheet-keyboard-height.png') });
  summary.named.sheet320 = await page.evaluate(() => {
    const el = document.activeElement;
    const r = el?.getBoundingClientRect();
    return {
      active: el?.outerHTML.slice(0, 120) ?? null,
      activeVisible: r ? r.top >= 0 && r.bottom <= window.innerHeight : false,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  await context.close();
}

{
  // Focus position after following a pagination link to the last page, and Back after a sort.
  const { context, page } = await newPage(browser, { width: 1440, locale: 'en' });
  await page.goto(`${BASE}/en/shop`, { waitUntil: 'networkidle' });
  const pageLinks = page.locator('nav a[aria-label][href*="#catalog-results"]');
  const count = await pageLinks.count();
  if (count === 0) {
    summary.named.paginationFocus = 'no pagination on /en/shop (fewer than 25 active products?)';
  } else {
    const last = pageLinks.nth(count - 1);
    await last.scrollIntoViewIfNeeded();
    await last.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/page=/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);
    summary.named.paginationFocus = await page.evaluate(() => {
      const target = document.getElementById('catalog-results');
      const el = document.activeElement;
      return {
        url: location.pathname + location.search + location.hash,
        activeElement: el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.textContent ?? '').trim().slice(0, 60)}"` : null,
        activeIsResultsHeading: el === target,
        resultsHeadingTop: target ? Math.round(target.getBoundingClientRect().top) : null,
        firstCardTop: Math.round(document.querySelector('[data-catalog-grid] > li')?.getBoundingClientRect().top ?? -1),
        scrollY: Math.round(window.scrollY),
      };
    });
    await page.screenshot({ path: join(out, 'named-1440-after-pagination.png') });
    // Sequential focus start: the next Tab should land inside the results.
    await page.keyboard.press('Tab');
    summary.named.paginationFocus.afterTab = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 60)}"` : null;
    });
  }

  await page.goto(`${BASE}/en/shop`, { waitUntil: 'networkidle' });
  const select = page.locator('[data-catalog] select').first();
  if ((await select.count()) > 0) {
    await select.selectOption('price-asc');
    await page.waitForURL(/sort=price-asc/, { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goBack();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);
    const url = page.url();
    const selectValue = await select.inputValue().catch(() => null);
    summary.named.backAfterSort = { url, selectValue, restored: !url.includes('sort=') && selectValue === 'newest' };
    if (!summary.named.backAfterSort.restored) fail('Back after sort did not restore the unsorted listing');
  }
  await context.close();
}

// ---------------------------------------------------------------------------------------
// 5. Homepage regression pair (compare with the freeze captures).
// ---------------------------------------------------------------------------------------
mkdirSync(join(out, 'homepage'), { recursive: true });
for (const locale of LOCALES) {
  for (const width of [375, 1440]) {
    const { context, page, issues } = await newPage(browser, { width, locale });
    await page.goto(`${BASE}/${locale}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: join(out, 'homepage', `${locale}-${width}-top.png`) });
    await settle(page);
    const o = await overflow(page);
    await page.screenshot({ path: join(out, 'homepage', `${locale}-${width}-full.png`), fullPage: true });
    const hrefs = await page.evaluate(() =>
      [...new Set([...document.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href')))]
        .filter((h) => /\/(shop|collections|new-in|products)/.test(h))
    );
    summary.homepage.push({ tag: `${locale}-${width}`, noHorizontalOverflow: o.scrollWidth === o.innerWidth, ...o, commerceHrefs: hrefs, issues: [...issues] });
    if (o.scrollWidth !== o.innerWidth) fail(`homepage ${locale}-${width}: horizontal overflow`);
    await context.close();
  }
}
await browser.close();

// Every commerce href on the homepage except /products/* should now resolve.
{
  const hrefs = [...new Set(summary.homepage.flatMap((h) => h.commerceHrefs))].filter((h) => !h.includes('/products/'));
  summary.homepageHrefStatus = [];
  for (const href of hrefs) {
    const res = await fetch(`${BASE}${href}`, { redirect: 'manual' }).catch(() => null);
    summary.homepageHrefStatus.push({ href, status: res?.status ?? 'error' });
    if (res?.status !== 200) fail(`homepage link ${href}: ${res?.status ?? 'error'}`);
  }
}

// ---------------------------------------------------------------------------------------
// 6. Eager JS: /en/shop vs /en, measured from the served HTML against .next/static.
// ---------------------------------------------------------------------------------------
async function eager(path) {
  const html = await (await fetch(`${BASE}${path}`)).text();
  const srcs = [...new Set([...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];
  let total = 0;
  let motionReact = false;
  const rows = srcs.map((src) => {
    const file = join(APP_DIR, '.next', decodeURIComponent(src.replace('/_next/', '')));
    if (!existsSync(file)) return { src, missing: true };
    const buf = readFileSync(file);
    const gz = gzipSync(buf).length;
    total += gz;
    if (buf.toString('utf8').includes('useInView')) motionReact = true;
    return { src, gzKB: +(gz / 1024).toFixed(2) };
  });
  return { path, chunks: rows.length, totalGzKB: +(total / 1024).toFixed(2), motionReactLikely: motionReact, rows };
}
{
  const home = await eager('/en');
  const shop = await eager('/en/shop');
  const homeSrcs = new Set(home.rows.map((r) => r.src));
  const shopOnly = shop.rows.filter((r) => !homeSrcs.has(r.src));
  summary.eagerJs = {
    home: { chunks: home.chunks, totalGzKB: home.totalGzKB, motionReactLikely: home.motionReactLikely },
    shop: { chunks: shop.chunks, totalGzKB: shop.totalGzKB, motionReactLikely: shop.motionReactLikely },
    deltaGzKB: +(shop.totalGzKB - home.totalGzKB).toFixed(2),
    shopOnlyChunks: shopOnly,
    detail: { home: home.rows, shop: shop.rows },
  };
  if (shop.motionReactLikely) fail('eager JS: /en/shop appears to load motion/react (useInView)');
}

// ---------------------------------------------------------------------------------------
// 7. Token leak scan over .next/static.
// ---------------------------------------------------------------------------------------
function configuredToken() {
  if (process.env.CATALOG_SERVER_TOKEN) return { value: process.env.CATALOG_SERVER_TOKEN, from: 'process.env' };
  for (const name of ['.env.production.local', '.env.local', '.env.production', '.env']) {
    const file = join(APP_DIR, name);
    if (!existsSync(file)) continue;
    const match = readFileSync(file, 'utf8').match(/^\s*CATALOG_SERVER_TOKEN\s*=\s*"?([^"\r\n]*)"?\s*$/m);
    if (match && match[1]) return { value: match[1], from: name };
  }
  return { value: null, from: null };
}
function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}
{
  const staticDir = join(APP_DIR, '.next', 'static');
  const token = configuredToken();
  const needles = ['x-catalog-server-token', 'catalog_server_token'];
  const hits = [];
  let scanned = 0;
  if (!existsSync(staticDir)) {
    fail(`bundle scan: ${staticDir} does not exist (build first)`);
  } else {
    for (const file of walk(staticDir)) {
      if (!/\.(js|css|json|txt|html|map)$/.test(file)) continue;
      scanned += 1;
      const text = readFileSync(file, 'utf8');
      const lower = text.toLowerCase();
      for (const needle of needles) if (lower.includes(needle)) hits.push({ file, needle });
      // Every rotation entry is checked; a value is never written to the summary.
      for (const value of (token.value ?? '').split(',').map((v) => v.trim()).filter(Boolean)) {
        if (text.includes(value)) hits.push({ file, needle: '<configured token value>' });
      }
    }
  }
  summary.bundleScan = {
    staticDir,
    filesScanned: scanned,
    tokenValueChecked: !!token.value,
    tokenSource: token.from,
    hits,
  };
  if (!token.value) summary.manual.push('Bundle scan ran without a token value: set CATALOG_SERVER_TOKEN when running the capture.');
  if (hits.length) fail(`bundle scan: ${hits.length} hit(s) in .next/static`);
}

summary.finishedAt = new Date().toISOString();
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(`Captures written to ${out}`);
console.table(summary.status.map(({ path, expected, status }) => ({ path, expected, status })));
console.log(JSON.stringify({ named: summary.named, eagerJs: { home: summary.eagerJs.home, shop: summary.eagerJs.shop, deltaGzKB: summary.eagerJs.deltaGzKB }, bundleScan: { ...summary.bundleScan, hits: summary.bundleScan.hits.length } }, null, 2));
console.log(summary.failures.length ? `${summary.failures.length} failure(s):\n- ${summary.failures.join('\n- ')}` : 'No hard failures.');
process.exit(summary.failures.length ? 1 : 0);
