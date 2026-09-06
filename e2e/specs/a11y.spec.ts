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
import { createCustomer } from '../fixtures/customer';
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

  test('the delivery order dialog has no high-impact violations', async ({
    adminContext,
    adminApi,
  }) => {
    // The dialog #103 rebuilt. Scanning it is the half axe can score; the
    // keyboard-only creation below is the half it cannot.
    const customer = await createCustomer(adminApi, 'a11y', 'delivery');
    const page = await adminContext.newPage();
    await page.goto('/deliveries');

    await page.getByRole('button', { name: /new order/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const picker = dialog.getByRole('combobox', { name: /select customer/i });
    await picker.fill(customer.name.slice(0, 12));
    await expect(dialog.getByRole('option', { name: customer.name })).toBeVisible();

    await scan(page, 'delivery order dialog');
  });

  test('the collections grid has no high-impact violations', async ({ adminContext }) => {
    // #104: the card grids where edit/delete used to be nested inside a pressable card.
    // Neither page was scanned, which is why axe never reported it here.
    const page = await adminContext.newPage();
    await page.goto('/collections');
    await expect(page.getByRole('heading', { name: /collections/i }).first()).toBeVisible();

    await scan(page, 'collections');
  });

  test('the bundles grid has no high-impact violations', async ({ adminContext }) => {
    const page = await adminContext.newPage();
    await page.goto('/bundles');
    await expect(page.getByRole('heading', { name: /bundles/i }).first()).toBeVisible();

    await scan(page, 'bundles');
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

  test('an admin can create a delivery order without a pointer', async ({
    adminContext,
    adminApi,
    seedProduct,
  }) => {
    // #103: the customer picker used to be `<div onClick>` throughout, so this whole
    // workflow was unreachable from a keyboard — not degraded, impossible.
    const customer = await createCustomer(adminApi, 'a11y', 'kbddelivery');
    const product = await seedProduct('a11ykbddel', { price: 30, stock: 9 });
    const page = await adminContext.newPage();
    await page.goto('/deliveries');

    const trigger = page.getByRole('button', { name: /new order/i });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const picker = dialog.getByRole('combobox', { name: /select customer/i });
    await picker.focus();
    expect(await picker.evaluate((el) => el === document.activeElement)).toBe(true);
    await expect(picker).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.type(customer.name.slice(0, 12));
    await expect(picker).toHaveAttribute('aria-expanded', 'true');

    const option = dialog.getByRole('option', { name: customer.name });
    await expect(option).toBeVisible();
    // Arrow to the option and commit it: the combobox tracks the active option through
    // aria-activedescendant, so DOM focus never leaves the input.
    await expect
      .poll(
        async () => {
          const activeId = await picker.getAttribute('aria-activedescendant');
          const optionId = await option.getAttribute('id');
          if (activeId === optionId) return true;
          await page.keyboard.press('ArrowDown');
          return false;
        },
        { timeout: 10_000 }
      )
      .toBe(true);
    await page.keyboard.press('Enter');

    // Selecting a customer must actually populate the form the submit reads.
    await expect(dialog.getByLabel(/customer name/i)).toHaveValue(customer.name);
    await expect(dialog.getByLabel(/^phone$/i)).toHaveValue(customer.phone);
    await expect(option).toHaveCount(0);

    const address = dialog.getByLabel(/address/i);
    await address.focus();
    await page.keyboard.type('4 Jasmine Street');

    const productSearch = dialog.getByLabel('Search products');
    await productSearch.focus();
    await page.keyboard.type(product.sku);

    // A native select: closed-state arrow keys move the selection, which is the
    // keyboard interaction model this control already had and kept.
    const productSelect = dialog.locator('select').nth(1);
    await expect(productSelect.locator('option', { hasText: product.name })).toHaveCount(1);
    await productSelect.focus();
    await page.keyboard.press('ArrowDown');
    await expect(productSelect).not.toHaveValue('');

    const submit = dialog.getByRole('button', { name: /create order/i });
    await submit.focus();
    await page.keyboard.press('Enter');

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('cell', { name: customer.name })).toBeVisible();
  });

  test('filtering a table to nothing announces from a region that was already there', async ({
    adminContext,
  }) => {
    // #105: the empty state used to declare `role="status"` on the `<td>` itself, which
    // stopped the cell being a cell. axe scores the structure; this scores the behaviour.
    const page = await adminContext.newPage();
    await page.goto('/inventory');
    const table = page.getByRole('table').first();
    await expect(table).toBeVisible();

    const status = page.locator('[role="status"][aria-live="polite"]').first();
    await expect(status).toBeAttached();
    await expect(table.locator('td[role]')).toHaveCount(0);

    await page.getByRole('searchbox').first().fill('zzz-no-such-product-zzz');

    // The region was mounted before the rows went away, so this is a content change in
    // a live region rather than a region appearing with its message already in it.
    await expect(status).not.toHaveText('');
    await expect(table.locator('td[role]')).toHaveCount(0);
    await expect(page.getByRole('cell').first()).toBeVisible();
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
