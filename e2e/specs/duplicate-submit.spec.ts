/**
 * R8: prove in a real browser that a double interaction cannot create two sales.
 *
 * This is the coverage the plan exists for. The server's idempotency invariants are
 * already proven at the service layer against real PostgreSQL; what nothing proved is
 * whether the *browser* attaches `Idempotency-Key` at all. A server-side test supplies the
 * header itself and so can never detect its absence.
 *
 * **Which cases are cashier-reachable, and which are server-contract only.** The key is
 * derived from a payload fingerprint (`idempotencyKeyFor`): the stored key is reused only
 * while `JSON.stringify(saleData)` matches the previous attempt, and a changed cart mints
 * a fresh one. So the till can never send one key with a different payload, and
 * `IDEMPOTENCY_KEY_REUSED` is unreachable through any cashier interaction. Those cases are
 * still worth keeping, but they are driven by raw `fetch` and labelled as such — a later
 * reader must not mistake them for proof of UI behaviour the UI does not have.
 */
import { completeSaleAndReadId, countSalesForCashier, readStock } from '../support/assertSale';
import { cartPanel, checkoutDrawer, posPage, receiptDialog } from '../support/locators';
import { countPosts, gateResponses } from '../support/network';
import { dbQuery } from '../support/db';
import { API_BASE } from '../fixtures/seed';
import { expect, test } from '../fixtures/test';

const SALES_PATH = '/api/v1/sales';

test.describe('duplicate submission @smoke', () => {
  test('two rapid confirm clicks produce exactly one sale', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    const product = await seedProduct('double', { price: 55, stock: 10 });
    const stockBefore = await readStock(product.id);
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await cartPanel(page).checkout.click();

    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();

    const posts = countPosts(page, SALES_PATH);
    const gate = await gateResponses(page, SALES_PATH);

    // First click starts the request; the gate holds the response open so the second
    // click lands while it is genuinely in flight.
    await drawer.confirm.click();
    await gate.waitForFirst();

    // `confirmAny`, not `confirm`: the label has already swapped to "Processing…", so the
    // strict-name locator no longer matches and this would wait out its own timeout
    // instead of testing the guard. `force` for the same reason — a correctly-disabled
    // button must not block the click on actionability.
    await drawer.confirmAny.click({ force: true, timeout: 3000 }).catch(() => {});

    await gate.release();
    await expect(receiptDialog(page).dialog).toBeVisible();

    // Exactly one POST on the wire...
    await expect.poll(() => posts.count()).toBe(1);
    posts.stop();

    // ...exactly one row, and stock moved once.
    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore + 1);
    expect(await readStock(product.id)).toBe(stockBefore - 1);
  });

  test('every checkout POST carries an Idempotency-Key', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    // The single assertion a server-side test can never make. Strip the header from
    // `transport/http.ts` and this fails; without it the suite would prove nothing about
    // the browser's half of the idempotency contract.
    const product = await seedProduct('idemheader', { price: 33, stock: 5 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');
    await posPage(page).search.fill(product.sku);
    await posPage(page).productCard(product.sku).click();
    await cartPanel(page).checkout.click();

    const drawer = checkoutDrawer(page);
    await expect(drawer.dialog).toBeVisible();

    const posts = countPosts(page, SALES_PATH);
    await completeSaleAndReadId(page, workerCashier.id, drawer.confirm, receiptDialog(page).dialog);

    expect(posts.count()).toBe(1);
    const key = posts.headers()[0]?.['idempotency-key'];
    expect(key, 'the checkout POST must carry an Idempotency-Key').toBeTruthy();
    posts.stop();

    // And the server recorded exactly one claim for it.
    const rows = await dbQuery('SELECT key FROM idempotency_keys WHERE key = $1', [key]);
    expect(rows).toHaveLength(1);
  });
});

/**
 * Server-contract assertions, driven by raw `fetch` from inside the page so the session
 * and cookies are real. **None of these is reachable through the till** — see the file
 * header — and treating them as UI coverage would be a mistake.
 */
test.describe('idempotency contract (raw fetch, not cashier-reachable)', () => {
  test('two concurrent requests with one key return the same sale, replayed once', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    const product = await seedProduct('concurrent', { price: 20, stock: 10 });
    const salesBefore = await countSalesForCashier(workerCashier.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');

    const result = await page.evaluate(
      async ({ base, token, productId, key }) => {
        const body = JSON.stringify({
          items: [{ product_id: productId, quantity: 1, unit_price: 20 }],
          payment_method: 'Cash',
        });
        const send = () =>
          fetch(`${base}/sales`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${token}`,
              'Idempotency-Key': key,
            },
            body,
          }).then(async (r) => ({
            status: r.status,
            replay: r.headers.get('Idempotent-Replay'),
            body: await r.json(),
          }));
        return Promise.all([send(), send()]);
      },
      {
        base: API_BASE,
        token: workerCashier.accessToken,
        productId: product.id,
        key: `e2e-concurrent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }
    );

    const ids = result.map((r) => r.body?.data?.id ?? r.body?.data?.sale?.id);
    expect(new Set(ids.filter(Boolean)).size, 'both requests describe one sale').toBe(1);
    expect(await countSalesForCashier(workerCashier.id)).toBe(salesBefore + 1);
  });

  test('the same key with a different payload is refused as IDEMPOTENCY_KEY_REUSED', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    const product = await seedProduct('reuse', { price: 20, stock: 10 });
    const page = await cashierContext.newPage();
    await page.goto('/pos');

    const key = `e2e-reuse-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const second = await page.evaluate(
      async ({ base, token, productId, key: idemKey }) => {
        const post = (quantity: number) =>
          fetch(`${base}/sales`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${token}`,
              'Idempotency-Key': idemKey,
            },
            body: JSON.stringify({
              items: [{ product_id: productId, quantity, unit_price: 20 }],
              payment_method: 'Cash',
            }),
          }).then(async (r) => ({ status: r.status, body: await r.json() }));

        await post(1);
        return post(2);
      },
      { base: API_BASE, token: workerCashier.accessToken, productId: product.id, key }
    );

    expect(second.status).toBe(409);
    expect(JSON.stringify(second.body)).toContain('IDEMPOTENCY_KEY_REUSED');
  });

  test('a replay does not re-fire side effects', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    // The assertion that matters most for money: a replayed response must not decrement
    // stock again or move the register a second time.
    const product = await seedProduct('replay', { price: 20, stock: 10 });
    const stockBefore = await readStock(product.id);

    const page = await cashierContext.newPage();
    await page.goto('/pos');

    const key = `e2e-replay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const responses = await page.evaluate(
      async ({ base, token, productId, key: idemKey }) => {
        const post = () =>
          fetch(`${base}/sales`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${token}`,
              'Idempotency-Key': idemKey,
            },
            body: JSON.stringify({
              items: [{ product_id: productId, quantity: 2, unit_price: 20 }],
              payment_method: 'Cash',
            }),
          }).then(async (r) => ({
            status: r.status,
            replay: r.headers.get('Idempotent-Replay'),
            body: await r.json(),
          }));

        const first = await post();
        const replayed = await post();
        return { first, replayed };
      },
      { base: API_BASE, token: workerCashier.accessToken, productId: product.id, key }
    );

    // The `Idempotent-Replay` header is set by the server but is NOT readable here: the
    // browser is on the preview origin and `cors()` declares no `exposedHeaders`, so a
    // cross-origin response's custom headers are hidden from JS. No client code reads it
    // today, so this is a constraint on the test rather than a defect — but any future
    // feature that wants it will need the header exposed. Assert the substance instead:
    // both requests succeeded and the side effects happened exactly once.
    expect(responses.first.status).toBeLessThan(300);
    expect(responses.replayed.status).toBeLessThan(300);
    expect(responses.replayed.body?.data?.id ?? responses.replayed.body?.data?.sale?.id).toBe(
      responses.first.body?.data?.id ?? responses.first.body?.data?.sale?.id
    );

    // Stock moved once for two identical requests.
    expect(await readStock(product.id)).toBe(stockBefore - 2);

    const rows = await dbQuery('SELECT key FROM idempotency_keys WHERE key = $1', [key]);
    expect(rows, 'exactly one claim row for the key').toHaveLength(1);
  });

  test('a failed mutation releases its key so a corrected retry succeeds', async ({
    cashierContext,
    seedProduct,
    workerCashier,
  }) => {
    // The documented "a key identifies a committed outcome" semantic. Regressing it would
    // strand a cashier whose first attempt was rejected.
    const product = await seedProduct('release', { price: 20, stock: 1 });

    const page = await cashierContext.newPage();
    await page.goto('/pos');

    const key = `e2e-release-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await page.evaluate(
      async ({ base, token, productId, key: idemKey }) => {
        const post = (quantity: number) =>
          fetch(`${base}/sales`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${token}`,
              'Idempotency-Key': idemKey,
            },
            body: JSON.stringify({
              items: [{ product_id: productId, quantity, unit_price: 20 }],
              payment_method: 'Cash',
            }),
          }).then(async (r) => ({ status: r.status, body: await r.json() }));

        // Oversell first — the server must reject it and release the key.
        const failed = await post(99);
        // Then the same key with a payload that fits the stock.
        const corrected = await post(1);
        return { failed, corrected };
      },
      { base: API_BASE, token: workerCashier.accessToken, productId: product.id, key }
    );

    expect(result.failed.status, 'the oversell must be rejected').toBeGreaterThanOrEqual(400);
    expect(result.corrected.status, 'the corrected retry must succeed').toBeLessThan(300);
  });
});
