/**
 * Exchange stock invariants under real concurrency.
 *
 * An exchange mutates stock twice — restocking what came back and deducting what went
 * out. Sorting those two phases separately is not enough: an exchange returning product 5
 * and taking product 2 would lock 5 then 2, while one returning 2 and taking 5 locks 2
 * then 5. Opposite orders on the same pair is a deadlock, so the write phase has to sort
 * the union of both sides, and it has to agree with the checkout path's ordering too.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { exchangesService, ExchangeStockError } from '../../src/modules/pos/exchanges/service';
import { salesService } from '../../src/modules/pos/sales/service';
import { INSUFFICIENT_STOCK_CODE } from '../../src/modules/pos/sales/types';

describeWithPostgres('exchange stock under concurrency', () => {
  let harness: RealPostgresHarness;
  let cashierId: number;
  let saleId: number;

  beforeAll(async () => {
    harness = await setupRealPostgres('exchanges-concurrency', { maxConnections: 10 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    const users = await harness.pool.query<{ id: number }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Cashier', 'c@moon.com', 'x', 'Cashier') RETURNING id"
    );
    cashierId = users.rows[0].id;

    const sales = await harness.pool.query<{ id: number }>(
      'INSERT INTO sales (total, payment_method, cashier_id) VALUES (0, $1, $2) RETURNING id',
      ['Cash', cashierId]
    );
    saleId = sales.rows[0].id;
  });

  async function makeProduct(sku: string, stock: number): Promise<number> {
    const { rows } = await harness.pool.query<{ id: number }>(
      'INSERT INTO products (name, sku, price, stock) VALUES ($1, $2, 100, $3) RETURNING id',
      [`Product ${sku}`, sku, stock]
    );
    return rows[0].id;
  }

  async function stockOf(productId: number): Promise<number> {
    const { rows } = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return Number(rows[0].stock);
  }

  function exchange(returnedId: number, newId: number, quantity = 1) {
    return exchangesService.createExchange(
      {
        original_sale_id: saleId,
        returned_items: [{ product_id: returnedId, quantity, price: 100, condition: 'good' }],
        new_items: [{ product_id: newId, quantity, price: 100 }],
        payment_method: 'cash',
      } as never,
      cashierId
    );
  }

  it('restocks the returned line and deducts the new one', async () => {
    const returned = await makeProduct('SKU-R', 5);
    const taken = await makeProduct('SKU-T', 5);

    await exchange(returned, taken);

    expect(await stockOf(returned)).toBe(6);
    expect(await stockOf(taken)).toBe(4);
  });

  it('does not restock a damaged return', async () => {
    const returned = await makeProduct('SKU-DMG', 5);
    const taken = await makeProduct('SKU-OK', 5);

    await exchangesService.createExchange(
      {
        original_sale_id: saleId,
        returned_items: [{ product_id: returned, quantity: 1, price: 100, condition: 'damaged' }],
        new_items: [{ product_id: taken, quantity: 1, price: 100 }],
        payment_method: 'cash',
      } as never,
      cashierId
    );

    expect(await stockOf(returned)).toBe(5);
    expect(await stockOf(taken)).toBe(4);
  });

  it('rejects a new line exceeding stock and rolls the returned restock back', async () => {
    const returned = await makeProduct('SKU-BACK', 5);
    const taken = await makeProduct('SKU-GONE', 1);

    await expect(exchange(returned, taken, 3)).rejects.toBeInstanceOf(ExchangeStockError);

    // The whole exchange rolled back — the return never re-entered stock.
    expect(await stockOf(returned)).toBe(5);
    expect(await stockOf(taken)).toBe(1);

    const exchanges = await harness.pool.query('SELECT id FROM exchanges');
    expect(exchanges.rows).toHaveLength(0);
  });

  it('reports insufficient stock with the same code as the checkout path', async () => {
    const returned = await makeProduct('SKU-C1', 5);
    const taken = await makeProduct('SKU-C2', 0);

    const error = (await exchange(returned, taken).catch((e: unknown) => e)) as ExchangeStockError;

    expect(error).toBeInstanceOf(ExchangeStockError);
    expect(error.code).toBe(INSUFFICIENT_STOCK_CODE);
    expect(error.statusCode).toBe(400);
  });

  it('does not deadlock when two exchanges swap which product is returned vs taken', async () => {
    const low = await makeProduct('SKU-LOW', 50);
    const high = await makeProduct('SKU-HIGH', 50);
    expect(high).toBeGreaterThan(low);

    // A returns the higher id and takes the lower; B does the reverse. Sorting each
    // phase on its own would lock (high, low) against (low, high) here.
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => (i % 2 === 0 ? exchange(high, low) : exchange(low, high)))
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        expect(String(result.reason?.message ?? result.reason)).not.toMatch(/deadlock/i);
      }
    }
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    // Four of each direction: every product is returned 4 times and taken 4 times.
    expect(await stockOf(low)).toBe(50);
    expect(await stockOf(high)).toBe(50);
  });

  it('does not deadlock against concurrent checkouts touching the same two products', async () => {
    const low = await makeProduct('SKU-X1', 100);
    const high = await makeProduct('SKU-X2', 100);

    const checkout = () =>
      salesService.executeSale(
        {
          items: [
            { product_id: high, quantity: 1, unit_price: 100 },
            { product_id: low, quantity: 1, unit_price: 100 },
          ],
          payment_method: 'Cash',
        } as never,
        cashierId
      );

    // The exchange locks (returned=high, taken=low); the checkout sorts ascending. Both
    // must resolve to the same canonical order or these deadlock against each other.
    const results = await Promise.allSettled([
      exchange(high, low),
      checkout(),
      exchange(high, low),
      checkout(),
      exchange(low, high),
      checkout(),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        expect(String(result.reason?.message ?? result.reason)).not.toMatch(/deadlock/i);
      }
    }
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });
});
