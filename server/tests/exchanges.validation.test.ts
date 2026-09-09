/**
 * Exchanges may only take back what the named sale actually sold (#122).
 *
 * `writeExchange` credited `price` from the request and never checked that a returned
 * line was ever on the sale. A cashier could hand back goods the shop had not sold, at a
 * figure they chose: the exchange paid for them AND restocked them, so both money and
 * inventory appeared out of nothing. Capping only exchanges would still leave the
 * double-recovery path the issue notes -- refund a line, then exchange the same line --
 * so prior refunds count against the same sold quantity.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { ExchangesRepository } from '../src/modules/pos/exchanges/repository';
import { ExchangesService } from '../src/modules/pos/exchanges/service';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

describe('exchange returned-item validation (#122)', () => {
  let testPool: PgPool;
  const repo = new ExchangesRepository();
  const service = new ExchangesService(repo);
  let saleId: number;

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM exchange_returned_items');
    await testPool.query('DELETE FROM exchange_new_items');
    await testPool.query('DELETE FROM exchanges');
    await testPool.query('DELETE FROM refunds');
    await testPool.query('DELETE FROM sale_items');
    await testPool.query('DELETE FROM sales');
    await testPool.query('DELETE FROM products');
    await testPool.query('DELETE FROM users');

    await testPool.query(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (1, 'Cashier', 'c@moon.com', 'x', 'Cashier')"
    );
    await testPool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (1, 'Silk Dress', 'SKU-001', 500, 250, 10),
              (2, 'Cotton Shirt', 'SKU-002', 200, 100, 10),
              (3, 'Never Sold', 'SKU-003', 900, 400, 10)`
    );

    // A sale of 2 dresses at 500 and 1 shirt at 200.
    const sale = await testPool.query<{ id: number }>(
      `INSERT INTO sales (subtotal, total, payment_method, cashier_id)
       VALUES (1200, 1200, 'Cash', 1) RETURNING id`
    );
    saleId = sale.rows[0].id;
    await testPool.query(
      `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price)
       VALUES ($1, 1, 2, 500), ($1, 2, 1, 200)`,
      [saleId]
    );
  });

  const exchange = (returned: unknown[], newItems: unknown[] = []) => ({
    original_sale_id: saleId,
    returned_items: returned as never,
    new_items: newItems as never,
  });

  const returned = (productId: number, quantity = 1, price = 10) => ({
    product_id: productId,
    quantity,
    price,
    reason: 'size',
    condition: 'good' as const,
  });

  async function stockOf(productId: number): Promise<number> {
    const { rows } = await testPool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return Number(rows[0].stock);
  }

  it('refuses a return of goods that were never on the sale (#122 repro)', async () => {
    await expect(service.createExchange(exchange([returned(3)]), 1)).rejects.toMatchObject({
      name: 'PublicError',
      code: 'VALIDATION_ERROR',
    });

    // Neither the ledger nor the shelf gained anything from the attempt.
    expect((await testPool.query('SELECT * FROM exchanges')).rows).toHaveLength(0);
    expect(await stockOf(3)).toBe(10);
  });

  it('refuses more units than the sale sold of that line', async () => {
    await expect(
      service.createExchange(exchange([returned(1, 3)])) // 2 were sold
    ).rejects.toThrow(/exceeds what remains of product 1/);
  });

  it('aggregates duplicate entries for one line before capping', async () => {
    // Two entries of 2 each pass an individual check against the 2 sold and together
    // take back twice what was bought.
    await expect(
      service.createExchange(exchange([returned(1, 2), returned(1, 2)]), 1)
    ).rejects.toThrow(/exceeds what remains of product 1/);
  });

  it('credits the price the line actually sold for, not the one in the request', async () => {
    const created = await service.createExchange(exchange([returned(1, 1, 99999)]), 1);

    // Sold at 500; the request said 99999.
    expect(Number(created.return_total)).toBe(500);
  });

  it('counts an earlier exchange of the same line against what is left', async () => {
    await service.createExchange(exchange([returned(1, 2)]), 1); // takes both dresses

    await expect(service.createExchange(exchange([returned(1, 1)]), 1)).rejects.toThrow(
      /exceeds what remains of product 1 \(0 remaining\)/
    );
  });

  it('counts an earlier REFUND of the same line against what is left (#122 double recovery)', async () => {
    // The goods came back through the refund endpoint. Exchanging them again would
    // recover the same units twice -- once as cash, once as credit plus stock.
    await testPool.query(
      `INSERT INTO refunds (sale_id, amount, reason, items, restock, cashier_id)
       VALUES ($1, 1000, 'Returned', $2, 1, 1)`,
      [saleId, JSON.stringify([{ product_id: 1, quantity: 2, unit_price: 500 }])]
    );

    await expect(service.createExchange(exchange([returned(1, 1)]), 1)).rejects.toThrow(
      /exceeds what remains of product 1 \(0 remaining\)/
    );
  });

  it('allows what genuinely remains after a partial refund', async () => {
    await testPool.query(
      `INSERT INTO refunds (sale_id, amount, reason, items, restock, cashier_id)
       VALUES ($1, 500, 'Returned', $2, 1, 1)`,
      [saleId, JSON.stringify([{ product_id: 1, quantity: 1, unit_price: 500 }])]
    );

    // One dress of the two is still the customer's to bring back.
    const created = await service.createExchange(exchange([returned(1, 1)]), 1);
    expect(Number(created.return_total)).toBe(500);
  });

  it('prices the goods going OUT from the catalog, not from the request', async () => {
    // The returned side was the reported defect, but `new_items` carried the caller's
    // price too: an exchange could take real stock out at 0.01 a unit and pay the
    // difference out as store credit.
    const created = await service.createExchange(
      exchange([returned(1, 1)], [{ product_id: 2, quantity: 1, price: 0.01 }]),
      1
    );

    // Cotton Shirt is 200 in the catalog.
    expect(Number(created.new_total)).toBe(200);
    // 200 out, 500 back: the shop owes the customer 300.
    expect(Number(created.difference)).toBe(-300);
  });

  it('persists the sold price on the returned line, not the fabricated one', async () => {
    const created = await service.createExchange(exchange([returned(1, 1, 99999)]), 1);

    // A row storing a price the header does not use would contradict it, and any report
    // summing these rows would be wrong.
    const { rows } = await testPool.query<{ price: string }>(
      'SELECT price FROM exchange_returned_items WHERE exchange_id = $1',
      [created.id]
    );
    expect(Number(rows[0].price)).toBe(500);
  });

  it('counts a historical refund stored without variant_id against the variant line', async () => {
    // Refund lines only started carrying variant_id in the refund-integrity work, so a
    // variant line refunded before that sits under the product-only key. Keyed strictly
    // per line, that prior reads as zero and the same unit is recoverable twice.
    await testPool.query(
      `INSERT INTO product_variants (id, product_id, sku, price, stock, attributes)
       VALUES (10, 1, 'SKU-001-RED', 500, 4, '{"color":"Red"}')`
    );
    const sale = await testPool.query<{ id: number }>(
      `INSERT INTO sales (subtotal, total, payment_method, cashier_id)
       VALUES (500, 500, 'Cash', 1) RETURNING id`
    );
    const variantSaleId = sale.rows[0].id;
    await testPool.query(
      `INSERT INTO sale_items (sale_id, product_id, variant_id, quantity, unit_price)
       VALUES ($1, 1, 10, 1, 500)`,
      [variantSaleId]
    );
    await testPool.query(
      `INSERT INTO refunds (sale_id, amount, reason, items, restock, cashier_id)
       VALUES ($1, 500, 'Returned', $2, 1, 1)`,
      // No variant_id, exactly as a pre-#121 refund recorded it.
      [variantSaleId, JSON.stringify([{ product_id: 1, quantity: 1, unit_price: 500 }])]
    );

    await expect(
      service.createExchange(
        {
          original_sale_id: variantSaleId,
          returned_items: [{ ...returned(1, 1), variant_id: 10 }] as never,
          new_items: [] as never,
        },
        1
      )
    ).rejects.toThrow(/exceeds what remains of product 1/);
  });

  it('sums duplicate rows for one line rather than reading only the first', async () => {
    // Checkout writes one sale_items row per request line without aggregating, so a
    // sale can list the same product twice. Reading one row would refuse a legitimate
    // return of the rest.
    const sale = await testPool.query<{ id: number }>(
      `INSERT INTO sales (subtotal, total, payment_method, cashier_id)
       VALUES (1000, 1000, 'Cash', 1) RETURNING id`
    );
    const splitSaleId = sale.rows[0].id;
    await testPool.query(
      `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price)
       VALUES ($1, 1, 1, 500), ($1, 1, 1, 500)`,
      [splitSaleId]
    );

    // Two units were sold across two rows; both may come back.
    const created = await service.createExchange(
      {
        original_sale_id: splitSaleId,
        returned_items: [returned(1, 2)] as never,
        new_items: [] as never,
      },
      1
    );
    expect(Number(created.return_total)).toBe(1000);
  });

  it('restocks a good return and leaves a damaged one off the shelf', async () => {
    const before = await stockOf(1);

    await service.createExchange(exchange([returned(1, 1)]), 1);
    expect(await stockOf(1)).toBe(before + 1);

    await service.createExchange(
      exchange([{ ...returned(1, 1), condition: 'damaged' as const }]),
      1
    );
    expect(await stockOf(1)).toBe(before + 1);
  });
});
