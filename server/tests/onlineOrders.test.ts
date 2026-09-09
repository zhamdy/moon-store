/**
 * Online orders: a public endpoint that priced itself, and an unguarded stock write
 * (#125).
 *
 * `POST /api/v1/online-orders` takes no token -- a shopper places it -- and it used to
 * bill `items[].price` straight from the request body, so anyone could order at a price
 * they chose. The stock write was an unguarded `stock = stock - $1`, so an over-order
 * either drove stock negative or tripped migration 004's non-negative CHECK and reached
 * the shopper as a 500. Cancelling a delivered order put its units back on the shelf.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { OnlineOrdersRepository } from '../src/modules/commerce/onlineOrders/repository';
import { OnlineOrdersService } from '../src/modules/commerce/onlineOrders/service';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

const order = (overrides: Record<string, unknown> = {}) => ({
  customer_name: 'Nadia',
  customer_phone: '01000000000',
  shipping_address: '12 Nile St',
  city: 'Cairo',
  items: [{ product_id: 1, quantity: 1, price: 500 }],
  shipping_fee: 0,
  ...overrides,
});

describe('online orders (#125)', () => {
  let testPool: PgPool;
  const repo = new OnlineOrdersRepository();
  const service = new OnlineOrdersService(repo);

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM online_order_items');
    await testPool.query('DELETE FROM online_orders');
    await testPool.query('DELETE FROM product_variants');
    await testPool.query('DELETE FROM products');
    await testPool.query('DELETE FROM customers');

    await testPool.query(
      `INSERT INTO products (id, name, sku, price, cost_price, stock)
       VALUES (1, 'Silk Dress', 'SKU-001', 500, 250, 5)`
    );
  });

  async function stockOf(productId: number): Promise<number> {
    const { rows } = await testPool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return Number(rows[0].stock);
  }

  it('prices from the catalog, not from the price the shopper sent (#125 repro)', async () => {
    const created = await service.createOrder(
      order({ items: [{ product_id: 1, quantity: 1, price: 0.01 }] })
    );

    expect(Number(created.subtotal)).toBe(500);
    expect(Number(created.total)).toBe(500);

    const { rows } = await testPool.query<{ price: string }>(
      'SELECT price FROM online_order_items WHERE order_id = $1',
      [created.id]
    );
    expect(Number(rows[0].price)).toBe(500);
  });

  it('adds the shipping fee to the catalog-priced subtotal', async () => {
    const created = await service.createOrder(
      order({ items: [{ product_id: 1, quantity: 2, price: 1 }], shipping_fee: 50 })
    );

    expect(Number(created.subtotal)).toBe(1000);
    expect(Number(created.total)).toBe(1050);
  });

  it('refuses an over-order with a typed conflict and writes no stock', async () => {
    await expect(
      service.createOrder(order({ items: [{ product_id: 1, quantity: 6, price: 500 }] }))
    ).rejects.toMatchObject({ name: 'PublicError', code: 'CONFLICT' });

    expect(await stockOf(1)).toBe(5);
    // That the order row is rolled back too is asserted in the real-PostgreSQL suite:
    // pg-mem accepts ROLLBACK and keeps the rows anyway, so a claim about atomicity
    // made here would pass without proving anything.
  });

  it('names how many are left when it refuses', async () => {
    await expect(
      service.createOrder(order({ items: [{ product_id: 1, quantity: 6, price: 500 }] }))
    ).rejects.toThrow(/Only 5 left of Silk Dress/);
  });

  it('deducts exactly the ordered quantity when it fits', async () => {
    await service.createOrder(order({ items: [{ product_id: 1, quantity: 2, price: 500 }] }));
    expect(await stockOf(1)).toBe(3);
  });

  it('refuses a product that does not exist rather than pricing it at nothing', async () => {
    await expect(
      service.createOrder(order({ items: [{ product_id: 999, quantity: 1, price: 500 }] }))
    ).rejects.toMatchObject({ name: 'PublicError', code: 'VALIDATION_ERROR' });
  });

  describe('variant lines', () => {
    beforeEach(async () => {
      await testPool.query(
        `INSERT INTO product_variants (id, product_id, sku, price, stock, attributes)
         VALUES (10, 1, 'SKU-001-RED', 550, 2, '{"color":"Red"}')`
      );
    });

    it('prices and deducts from the variant, not its parent product', async () => {
      const created = await service.createOrder(
        order({ items: [{ product_id: 1, variant_id: 10, quantity: 1, price: 1 }] })
      );

      expect(Number(created.subtotal)).toBe(550);

      const { rows } = await testPool.query<{ stock: number }>(
        'SELECT stock FROM product_variants WHERE id = 10'
      );
      expect(Number(rows[0].stock)).toBe(1);
      expect(await stockOf(1)).toBe(5); // the parent product is untouched
    });

    it("refuses an over-order of a variant on the variant's own stock", async () => {
      await expect(
        service.createOrder(
          order({ items: [{ product_id: 1, variant_id: 10, quantity: 3, price: 1 }] })
        )
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });

  describe('cancellation', () => {
    async function place(): Promise<number> {
      const created = await service.createOrder(
        order({ items: [{ product_id: 1, quantity: 2, price: 500 }] })
      );
      return created.id;
    }

    it('restores stock once when a pending order is cancelled', async () => {
      const id = await place();
      expect(await stockOf(1)).toBe(3);

      await service.updateStatus(id, 'cancelled');
      expect(await stockOf(1)).toBe(5);
    });

    it('does not restore twice when an already-cancelled order is cancelled again', async () => {
      const id = await place();
      await service.updateStatus(id, 'cancelled');
      await service.updateStatus(id, 'cancelled');

      expect(await stockOf(1)).toBe(5);
    });

    it('refuses to cancel a delivered order, and restores nothing (#125)', async () => {
      const id = await place();
      await service.updateStatus(id, 'delivered');
      expect(await stockOf(1)).toBe(3);

      await expect(service.updateStatus(id, 'cancelled')).rejects.toMatchObject({
        name: 'PublicError',
        code: 'CONFLICT',
      });

      // The goods are with the customer; cancelling must not put them back on the shelf.
      expect(await stockOf(1)).toBe(3);
    });

    it('still cancels a shipped order, which can be recovered', async () => {
      const id = await place();
      await service.updateStatus(id, 'shipped');

      await service.updateStatus(id, 'cancelled');
      expect(await stockOf(1)).toBe(5);
    });
  });
});
