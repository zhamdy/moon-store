/**
 * MED-13 and MED-14 on real PostgreSQL, through the real app over HTTP.
 *
 * `stock_adjustments` predates variants, so it recorded a product and nothing else. For a
 * variant product that made the ledger unreconcilable — a variant sale and a variant
 * stock-count both claimed the product went 4 -> 3 and then 4 -> 7 while `products.stock`
 * sat at 6 the whole time — and it left `POST /products/:id/adjust-stock`, the one
 * *audited* manual path, writing a column no sale path reads.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { startHttpApp, type HttpHarness } from '../support/httpApp';

describeWithPostgres('stock adjustments carry the variant', () => {
  let harness: RealPostgresHarness;
  let http: HttpHarness;
  let productId: number;
  let variantId: number;

  beforeAll(async () => {
    harness = await setupRealPostgres('stock-adjustment-variant');
    http = await startHttpApp();
  });

  afterAll(async () => {
    await http?.close();
    await harness?.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    await harness.pool.query(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (1, 'Admin', 'admin@moon.com', 'x', 'Admin')"
    );
    const product = await harness.pool.query<{ id: number }>(
      `INSERT INTO products (name, sku, price, cost_price, stock, min_stock, has_variants)
       VALUES ('كنزة', 'SKU-VAR-1', 3200, 1500, 6, 5, 1) RETURNING id`
    );
    productId = product.rows[0].id;
    const variant = await harness.pool.query<{ id: number }>(
      `INSERT INTO product_variants (product_id, sku, price, stock, attributes)
       VALUES ($1, 'SKU-VAR-1-S', NULL, 4, '{"size":"S"}') RETURNING id`,
      [productId]
    );
    variantId = variant.rows[0].id;
  });

  const adjust = (body: Record<string, unknown>) =>
    http.request('POST', `/api/v1/products/${productId}/adjust-stock`, body);

  async function stocks() {
    const p = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    const v = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM product_variants WHERE id = $1',
      [variantId]
    );
    return { product: p.rows[0].stock, variant: v.rows[0].stock };
  }

  /** MED-13: the audited manual path could not reach a variant's stock at all. */
  it('applies a variant adjustment to the variant row, not the dead product column', async () => {
    const res = await adjust({ delta: 3, reason: 'Manual Adjustment', variant_id: variantId });

    expect(res.status).toBe(200);
    expect(await stocks()).toEqual({ product: 6, variant: 7 });
  });

  /** MED-14: the row has to say which size moved. */
  it('records the variant on the audit row', async () => {
    await adjust({ delta: -1, reason: 'Damaged', variant_id: variantId });

    const { rows } = await harness.pool.query<{ variant_id: number; delta: number }>(
      'SELECT variant_id, delta FROM stock_adjustments WHERE product_id = $1',
      [productId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].variant_id).toBe(variantId);
    expect(rows[0].delta).toBe(-1);
  });

  it('leaves a product-level adjustment exactly as it was, with a null variant', async () => {
    const res = await adjust({ delta: 2, reason: 'Manual Adjustment' });

    expect(res.status).toBe(200);
    expect(await stocks()).toEqual({ product: 8, variant: 4 });
    const { rows } = await harness.pool.query<{ variant_id: number | null }>(
      'SELECT variant_id FROM stock_adjustments WHERE product_id = $1',
      [productId]
    );
    expect(rows[0].variant_id).toBeNull();
  });

  it('refuses a variant adjustment that would go below zero, writing nothing', async () => {
    const res = await adjust({ delta: -99, reason: 'Damaged', variant_id: variantId });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await stocks()).toEqual({ product: 6, variant: 4 });
    const { rows } = await harness.pool.query('SELECT * FROM stock_adjustments');
    expect(rows).toHaveLength(0);
  });

  it('refuses a variant that belongs to another product, writing nothing', async () => {
    const other = await harness.pool.query<{ id: number }>(
      `INSERT INTO products (name, sku, price, cost_price, stock, has_variants)
       VALUES ('فستان', 'SKU-VAR-2', 1950, 900, 5, 1) RETURNING id`
    );
    const foreign = await harness.pool.query<{ id: number }>(
      `INSERT INTO product_variants (product_id, sku, price, stock, attributes)
       VALUES ($1, 'SKU-VAR-2-M', NULL, 3, '{"size":"M"}') RETURNING id`,
      [other.rows[0].id]
    );

    const res = await adjust({
      delta: 1,
      reason: 'Manual Adjustment',
      variant_id: foreign.rows[0].id,
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    const { rows } = await harness.pool.query('SELECT * FROM stock_adjustments');
    expect(rows).toHaveLength(0);
  });

  /**
   * LOW-1: the API already refuses `price: 0` on a variant, but the column had no CHECK,
   * so an import, a backfill or a restored dump could still introduce one — and a zero is
   * neither "inherit the product price" (NULL) nor a real price, which is what split the
   * till's reading from the catalog's. Migration 019 closes the path the schema left open.
   */
  it('refuses a zero variant price at the database level, not just at the schema', async () => {
    await expect(
      harness.pool.query(
        `INSERT INTO product_variants (product_id, sku, price, stock, attributes)
         VALUES ($1, 'SKU-VAR-ZERO', 0, 1, '{"size":"L"}')`,
        [productId]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('still allows a NULL price, which is the inherit-the-product-price seam', async () => {
    await expect(
      harness.pool.query(
        `INSERT INTO product_variants (product_id, sku, price, stock, attributes)
         VALUES ($1, 'SKU-VAR-NULL', NULL, 1, '{"size":"XL"}')`,
        [productId]
      )
    ).resolves.toBeDefined();
  });

  /** The ledger is only reconcilable if the deltas sum to the movement. */
  it('reconciles: the variant deltas sum to the variant stock movement', async () => {
    await adjust({ delta: 3, reason: 'Manual Adjustment', variant_id: variantId });
    await adjust({ delta: -2, reason: 'Damaged', variant_id: variantId });

    const { rows } = await harness.pool.query<{ sum: string }>(
      'SELECT COALESCE(SUM(delta), 0) AS sum FROM stock_adjustments WHERE variant_id = $1',
      [variantId]
    );
    expect(Number(rows[0].sum)).toBe(1);
    expect((await stocks()).variant).toBe(5);
  });
});
