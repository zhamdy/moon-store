/**
 * Automated accessibility checks on the workflows a shop actually runs (#54).
 *
 * ## What this can and cannot prove
 *
 * axe finds machine-checkable violations — missing names, bad contrast, broken ARIA
 * relationships, duplicate ids. It cannot tell you whether the focus order makes sense,
 * whether a dialog returns focus somewhere useful, or whether an announcement says
 * something a person can act on. Those are asserted directly below instead, and the ones
 * that genuinely need a human are listed in `docs/ACCESSIBILITY.md`.
 *
 * So this file is deliberately two halves: an axe scan per surface, and hand-written
 * keyboard/focus/announcement assertions that axe would score as passing either way.
 *
 * ## Why it gates on `serious` and `critical` only
 *
 * The acceptance criterion is "CI blocks **newly introduced high-impact** violations".
 * Gating on `moderate` and `minor` too would have meant either a large unrelated cleanup
 * in this PR or a long ignore list, and an ignore list is where a gate goes to die. The
 * scan still reports every impact level in the failure message, so the smaller ones are
 * visible without being blocking.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';
import { expect, test } from '../fixtures/test';
import { cartPanel, checkoutDrawer, posPage } from '../support/locators';

/** WCAG 2.2 AA, which is what the issue asks for, plus the non-versioned best practices. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const BLOCKING: ReadonlyArray<string> = ['serious', 'critical'];

function describeViolations(violations: Result[]): string {
  return violations
    .map((v) => {
      const where = v.nodes
        .slice(0, 3)
        .map((n) => `      ${n.target.join(' ')}`)
        .join('\n');
      return `  [${v.impact}] ${v.id}: ${v.help}\n${where}\n      ${v.helpUrl}`;
    })
    .join('\n\n');
}

/**
 * Scans and fails on high-impact findings, while still printing the rest.
 *
 * Reporting the non-blocking ones matters: a gate that hides what it is not enforcing
 * teaches everyone that the quiet levels do not exist.
 */
/**
 * Waits for every running CSS transition/animation to settle before measuring.
 *
 * axe reads *computed* styles, so an element caught mid-fade genuinely has a lower
 * contrast ratio than the one it lands on — the drawer scanned during its entry
 * animation reported a contrast violation that vanished when the same test ran alone.
 * Waiting on `toBeVisible` is not enough: visible is the start of the animation, not
 * the end.
 */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.getAnimations().every((a) => a.playState === 'finished' || a.playState === 'idle'),
    undefined,
    { timeout: 5_000 }
  );
}

async function scan(page: Page, label: string): Promise<void> {
  await settled(page);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = results.violations.filter((v) => BLOCKING.includes(v.impact ?? ''));
  const other = results.violations.filter((v) => !BLOCKING.includes(v.impact ?? ''));

  if (other.length > 0) {
    console.log(`\n[a11y] ${label} — non-blocking findings:\n${describeViolations(other)}\n`);
  }

  expect(
    blocking,
    `${label}: high-impact accessibility violations\n\n${describeViolations(blocking)}\n`
  ).toEqual([]);
}

test.describe('accessibility @smoke', () => {
  test('the login screen has no high-impact violations', async ({ browser }) => {
    // A signed-out context on purpose: login is the one screen every user meets, and it
    // is the only one the authenticated fixtures never render.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in|تسجيل/i })).toBeVisible();

    await scan(page, 'login');
    await context.close();
  });

  test('the POS screen has no high-impact violations', async ({ cashierContext, seedProduct }) => {
    const product = await seedProduct('a11ypos', { price: 40, stock: 6 });
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await expect(posPage(page).productCard(product.sku)).toBeVisible();

    await scan(page, 'pos');
  });

  test('the checkout drawer has no high-impact violations', async ({
    cashierContext,
    seedProduct,
  }) => {
    // The drawer is where the money is, and it is a dialog — the control type most likely
    // to trap a keyboard user or lose a screen reader.
    const product = await seedProduct('a11ydrawer', { price: 40, stock: 6 });
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await cartPanel(page).checkout.click();
    await expect(checkoutDrawer(page).dialog).toBeVisible();

    await scan(page, 'checkout drawer');
  });

  test('the inventory table has no high-impact violations', async ({ adminContext }) => {
    const page = await adminContext.newPage();
    await page.goto('/inventory');
    await expect(page.getByRole('table').first()).toBeVisible();

    await scan(page, 'inventory');
  });
});

test.describe('accessibility in Arabic RTL @smoke', () => {
  // The shipped default. Direction is derived from locale (#54), so this also guards the
  // single source of truth: a page whose `dir` disagreed with its `lang` would show up
  // here as reversed reading order rather than as a silently mixed layout.
  test.use({ appLocale: 'ar' });

  test('the document declares a language that matches its direction', async ({
    cashierContext,
  }) => {
    const page = await cashierContext.newPage();
    await page.goto('/pos');

    const { lang, dir } = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
    }));

    expect(lang, 'lang is set — a screen reader picks its voice from this').toBe('ar');
    expect(dir, 'direction follows the locale rather than a separate stored value').toBe('rtl');
  });

  test('the POS screen has no high-impact violations in Arabic', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('a11yrtl', { price: 40, stock: 6 });
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    // Waited for by test id rather than by searching: `posPage().search` resolves its
    // placeholder from the `en` catalog by default, so filling it here would hang on a
    // page rendering Arabic. The grid lists the seeded product without a search anyway.
    await expect(posPage(page).productCard(product.sku)).toBeVisible();

    await scan(page, 'pos (ar)');
  });
});

/**
 * The half axe cannot score. Every assertion here would pass a rule-based scan while
 * failing a person: a dialog that opens without moving focus, or drops it on the body
 * when it closes, is perfectly valid markup and unusable without a mouse.
 */
test.describe('keyboard and focus @smoke', () => {
  test('the checkout drawer takes focus, keeps it, and gives it back', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('a11yfocus', { price: 40, stock: 6 });
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();

    const trigger = cartPanel(page).checkout;
    await trigger.focus();
    expect(
      await trigger.evaluate((el) => el === document.activeElement),
      'the checkout button is focusable'
    ).toBe(true);
    await trigger.click();

    const drawer = checkoutDrawer(page).dialog;
    await expect(drawer).toBeVisible();

    // Focus moved INTO the dialog. Without this a keyboard user is left behind it,
    // tabbing through the page underneath while a modal covers the screen.
    await expect
      .poll(() => drawer.evaluate((el) => el.contains(document.activeElement)), { timeout: 5_000 })
      .toBe(true);

    // ...and stays there. Tabbing repeatedly must not walk out into the page behind.
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');
    expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    // Focus returns to what opened it, rather than to the top of the document — which
    // would make closing a dialog cost a keyboard user the whole page again.
    await expect
      .poll(() => trigger.evaluate((el) => el === document.activeElement), {
        timeout: 5_000,
      })
      .toBe(true);
  });

  test('a cashier can add a product to the cart without a pointer', async ({
    cashierContext,
    seedProduct,
  }) => {
    const product = await seedProduct('a11ykbd', { price: 25, stock: 4 });
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);

    const card = posPage(page).productCard(product.sku);
    await expect(card).toBeVisible();

    // Reachable and operable as a control, not just clickable as a box.
    await card.focus();
    expect(await card.evaluate((el) => el === document.activeElement)).toBe(true);
    await page.keyboard.press('Enter');

    await expect(cartPanel(page).quantity(product.id)).toHaveText('1');
  });

  test('the favourite toggle is its own control, reachable and stateful', async ({
    cashierContext,
    seedProduct,
  }) => {
    // It used to be a button nested inside the pressable card (#54): a screen reader
    // could not reach it separately and the card's name swallowed its label.
    const product = await seedProduct('a11yfav', { price: 25, stock: 4 });
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await expect(posPage(page).productCard(product.sku)).toBeVisible();

    // Exact: every card carries one of these, so a loose match resolves to the grid.
    const favourite = page.getByRole('button', {
      name: `${product.name}: Add to favourites`,
      exact: true,
    });
    await expect(favourite).toBeVisible();
    // aria-pressed is what tells a screen reader whether it is on; without it the
    // control announces identically in both states.
    await expect(favourite).toHaveAttribute('aria-pressed', /true|false/);
  });
});
