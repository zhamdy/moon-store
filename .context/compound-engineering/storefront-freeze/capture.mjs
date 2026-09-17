// Throwaway freeze capture (not committed). Run by the user, reviewed by the implementer.
//
//   cd apps/storefront && npm run build && npm run start      (port 3000)
//   node .context/compound-engineering/storefront-freeze/capture.mjs   (from the repo root)
//
// Uses the Playwright already installed in e2e/ (no database, none of the e2e harness).
// Output: .context/compound-engineering/storefront-freeze/captures/<timestamp>/
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const require = createRequire(resolve('e2e/package.json'));
const { chromium } = require('@playwright/test');

const BASE = process.env.STOREFRONT_URL ?? 'http://localhost:3000';
const WIDTHS = [320, 375, 768, 1024, 1440];
const HEIGHT = { 320: 640, 375: 812, 768: 1024, 1024: 768, 1440: 900 };
const LOCALES = ['en', 'ar'];
const SECTIONS = [
  'hero-heading',
  'strip-heading',
  'new-arrivals-title',
  'promo-banner-title',
  'featured-title',
  'categories-title',
  'campaign-title',
  'curated-title',
  'benefits-title',
  'lookbook-title',
];

const out = resolve(
  '.context/compound-engineering/storefront-freeze/captures',
  new Date().toISOString().replace(/[:.]/g, '-')
);
mkdirSync(out, { recursive: true });
const report = [];

// Scroll through so every Reveal fires before any section is photographed.
async function settle(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.6));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1800);
}

async function pass({ width, locale, reducedMotion = false, scale = 1, only }) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height: HEIGHT[width] },
    deviceScaleFactor: scale,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const tag = `${locale}-${width}${scale > 1 ? '@2x' : ''}${reducedMotion ? '-reduced' : ''}`;
  const dir = join(out, tag);
  mkdirSync(dir, { recursive: true });

  await page.goto(`${BASE}/${locale}`, { waitUntil: 'networkidle' });
  const eagerHeroImages = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => /hero-[a-z-]*(desktop|mobile)/.test(decodeURIComponent(e.name)))
      .map((e) => decodeURIComponent(e.name).match(/hero-[a-z-]*(desktop|mobile)/)[0])
  );
  await page.screenshot({ path: join(dir, '00-header-top.png') });
  await settle(page);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  for (const id of only ?? SECTIONS) {
    const section = page.locator(`[aria-labelledby="${id}"]`).first();
    if ((await section.count()) === 0) continue;
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    if (id === 'hero-heading') {
      await page.evaluate(() => window.scrollTo(0, 0));
      const tabs = page.locator('[role="tab"]');
      const count = await tabs.count();
      for (let i = 0; i < count; i += 1) {
        await tabs.nth(i).click();
        await page.waitForTimeout(1600);
        await section.screenshot({ path: join(dir, `hero-slide-${i + 1}.png`) });
      }
      continue;
    }
    await section.screenshot({ path: join(dir, `${id}.png`) });
  }

  if (!only) {
    await page.evaluate(() => window.scrollTo(0, 240));
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(dir, '01-header-scrolled.png') });
    await page.locator('footer').last().screenshot({ path: join(dir, 'footer.png') });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(dir, 'full-page.png'), fullPage: true });
  }

  report.push({
    tag,
    noHorizontalOverflow: overflow.scrollWidth === overflow.innerWidth,
    ...overflow,
    heroImagesFetchedBeforeInteraction: [...new Set(eagerHeroImages)],
  });
  await browser.close();
}

for (const locale of LOCALES) {
  for (const width of WIDTHS) await pass({ width, locale });
  await pass({ width: 1440, locale, scale: 2, only: ['hero-heading', 'campaign-title'] });
  for (const width of [375, 1440]) await pass({ width, locale, reducedMotion: true });
}

writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(`Captures written to ${out}`);
console.table(report.map(({ tag, noHorizontalOverflow, heroImagesFetchedBeforeInteraction }) => ({
  tag,
  noHorizontalOverflow,
  heroImages: heroImagesFetchedBeforeInteraction.join(' '),
})));
