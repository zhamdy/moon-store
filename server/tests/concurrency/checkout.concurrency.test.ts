/**
 * Checkout stock invariants under real concurrency.
 *
 * These are the assertions the whole unit exists for, and none of them can be proven
 * with a fake repository or an in-memory engine: each needs two genuinely concurrent
 * connections racing for the same row.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { salesService } from '../../src/modules/pos/sales/service';
import { salesRepository } from '../../src/modules/pos/sales/repository';
import { InsufficientStockError } from '../../src/modules/pos/sales/types';

describeWithPostgres('checkout stock under concurrency', () => {
  let harness: RealPostgresHarness;
  let cashierId: number;

  beforeAll(async () => {
    harness = await setupRealPostgres('checkout-concurrency');
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    const { rows } = await harness.pool.query<{ id: number }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Cashier', 'cashier@moon.com', 'x', 'Cashier') RETURNING id"
    );
    cashierId = rows[0].id;
  });

  async function makeProduct(sku: string, stock: number, price = 100): Promise<number> {
    const { rows } = await harness.pool.query<{ id: number }>(
      'INSERT INTO products (name, sku, price, stock) VALUES ($1, $2, $3, $4) RETURNING id',
      [`Product ${sku}`, sku, price, stock]
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

  async function countRows(table: string): Promise<number> {
    const { rows } = await harness.pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${table}`
    );
    return rows[0].n;
  }

  function sell(productId: number, quantity: number) {
    return salesService.executeSale(
      {
        items: [{ product_id: productId, quantity, unit_price: 100 }],
        payment_method: 'Cash',
      } as never,
      cashierId
    );
  }

  describe('single checkout', () => {
    it('decrements stock and records the adjustment from what actually happened', async () => {
      const productId = await makeProduct('SKU-A', 5);

      await sell(productId, 2);

      expect(await stockOf(productId)).toBe(3);

      const { rows } = await harness.pool.query<{
        previous_qty: number;
        new_qty: number;
        delta: number;
      }>('SELECT previous_qty, new_qty, delta FROM stock_adjustments');

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ previous_qty: 5, new_qty: 3, delta: -2 });
    });

    it('allows a sale of exactly the remaining stock, leaving zero', async () => {
      const productId = await makeProduct('SKU-EXACT', 4);

      await sell(productId, 4);

      expect(await stockOf(productId)).toBe(0);
    });

    it('decrements every line of a multi-line sale exactly once', async () => {
      const a = await makeProduct('SKU-M1', 5);
      const b = await makeProduct('SKU-M2', 7);

      await salesService.executeSale(
        {
          items: [
            { product_id: a, quantity: 2, unit_price: 100 },
            { product_id: b, quantity: 3, unit_price: 100 },
          ],
          payment_method: 'Cash',
        } as never,
        cashierId
      );

      expect(await stockOf(a)).toBe(3);
      expect(await stockOf(b)).toBe(4);
      expect(await countRows('stock_adjustments')).toBe(2);
    });

    it('rejects a quantity above stock and writes no sale, items, payments, or adjustments', async () => {
      const productId = await makeProduct('SKU-SHORT', 1);

      await expect(sell(productId, 2)).rejects.toThrow(/Insufficient stock/);

      expect(await stockOf(productId)).toBe(1);
      expect(await countRows('sales')).toBe(0);
      expect(await countRows('sale_items')).toBe(0);
      expect(await countRows('sale_payments')).toBe(0);
      expect(await countRows('stock_adjustments')).toBe(0);
    });

    it('is authoritative when stock disappears after the fail-fast pre-check passed', async () => {
      const productId = await makeProduct('SKU-VANISH', 1);

      // The pre-check in resolveLines sees stock 1 and lets the sale through. A
      // concurrent buyer then drains the row before the write phase runs. This is
      // precisely the stale-read window that used to produce an oversell, so it is the
      // guarded UPDATE -- not the earlier check -- that must reject the sale.
      const spy = vi
        .spyOn(salesRepository, 'createSaleItem')
        .mockImplementationOnce(async (data, client) => {
          await harness.pool.query('UPDATE products SET stock = 0 WHERE id = $1', [productId]);
          spy.mockRestore();
          return salesRepository.createSaleItem(data, client);
        });

      try {
        await expect(sell(productId, 1)).rejects.toBeInstanceOf(InsufficientStockError);
      } finally {
        vi.restoreAllMocks();
      }

      expect(await stockOf(productId)).toBe(0);
      expect(await countRows('sales')).toBe(0);
      expect(await countRows('sale_items')).toBe(0);
      expect(await countRows('stock_adjustments')).toBe(0);
    });
  });

  describe('concurrent checkouts', () => {
    it('lets exactly as many checkouts succeed as there is stock (R1)', async () => {
      const STOCK = 5;
      const ATTEMPTS = 10;
      const productId = await makeProduct('SKU-RACE', STOCK);

      const results = await Promise.allSettled(
        Array.from({ length: ATTEMPTS }, () => sell(productId, 1))
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(STOCK);
      expect(rejected).toHaveLength(ATTEMPTS - STOCK);
      // A losing checkout is rejected either by the fail-fast pre-check or by the
      // guarded UPDATE, depending on how the race lands. Both say the same thing to the
      // caller; which layer caught it is not part of the contract.
      for (const failure of rejected) {
        expect(String((failure as PromiseRejectedResult).reason.message)).toMatch(
          /Insufficient stock/
        );
      }

      // The invariant that used to break: no oversell, no lost update.
      expect(await stockOf(productId)).toBe(0);
      expect(await countRows('sales')).toBe(STOCK);
      expect(await countRows('sale_items')).toBe(STOCK);
      expect(await countRows('stock_adjustments')).toBe(STOCK);
    });

    it('never drives stock negative even when demand far exceeds supply', async () => {
      const productId = await makeProduct('SKU-STORM', 3);

      await Promise.allSettled(Array.from({ length: 12 }, () => sell(productId, 1)));

      const finalStock = await stockOf(productId);
      expect(finalStock).toBe(0);
      expect(finalStock).toBeGreaterThanOrEqual(0);
    });

    it('does not deadlock when two multi-line checkouts name the same products in opposite order', async () => {
      const a = await makeProduct('SKU-D1', 50);
      const b = await makeProduct('SKU-D2', 50);

      const forwards = () =>
        salesService.executeSale(
          {
            items: [
              { product_id: a, quantity: 1, unit_price: 100 },
              { product_id: b, quantity: 1, unit_price: 100 },
            ],
            payment_method: 'Cash',
          } as never,
          cashierId
        );

      const backwards = () =>
        salesService.executeSale(
          {
            items: [
              { product_id: b, quantity: 1, unit_price: 100 },
              { product_id: a, quantity: 1, unit_price: 100 },
            ],
            payment_method: 'Cash',
          } as never,
          cashierId
        );

      // Without a canonical write order these two would lock A->B and B->A and deadlock.
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) => (i % 2 === 0 ? forwards() : backwards()))
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          expect(String(result.reason?.message ?? result.reason)).not.toMatch(/deadlock/i);
        }
      }
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(await stockOf(a)).toBe(44);
      expect(await stockOf(b)).toBe(44);
    });

    it('keeps sale_items in the request order even though stock writes are sorted', async () => {
      const lowerId = await makeProduct('SKU-LOW-ID', 10);
      const higherId = await makeProduct('SKU-HIGH-ID', 10);
      expect(higherId).toBeGreaterThan(lowerId);

      const sale = await salesService.executeSale(
        {
          // Descending by id — the opposite of the canonical stock-write order.
          items: [
            { product_id: higherId, quantity: 1, unit_price: 100 },
            { product_id: lowerId, quantity: 1, unit_price: 100 },
          ],
          payment_method: 'Cash',
        } as never,
        cashierId
      );

      const { rows } = await harness.pool.query<{ product_id: number }>(
        'SELECT product_id FROM sale_items WHERE sale_id = $1 ORDER BY id',
        [(sale as { id: number }).id]
      );

      // The response's `items` array is unchanged by the write-order fix (R8).
      expect(rows.map((r) => r.product_id)).toEqual([higherId, lowerId]);
    });
  });
});
