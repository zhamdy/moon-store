/**
 * #202 on real PostgreSQL: a variant with no price of its own sells at the product price.
 *
 * pg-mem returns NUMERIC as a JS number and node-postgres as a string ("500.00"), so the
 * COALESCE plus `Number()` path is proven here as well as in `sales.test.ts`. Through the
 * real app over HTTP, because the price is decided behind the contract parse.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { startHttpApp, type HttpHarness, type HttpResult } from '../support/httpApp';

describeWithPostgres('POST /api/v1/sales effective variant price (#202)', () => {
  let harness: RealPostgresHarness;
  let http: HttpHarness;
  let productId: number;

  beforeAll(async () => {
    harness = await setupRealPostgres('sales-variant-price');
    http = await startHttpApp();
  });

  afterAll(async () => {
    await http?.close();
    await harness?.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    // The signed test token carries user id 1; the sale's cashier_id references it.
    await harness.pool.query(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (1, 'Admin', 'admin@moon.com', 'x', 'Admin')"
    );
    const { rows } = await harness.pool.query<{ id: number }>(
      "INSERT INTO products (name, sku, price, cost_price, stock) VALUES ('Silk Dress', 'SKU-RPG-1', 500, 250, 10) RETURNING id"
    );
    productId = rows[0].id;
  });

  async function createVariant(price: number | null): Promise<number> {
    const { rows } = await harness.pool.query<{ id: number }>(
      `INSERT INTO product_variants (product_id, sku, price, stock, attributes)
       VALUES ($1, $2, $3, 4, '{"size":"M"}') RETURNING id`,
      [productId, `SKU-RPG-V-${Math.floor(Math.random() * 1e9)}`, price]
    );
    return rows[0].id;
  }

  async function lineUnitPrice(saleId: number): Promise<number> {
    const { rows } = await harness.pool.query<{ unit_price: string }>(
      'SELECT unit_price FROM sale_items WHERE sale_id = $1',
      [saleId]
    );
    expect(rows).toHaveLength(1);
    return Number(rows[0].unit_price);
  }

  // The sales row has no subtotal column; the confirmed response carries it here.
  const subtotalOf = (res: HttpResult) =>
    Number((res.body.data.calculation as { subtotal: number }).subtotal);

  // The client's unit_price is deliberately wrong: the server must re-price the line.
  const sell = (variantId: number | null) =>
    http.request('POST', '/api/v1/sales', {
      items: [{ product_id: productId, variant_id: variantId, quantity: 1, unit_price: 1 }],
      payment_method: 'Cash',
    });

  it('charges the product price for a variant with no price of its own', async () => {
    const control = await sell(null);
    expect(control.status).toBe(201);

    const sold = await sell(await createVariant(null));
    expect(sold.status).toBe(201);
    expect(subtotalOf(sold)).toBe(500);
    expect(Number(sold.body.data.total)).toBe(Number(control.body.data.total));
    expect(await lineUnitPrice(sold.body.data.id)).toBe(500);
  });

  it("charges a priced variant its own price, not the product's", async () => {
    const sold = await sell(await createVariant(650));
    expect(sold.status).toBe(201);
    expect(subtotalOf(sold)).toBe(650);
    expect(await lineUnitPrice(sold.body.data.id)).toBe(650);
  });
});
