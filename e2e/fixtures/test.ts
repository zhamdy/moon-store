/**
 * The extended `test` every spec imports.
 *
 * The isolation model (D4): each worker owns a cashier, a shift, a register and a
 * namespace. Register sessions and shifts are per *user*, so a per-worker cashier
 * isolates them for free — which is why sharing the seeded `sarah@moon.com` is
 * forbidden rather than merely discouraged.
 */
import {
  test as base,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test';
import { API_URL } from '../support/config';
import { DEFAULT_TEST_LOCALE, type Locale } from '../support/i18n';
import { readAdminAccessToken } from './adminToken';
import { adminStatePath } from './authPaths';
import {
  WORKER_PASSWORD,
  clockIn,
  createProduct,
  createUser,
  login,
  openRegister,
  type ProductSeed,
} from './seed';
import { authStorageValue, dismissStartupPrompt, seedLocale, AUTH_STORAGE_KEY } from './storage';
import type { Product, RegisterSession, Shift, WorkerCashier } from './types';

export const OPENING_FLOAT = 500;

export interface WorkerFixtures {
  /** An API context carrying an admin bearer token, for seeding and read-back. */
  adminApi: APIRequestContext;
  /** This worker's own cashier, with an open shift and register. */
  workerCashier: WorkerCashier;
  workerShift: Shift;
  workerRegister: RegisterSession;
}

export interface TestFixtures {
  /**
   * App locale the browser context is pinned to. Named `appLocale`, not `locale`:
   * Playwright already owns a `locale` option for the browser's Accept-Language, and
   * this is the app's own `moon-settings` value. Override per spec for the RTL case.
   */
  appLocale: Locale;
  /** Skip the shift/register gate. Off for the spec that drives the prompt for real. */
  skipStartupPrompt: boolean;
  /** A context already authenticated as this worker's cashier. */
  cashierContext: BrowserContext;
  /** Mints a product owned by this test, namespaced so no other spec can see it. */
  seedProduct: (label: string, seed?: ProductSeed) => Promise<Product>;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  adminApi: [
    // Playwright inspects this parameter's destructuring pattern to discover fixture
    // dependencies, so it must stay an object pattern even when it depends on nothing.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      // Reads the token the setup project already obtained rather than logging in again.
      // Concurrent logins as the same user collide on the refresh token's UNIQUE
      // constraint and return 500 — see `adminToken.ts` and issue #62.
      const accessToken = readAdminAccessToken();
      const context = await playwrightRequest.newContext({
        baseURL: API_URL,
        extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
      });
      await use(context);
      await context.dispose();
    },
    { scope: 'worker' },
  ],

  workerCashier: [
    async ({ adminApi }, use, workerInfo) => {
      const index = workerInfo.workerIndex;
      const namespace = `e2e-w${index}`;
      const email = `${namespace}@moon.test`;
      const name = `E2E Worker ${index}`;

      /**
       * Refresh tokens are `jwt.sign({ id }, …, { expiresIn: '7d' })` — user id plus
       * second-resolution `iat`/`exp`, no jti — stored in `refresh_tokens.token UNIQUE`.
       * Two logins as the *same* user inside one second produce a byte-identical token,
       * so the second insert fails on 23505, and because the tokens are identical a
       * logout would revoke every holder's session. Worker startup is exactly that burst.
       *
       * Each worker logging in as its *own* cashier sidesteps this entirely. This is a
       * pre-existing server defect (issue #62), not one the suite introduces.
       */
      let cashier;
      try {
        cashier = await createUser(adminApi, '', {
          name,
          email,
          password: WORKER_PASSWORD,
          role: 'Cashier',
        });
      } catch (err) {
        throw new Error(
          `Worker ${index}: could not create its cashier (${email}). ` +
            'Every other fixture depends on it, so failing here rather than letting the ' +
            `specs fail later on a missing register.\n${String(err)}`
        );
      }

      const session = await login(adminApi, email, WORKER_PASSWORD);

      await use({
        id: cashier.id,
        name,
        email,
        password: WORKER_PASSWORD,
        workerIndex: index,
        namespace,
        accessToken: session.accessToken,
      });
    },
    { scope: 'worker' },
  ],

  workerShift: [
    async ({ workerCashier }, use) => {
      const context = await playwrightRequest.newContext({ baseURL: API_URL });
      const shift = await clockIn(context, workerCashier.accessToken);
      await use(shift);
      await context.dispose();
    },
    { scope: 'worker' },
  ],

  workerRegister: [
    async ({ workerCashier, workerShift: _shift }, use) => {
      const context = await playwrightRequest.newContext({ baseURL: API_URL });
      const register = await openRegister(context, workerCashier.accessToken, OPENING_FLOAT);
      await use(register);
      await context.dispose();
    },
    { scope: 'worker' },
  ],

  appLocale: [DEFAULT_TEST_LOCALE, { option: true }],
  skipStartupPrompt: [true, { option: true }],

  cashierContext: async (
    { browser, appLocale, skipStartupPrompt, workerCashier, workerRegister: _register },
    use
  ) => {
    const context = await browser.newContext();
    await seedLocale(context, appLocale);
    if (skipStartupPrompt) await dismissStartupPrompt(context);

    const authValue = authStorageValue(
      {
        id: workerCashier.id,
        name: workerCashier.name,
        email: workerCashier.email,
        role: 'Cashier',
      },
      workerCashier.accessToken
    );
    await context.addInitScript(
      ([key, json]) => {
        window.localStorage.setItem(key as string, json as string);
      },
      [AUTH_STORAGE_KEY, authValue]
    );

    await use(context);
    await context.close();
  },

  seedProduct: async ({ adminApi, workerCashier }, use, testInfo) => {
    const created: Product[] = [];
    const testTag = testInfo.testId.slice(0, 8);

    await use(async (label, seed) => {
      const product = await createProduct(
        adminApi,
        '',
        `${workerCashier.namespace}-t${testTag}`,
        label,
        seed
      );
      created.push(product);
      return product;
    });

    // Best-effort: the E2E database is disposable, and a failed cleanup must never fail a
    // passing test.
    for (const product of created) {
      await adminApi.delete(`/api/v1/products/${product.id}`).catch(() => {});
    }
  },
});

export { expect, adminStatePath };
