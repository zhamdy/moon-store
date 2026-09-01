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
import { API_URL, BASE_URL } from '../support/config';
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
import type { Product, RegisterSession, Shift, StorageState, WorkerCashier } from './types';

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
  /** A throwaway cashier with no shift and no register, for the startup-gate path. */
  freshCashierContext: {
    context: BrowserContext;
    id: number;
    email: string;
    accessToken: string;
  };
  /** Mints a product owned by this test, namespaced so no other spec can see it. */
  seedProduct: (label: string, seed?: ProductSeed) => Promise<Product>;
  /**
   * A browser context signed in as the seeded Admin, reusing the setup project's
   * storage state so no second login is needed (issue #62).
   *
   * Needed only where a path is genuinely Admin-gated. `GET /api/v1/customers` is one:
   * a Cashier can create a customer and read their loyalty balance but cannot *search*
   * for one, so attaching a customer to a sale — and therefore loyalty redemption — is
   * not reachable from a cashier's till. That asymmetry looks like an oversight rather
   * than a policy, but widening an authorization rule is not this suite's call, so the
   * loyalty specs drive it as Admin and `tax-loyalty.spec.ts` pins the gap explicitly.
   */
  adminContext: BrowserContext;
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
      /**
       * Namespaced by run as well as worker. `--shard` is a separate Playwright process
       * per shard and `workerIndex` restarts at 0 in each, so shard 1's worker 0 and
       * shard 2's worker 0 would otherwise both claim `e2e-w0@moon.test` — and
       * `users.email` is UNIQUE, so the loser fails with a confusing 409 mid-run.
       * CI sets E2E_RUN_ID per shard; locally it is absent and the name is unchanged.
       */
      const runId = process.env.E2E_RUN_ID?.trim();
      const namespace = runId ? `e2e-${runId}w${index}` : `e2e-w${index}`;
      const email = `${namespace}@moon.test`;
      const name = `E2E Worker ${runId ? `${runId}/` : ''}${index}`;

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
        cashier = await createUser(adminApi, {
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

      // Logged in through its own context so the `Set-Cookie` carrying the refresh token
      // lands in a jar this fixture can read. `adminApi` would swallow it into the admin
      // context's jar, and the browser would then have no way to refresh.
      const loginContext = await playwrightRequest.newContext({ baseURL: API_URL });
      const session = await login(loginContext, email, WORKER_PASSWORD);
      const { cookies } = await loginContext.storageState();
      await loginContext.dispose();

      const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
      if (!refreshCookie) {
        throw new Error(
          `Worker ${index}: login as ${email} returned no refreshToken cookie. ` +
            'Without it the client cannot refresh an expired access token, and specs ' +
            'would redirect to /login partway through the run.'
        );
      }

      const storageState: StorageState = {
        cookies,
        origins: [
          {
            origin: BASE_URL,
            localStorage: [
              {
                name: AUTH_STORAGE_KEY,
                value: authStorageValue(
                  { id: cashier.id, name, email, role: 'Cashier' },
                  session.accessToken
                ),
              },
            ],
          },
        ],
      };

      await use({
        id: cashier.id,
        name,
        email,
        password: WORKER_PASSWORD,
        workerIndex: index,
        namespace,
        accessToken: session.accessToken,
        storageState,
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

  /**
   * A context holding a *complete* session: the `moon-auth` localStorage entry **and**
   * the httpOnly `refreshToken` cookie.
   *
   * Both halves matter. Seeding only the access token would leave the app unable to
   * refresh — `client.ts`'s 401 interceptor would POST to `/auth/refresh` with no cookie,
   * fail, and redirect to `/login` mid-spec once the 15-minute token expired. And
   * `addInitScript` re-runs on *every* navigation, so injecting the token that way would
   * additionally overwrite any rotated token the app had just stored, defeating refresh
   * even when the cookie was present. `storageState` is applied once at context creation,
   * which is the behavior this needs.
   */
  cashierContext: async (
    { browser, appLocale, skipStartupPrompt, workerCashier, workerRegister: _register },
    use
  ) => {
    const context = await browser.newContext({ storageState: workerCashier.storageState });
    await seedLocale(context, appLocale);
    if (skipStartupPrompt) await dismissStartupPrompt(context);

    await use(context);
    await context.close();
  },

  /**
   * A cashier with **no shift and no register**, and a context logged in as them.
   *
   * The register-readiness path needs its own identity, and this is not a detail. The
   * worker cashier already has both open (that is the point of `workerRegister`), so it
   * has nothing for `StartupPrompt` to do — and suppressing `moon-startup-dismissed` is
   * not the same as genuinely having no open shift. Driving the shared seeded
   * `sarah@moon.com` instead would violate the per-worker ownership rule and race any
   * other worker on the same drawer.
   *
   * So this mints a throwaway cashier per test. Every *other* spec uses `cashierContext`.
   */
  freshCashierContext: async ({ adminApi, browser, appLocale }, use, testInfo) => {
    const tag = `${testInfo.testId.slice(0, 8)}${Math.random().toString(36).slice(2, 6)}`;
    const email = `e2e-fresh-${tag}@moon.test`;
    const name = `E2E Fresh ${tag}`;

    const cashier = await createUser(adminApi, {
      name,
      email,
      password: WORKER_PASSWORD,
      role: 'Cashier',
    });

    const loginContext = await playwrightRequest.newContext({ baseURL: API_URL });
    const session = await login(loginContext, email, WORKER_PASSWORD);
    const { cookies } = await loginContext.storageState();
    await loginContext.dispose();

    const context = await browser.newContext({
      storageState: {
        cookies,
        origins: [
          {
            origin: BASE_URL,
            localStorage: [
              {
                name: AUTH_STORAGE_KEY,
                value: authStorageValue(
                  { id: cashier.id, name, email, role: 'Cashier' },
                  session.accessToken
                ),
              },
            ],
          },
        ],
      },
    });
    await seedLocale(context, appLocale);
    // Deliberately NOT dismissing the startup prompt — this fixture exists to face it.

    await use({ context, id: cashier.id, email, accessToken: session.accessToken });
    await context.close();
  },

  adminContext: async ({ browser, appLocale }, use) => {
    const context = await browser.newContext({ storageState: adminStatePath });
    await seedLocale(context, appLocale);
    await dismissStartupPrompt(context);
    await use(context);
    await context.close();
  },

  seedProduct: async ({ adminApi, workerCashier }, use, testInfo) => {
    const created: Product[] = [];
    const testTag = testInfo.testId.slice(0, 8);

    await use(async (label, seed) => {
      const product = await createProduct(adminApi, {
        namespace: `${workerCashier.namespace}-t${testTag}`,
        label,
        ...seed,
      });
      created.push(product);
      return product;
    });

    // `DELETE /products/:id` is a *soft* delete — it sets status='discontinued'. The rows,
    // SKUs and barcodes survive the whole run, which is safe only because every seeded SKU
    // carries a timestamp+random suffix. A spec needing a fixed barcode must namespace it
    // the same way rather than assuming this removed anything.
    //
    // Best-effort: the E2E database is disposable and a failed cleanup must never fail a
    // passing test. `.delete()` resolves for any HTTP status, so a broken cleanup would
    // otherwise be completely silent — hence the explicit status check.
    for (const product of created) {
      const response = await adminApi.delete(`/api/v1/products/${product.id}`).catch(() => null);
      if (response && !response.ok()) {
        console.warn(`[e2e] could not discontinue product ${product.sku}: ${response.status()}`);
      }
    }
  },
});

export { expect, adminStatePath };
