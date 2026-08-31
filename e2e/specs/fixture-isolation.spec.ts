/**
 * The isolation spec, written *before* any real spec on purpose.
 *
 * A fixture bug discovered later does not look like a fixture bug — it looks like a flaky
 * application bug, and costs far more to diagnose than to prevent. Everything in Phases 2
 * and 3 assumes what this file asserts.
 */
import { dbOne, dbQuery } from '../support/db';
import { getJson } from '../fixtures/seed';
import { OPENING_FLOAT, expect, test } from '../fixtures/test';
import type { RegisterSession, Shift } from '../fixtures/types';

test.describe('worker isolation', () => {
  test('the worker owns a cashier with an open shift and register before any test body', async ({
    workerCashier,
    workerShift,
    workerRegister,
  }) => {
    expect(workerCashier.email).toBe(`e2e-w${workerCashier.workerIndex}@moon.test`);
    expect(workerShift.status).toBe('active');
    expect(workerShift.user_id).toBe(workerCashier.id);
    expect(workerRegister.status).toBe('open');
    expect(workerRegister.cashier_id).toBe(workerCashier.id);
    // pg NUMERIC arrives as a string; compare numerically, never by identity.
    expect(Number(workerRegister.opening_float)).toBe(OPENING_FLOAT);
  });

  test('the register is retrievable at register/current with its opening float', async ({
    workerCashier,
    workerRegister,
    request,
  }) => {
    const current = await getJson<RegisterSession>(
      request,
      workerCashier.accessToken,
      'register/current'
    );
    expect(current.id).toBe(workerRegister.id);
    expect(Number(current.opening_float)).toBe(OPENING_FLOAT);
  });

  test('the shift is retrievable at shifts/current', async ({
    workerCashier,
    // Declared even though it is not read: Playwright fixtures are lazy, so without this
    // no shift is clocked in and `shifts/current` correctly returns `{ data: null }` —
    // which reads as an application bug rather than as a missing dependency.
    workerShift: _shift,
    request,
  }) => {
    const current = await getJson<Shift>(request, workerCashier.accessToken, 'shifts/current');
    expect(current.status).toBe('active');
    expect(current.user_id).toBe(workerCashier.id);
  });

  test('no other worker shares this cashier’s open register', async ({
    workerCashier,
    workerRegister: _register,
  }) => {
    // Scoped to this cashier — never "the count of open registers", which is a global
    // aggregate and would race every other worker.
    const rows = await dbQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM register_sessions
        WHERE cashier_id = $1 AND status = 'open'`,
      [workerCashier.id]
    );
    expect(Number(rows[0]?.n)).toBe(1);
  });

  test('every worker cashier is a distinct user row', async ({ workerCashier }) => {
    const rows = await dbQuery<{ id: number; email: string }>(
      `SELECT id, email FROM users WHERE email LIKE 'e2e-w%@moon.test'`
    );
    const emails = rows.map((r) => r.email);
    expect(new Set(emails).size).toBe(emails.length);
    expect(emails).toContain(workerCashier.email);
  });
});

test.describe('per-test data ownership', () => {
  test('a seeded product is namespaced to this worker and test', async ({
    seedProduct,
    workerCashier,
  }) => {
    const product = await seedProduct('alpha', { price: 250, stock: 7 });

    expect(product.sku).toContain(workerCashier.namespace.toUpperCase());
    expect(product.stock).toBe(7);

    // The direct read and the API must observe the same row — this is the D8 loop the
    // money specs depend on.
    const row = await dbOne<{ sku: string; stock: number }>(
      'SELECT sku, stock FROM products WHERE id = $1',
      [product.id]
    );
    expect(row?.sku).toBe(product.sku);
    expect(Number(row?.stock)).toBe(7);
  });

  test('two products seeded in one test never collide on SKU', async ({ seedProduct }) => {
    // `products.sku` and `products.barcode` are UNIQUE; a collision surfaces as a
    // confusing 409 mid-test rather than as an obvious fixture bug.
    const [a, b] = await Promise.all([seedProduct('one'), seedProduct('two')]);
    expect(a.sku).not.toBe(b.sku);
  });
});

test.describe('browser context seeding', () => {
  test('the cashier context loads /pos without a login redirect', async ({ cashierContext }) => {
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await expect(page).toHaveURL(/\/pos/);
  });

  test('locale is pinned to en, overriding the shipped Arabic default', async ({
    cashierContext,
  }) => {
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('the startup prompt is dismissed via sessionStorage, not storageState', async ({
    cashierContext,
  }) => {
    // `storageState` serializes cookies and localStorage only. If this ever regresses to
    // being seeded through storage state it will silently do nothing, and every spec
    // meant to skip the gate would sit behind it looking like an app bug.
    const page = await cashierContext.newPage();
    await page.goto('/pos');
    const dismissed = await page.evaluate(() =>
      window.sessionStorage.getItem('moon-startup-dismissed')
    );
    expect(dismissed).toBe('1');
  });
});
