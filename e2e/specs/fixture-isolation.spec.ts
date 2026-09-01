/**
 * The isolation spec, written *before* any real spec on purpose.
 *
 * A fixture bug discovered later does not look like a fixture bug — it looks like a flaky
 * application bug, and costs far more to diagnose than to prevent. Everything in Phases 2
 * and 3 assumes what this file asserts.
 */
import { dbOne, dbQuery } from '../support/db';
import { getJson } from '../fixtures/seed';
import { AUTH_STORAGE_KEY, STARTUP_DISMISSED_KEY } from '../fixtures/storage';
import { OPENING_FLOAT, expect, test } from '../fixtures/test';
import type { RegisterSession, Shift } from '../fixtures/types';

test.describe('worker isolation', () => {
  test('the worker owns a cashier with an open shift and register before any test body', async ({
    workerCashier,
    workerShift,
    workerRegister,
  }) => {
    /**
     * The namespace carries this worker's index, and the email is derived from it.
     *
     * Deliberately not `e2e-w{index}@moon.test`: under `--shard` the namespace is prefixed
     * with the run id (`e2e-s1w3`), because `workerIndex` restarts at 0 in every shard and
     * `users.email` is UNIQUE. Hardcoding the unsharded form made this spec pass locally
     * and fail on the first real sharded run — the assertion has to follow the same rule
     * the fixture does.
     */
    expect(workerCashier.namespace).toMatch(new RegExp(`w${workerCashier.workerIndex}$`));
    expect(workerCashier.email).toBe(`${workerCashier.namespace}@moon.test`);
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

  test('this worker’s cashier owns its own shift and register, not a shared one', async ({
    workerCashier,
    workerShift,
    workerRegister,
  }) => {
    // Deliberately not "all worker emails are unique" — `users.email` is UNIQUE, so the
    // database makes that impossible to violate and the assertion could never fail. What
    // *can* break is two workers ending up on the same cashier's drawer, so assert the
    // ownership chain instead.
    const shiftOwners = await dbQuery<{ user_id: number }>(
      'SELECT user_id FROM shifts WHERE id = $1',
      [workerShift.id]
    );
    expect(shiftOwners[0]?.user_id).toBe(workerCashier.id);

    const registerOwners = await dbQuery<{ cashier_id: number }>(
      'SELECT cashier_id FROM register_sessions WHERE id = $1',
      [workerRegister.id]
    );
    expect(registerOwners[0]?.cashier_id).toBe(workerCashier.id);

    // And no other e2e worker account shares this cashier's id.
    const sharing = await dbQuery<{ n: string }>(
      `SELECT count(*)::text AS n FROM users
        WHERE id = $1 AND email <> $2 AND email LIKE 'e2e-%@moon.test'`,
      [workerCashier.id, workerCashier.email]
    );
    expect(Number(sharing[0]?.n)).toBe(0);
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

  test('the session carries the refresh cookie, not just the access token', async ({
    cashierContext,
  }) => {
    // Half a session is worse than none: without the httpOnly refresh cookie the client's
    // 401 interceptor cannot refresh, and every spec still running after the 15-minute
    // access token expires would redirect to /login and fail as an auth regression.
    const cookies = await cashierContext.cookies();
    expect(cookies.map((c) => c.name)).toContain('refreshToken');

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), AUTH_STORAGE_KEY);
    expect(stored).toBeTruthy();
  });

  test('the startup gate is actually skipped, not merely flagged', async ({ cashierContext }) => {
    // Asserting the sessionStorage value would only prove the init script ran — it would
    // stay green if `StartupPrompt` renamed its key or changed its sentinel, while every
    // POS spec sat behind an undismissed modal. Assert the observable effect instead, and
    // read the key from the shared constant rather than a fourth copy of the literal.
    const page = await cashierContext.newPage();
    await page.goto('/pos');

    await expect(page.getByRole('dialog')).toHaveCount(0);

    const dismissed = await page.evaluate(
      (key) => window.sessionStorage.getItem(key),
      STARTUP_DISMISSED_KEY
    );
    expect(dismissed).toBe('1');
  });
});
