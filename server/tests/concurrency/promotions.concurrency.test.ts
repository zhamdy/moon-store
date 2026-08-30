/**
 * Coupon usage limits and loyalty balances under real concurrency.
 *
 * Both invariants used to be decided by a stale read: the usage count and the points
 * balance were read, checked in JavaScript, and acted on later. N concurrent checkouts
 * all saw the same pre-consumption value and all passed.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { salesService } from '../../src/modules/pos/sales/service';
import { couponsService } from '../../src/modules/commerce/coupons/service';

describeWithPostgres('coupon and loyalty consumption under concurrency', () => {
  let harness: RealPostgresHarness;
  let cashierId: number;

  beforeAll(async () => {
    harness = await setupRealPostgres('promotions-concurrency', { maxConnections: 10 });
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

  async function makeCoupon(
    code: string,
    options: { maxUses?: number | null; maxUsesPerCustomer?: number | null } = {}
  ): Promise<number> {
    const { rows } = await harness.pool.query<{ id: number }>(
      `INSERT INTO coupons (code, type, value, max_uses, max_uses_per_customer)
       VALUES ($1, 'fixed', 10, $2, $3) RETURNING id`,
      [code, options.maxUses ?? null, options.maxUsesPerCustomer ?? null]
    );
    return rows[0].id;
  }

  async function makeCustomer(phone: string, points: number): Promise<number> {
    const { rows } = await harness.pool.query<{ id: number }>(
      'INSERT INTO customers (name, phone, loyalty_points) VALUES ($1, $2, $3) RETURNING id',
      [`Customer ${phone}`, phone, points]
    );
    return rows[0].id;
  }

  /**
   * Earning cannot be switched off by configuring a zero rate: resolveRate treats a
   * non-positive value as invalid and falls back to the safe default. These tests
   * therefore isolate redemption by making the redeemed points cover the whole amount
   * due, which makes earnedPoints zero by the formula rather than by configuration.
   */
  async function enableLoyalty(egpPerPoint = '1', pointsPerEgp = '1'): Promise<void> {
    await harness.pool.query(
      `INSERT INTO settings (key, value) VALUES
         ('loyalty_enabled', 'true'),
         ('loyalty_egp_per_point', $1),
         ('loyalty_points_per_egp', $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [egpPerPoint, pointsPerEgp]
    );
  }

  async function countRows(table: string): Promise<number> {
    const { rows } = await harness.pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${table}`
    );
    return rows[0].n;
  }

  async function pointsOf(customerId: number): Promise<number> {
    const { rows } = await harness.pool.query<{ loyalty_points: number }>(
      'SELECT loyalty_points FROM customers WHERE id = $1',
      [customerId]
    );
    return Number(rows[0].loyalty_points);
  }

  async function stockOf(productId: number): Promise<number> {
    const { rows } = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return Number(rows[0].stock);
  }

  describe('coupon usage limits', () => {
    it('records one usage for a single sale with a max_uses coupon', async () => {
      const productId = await makeProduct('SKU-C1', 10);
      await makeCoupon('ONCE', { maxUses: 1 });

      await salesService.executeSale(
        {
          items: [{ product_id: productId, quantity: 1, unit_price: 100 }],
          payment_method: 'Cash',
          coupon_code: 'ONCE',
        } as never,
        cashierId
      );

      expect(await countRows('coupon_usage')).toBe(1);
    });

    it('lets exactly one of five concurrent sales consume a max_uses = 1 coupon', async () => {
      const productId = await makeProduct('SKU-C2', 50);
      await makeCoupon('SOLO', { maxUses: 1 });

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          salesService.executeSale(
            {
              items: [{ product_id: productId, quantity: 1, unit_price: 100 }],
              payment_method: 'Cash',
              coupon_code: 'SOLO',
            } as never,
            cashierId
          )
        )
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(4);
      for (const failure of results.filter((r) => r.status === 'rejected')) {
        expect(String((failure as PromiseRejectedResult).reason.message)).toMatch(
          /usage limit reached/i
        );
      }

      expect(await countRows('coupon_usage')).toBe(1);
      expect(await countRows('sales')).toBe(1);
    });

    it('enforces max_uses_per_customer per customer, letting a different customer through', async () => {
      const productId = await makeProduct('SKU-C3', 50);
      await makeCoupon('PERCUST', { maxUsesPerCustomer: 1 });
      const alice = await makeCustomer('+201000000010', 0);
      const bob = await makeCustomer('+201000000011', 0);

      const buy = (customerId: number) =>
        salesService.executeSale(
          {
            items: [{ product_id: productId, quantity: 1, unit_price: 100 }],
            payment_method: 'Cash',
            coupon_code: 'PERCUST',
            customer_id: customerId,
          } as never,
          cashierId
        );

      const results = await Promise.allSettled([buy(alice), buy(alice), buy(bob)]);

      // Alice's limit binds; Bob's own allowance is untouched by it.
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect(await countRows('coupon_usage')).toBe(2);

      const { rows } = await harness.pool.query<{ customer_id: number; n: number }>(
        'SELECT customer_id, COUNT(*)::int AS n FROM coupon_usage GROUP BY customer_id'
      );
      expect(rows.every((r) => r.n === 1)).toBe(true);
    });

    it('rolls back the stock decrement when the coupon limit rejects the sale', async () => {
      const productId = await makeProduct('SKU-C4', 10);
      await makeCoupon('ONEONLY', { maxUses: 1 });

      const sell = () =>
        salesService.executeSale(
          {
            items: [{ product_id: productId, quantity: 1, unit_price: 100 }],
            payment_method: 'Cash',
            coupon_code: 'ONEONLY',
          } as never,
          cashierId
        );

      await sell();
      await expect(sell()).rejects.toThrow(/usage limit reached/i);

      // Only the first sale's unit left inventory (R4).
      expect(await stockOf(productId)).toBe(9);
      expect(await countRows('sales')).toBe(1);
      expect(await countRows('stock_adjustments')).toBe(1);
    });

    it('never takes a row lock on the preview path', async () => {
      const productId = await makeProduct('SKU-C5', 10);
      await makeCoupon('PREVIEW', { maxUses: 1 });

      // Hold the coupon row locked, as a live checkout would.
      const holder = await harness.connect();
      try {
        await holder.query('BEGIN');
        await holder.query("SELECT id FROM coupons WHERE code = 'PREVIEW' FOR UPDATE");

        // A preview must not block behind it. If validate took a lock here this would
        // hang until the timeout below fires.
        const preview = couponsService.validate({
          code: 'PREVIEW',
          subtotal: 100,
          customer_id: null,
          item_product_ids: [productId],
        });

        const outcome = await Promise.race([
          preview.then(() => 'completed'),
          new Promise((resolve) => setTimeout(() => resolve('blocked'), 1_000)),
        ]);

        expect(outcome).toBe('completed');
        await holder.query('COMMIT');
      } finally {
        holder.release();
      }
    });
  });

  describe('loyalty redemption', () => {
    it('debits exactly the redeemed points and records one transaction', async () => {
      await enableLoyalty();
      const productId = await makeProduct('SKU-L1', 10, 100);
      const customerId = await makeCustomer('+201000000020', 150);

      await salesService.executeSale(
        {
          items: [{ product_id: productId, quantity: 1, unit_price: 100 }],
          payment_method: 'Cash',
          customer_id: customerId,
          points_redeemed: 100,
        } as never,
        cashierId
      );

      expect(await pointsOf(customerId)).toBe(50);

      const { rows } = await harness.pool.query<{ type: string; points: number }>(
        "SELECT type, points FROM loyalty_transactions WHERE type = 'redeemed'"
      );
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].points)).toBe(-100);
    });

    it('lets only one of three concurrent redemptions drain a 150-point balance', async () => {
      await enableLoyalty();
      const productId = await makeProduct('SKU-L2', 50, 100);
      const customerId = await makeCustomer('+201000000021', 150);

      const redeem = () =>
        salesService.executeSale(
          {
            items: [{ product_id: productId, quantity: 1, unit_price: 100 }],
            payment_method: 'Cash',
            customer_id: customerId,
            points_redeemed: 100,
          } as never,
          cashierId
        );

      const results = await Promise.allSettled([redeem(), redeem(), redeem()]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const remaining = await pointsOf(customerId);
      expect(remaining).toBe(50);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(await countRows('loyalty_transactions')).toBe(1);
    });

    it('leaves the balance and transaction log untouched when redemption fails', async () => {
      await enableLoyalty();
      const productId = await makeProduct('SKU-L3', 1, 500);
      const customerId = await makeCustomer('+201000000022', 150);

      // Enough points, but not enough stock: the whole transaction must roll back.
      await expect(
        salesService.executeSale(
          {
            items: [{ product_id: productId, quantity: 5, unit_price: 500 }],
            payment_method: 'Cash',
            customer_id: customerId,
            points_redeemed: 100,
          } as never,
          cashierId
        )
      ).rejects.toThrow();

      expect(await pointsOf(customerId)).toBe(150);
      expect(await countRows('loyalty_transactions')).toBe(0);
    });
  });
});
