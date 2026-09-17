// Throwaway (not committed): console errors/warnings, page errors, failed requests,
// broken images and leaked message keys on the built homepage, per locale and width.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(resolve('e2e/package.json'));
const { chromium } = require('@playwright/test');
const BASE = process.env.STOREFRONT_URL ?? 'http://localhost:3000';

const browser = await chromium.launch();
for (const locale of ['en', 'ar']) {
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const issues = [];
    const heroRequests = new Set();
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') issues.push(`${m.type()}: ${m.text().slice(0, 200)}`);
    });
    page.on('pageerror', (e) => issues.push(`pageerror: ${e.message.slice(0, 200)}`));
    page.on('request', (req) => {
      const match = decodeURIComponent(req.url()).match(/hero-[a-z-]*(desktop|mobile)/);
      if (match) heroRequests.add(match[0]);
    });
    page.on('response', (res) => {
      // Every nav/card target 404s by design until Shop and Collections exist.
      if (res.status() >= 400 && res.request().resourceType() !== 'document') {
        issues.push(`${res.status()} ${res.url().slice(0, 140)}`);
      }
    });

    await page.goto(`${BASE}/${locale}`, { waitUntil: 'networkidle' });
    const heroBeforeInteraction = [...heroRequests];
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 150));
      }
    });
    await page.waitForTimeout(1500);

    const broken = await page.evaluate(() =>
      [...document.images]
        .filter((img) => img.complete && img.currentSrc && img.naturalWidth === 0)
        .map((img) => img.currentSrc.slice(0, 100))
    );
    const leakedKeys = await page.evaluate(
      () => document.body.innerText.match(/\b(home|common|footer|navigation|products|categories)\.[a-zA-Z0-9.]+/g) ?? []
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    console.log(
      JSON.stringify({ locale, width, heroBeforeInteraction, issues, broken, leakedKeys, overflowPx: overflow })
    );
    await page.close();
  }
}
await browser.close();
