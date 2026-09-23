/**
 * HIGH-3, MED-11 and MED-15 on real PostgreSQL, through the real app over HTTP.
 *
 * All three are invisible on pg-mem by construction. MED-15 in particular: the phantom
 * `price_history` rows came from comparing node-postgres's NUMERIC **string** against a
 * JS number, and pg-mem returns NUMERIC as a number, so the comparison behaved correctly
 * there and no unit test could catch it (root CLAUDE.md -> Learnings; audit AD-5).
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { startHttpApp, type HttpHarness } from '../support/httpApp';

describeWithPostgres('PUT /api/v1/products/:id on real PostgreSQL', () => {
  let harness: RealPostgresHarness;
  let http: HttpHarness;
  let productId: number;

  beforeAll(async () => {
    harness = await setupRealPostgres('product-update');
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
    const { rows } = await harness.pool.query<{ id: number }>(
      `INSERT INTO products (name, sku, barcode, price, cost_price, stock, min_stock)
       VALUES ('فستان', 'SKU-UPD-1', '6221002001', 1950, 900, 30, 9) RETURNING id`
    );
    productId = rows[0].id;
  });

  const rename = (body: Record<string, unknown> = {}) =>
    http.request('PUT', `/api/v1/products/${productId}`, {
      name: 'فستان محدث',
      sku: 'SKU-UPD-1',
      price: 1950,
      ...body,
    });

  async function read() {
    const { rows } = await harness.pool.query(
      'SELECT stock, cost_price, min_stock, barcode FROM products WHERE id = $1',
      [productId]
    );
    return rows[0];
  }

  async function priceHistoryCount(): Promise<number> {
    const { rows } = await harness.pool.query<{ count: string }>(
      'SELECT count(*) FROM price_history WHERE product_id = $1',
      [productId]
    );
    return Number(rows[0].count);
  }

  /**
   * HIGH-3's exact reproduction: a cashier sells one between the operator opening the
   * form and saving it. The sold unit used to be resurrected, with no audit row.
   */
  it('does not resurrect stock sold while the form was open', async () => {
    await harness.pool.query('UPDATE products SET stock = stock - 1 WHERE id = $1', [productId]);

    const res = await rename();

    expect(res.status).toBe(200);
    expect((await read()).stock).toBe(29);
    const { rows } = await harness.pool.query('SELECT * FROM stock_adjustments');
    expect(rows).toHaveLength(0);
  });

  it('keeps cost_price, min_stock and barcode when they are omitted (MED-11)', async () => {
    const res = await rename();

    expect(res.status).toBe(200);
    const row = await read();
    expect(Number(row.cost_price)).toBe(900);
    expect(row.min_stock).toBe(9);
    expect(row.barcode).toBe('6221002001');
  });

  it('still writes each field when it is sent', async () => {
    const res = await rename({ stock: 12, cost_price: 1000, min_stock: 4, barcode: '6221009999' });

    expect(res.status).toBe(200);
    const row = await read();
    expect(row.stock).toBe(12);
    expect(Number(row.cost_price)).toBe(1000);
    expect(row.min_stock).toBe(4);
    expect(row.barcode).toBe('6221009999');
  });

  it('still clears barcode on an explicit null', async () => {
    const res = await rename({ barcode: null });

    expect(res.status).toBe(200);
    expect((await read()).barcode).toBeNull();
  });

  /**
   * HIGH-3's lost-update half. The form sends a full row, so a write composed against a
   * stale read does not merge with what it missed — it overwrites it. Here the token is
   * the one the operator's read returned, and the cashier's sale lands in between.
   */
  it('refuses a write composed against a stale read, changing nothing', async () => {
    const opened = await harness.pool.query<{ updated_at: Date }>(
      'SELECT updated_at FROM products WHERE id = $1',
      [productId]
    );
    const token = opened.rows[0].updated_at.toISOString();

    // Someone else edits the product while the form is open.
    await http.request('PUT', `/api/v1/products/${productId}`, {
      name: 'غيّره زميل',
      sku: 'SKU-UPD-1',
      price: 2500,
    });

    const stale = await rename({ expected_updated_at: token, price: 9999 });

    expect(stale.status).toBe(409);
    expect(stale.body.error.details[0]).toMatchObject({
      field: 'expected_updated_at',
      code: 'PRODUCT_MODIFIED',
    });
    const { rows } = await harness.pool.query<{ name: string; price: string }>(
      'SELECT name, price FROM products WHERE id = $1',
      [productId]
    );
    expect(rows[0].name).toBe('غيّره زميل');
    expect(Number(rows[0].price)).toBe(2500);
  });

  it('accepts a write carrying the current token', async () => {
    const opened = await harness.pool.query<{ updated_at: Date }>(
      'SELECT updated_at FROM products WHERE id = $1',
      [productId]
    );

    const res = await rename({ expected_updated_at: opened.rows[0].updated_at.toISOString() });

    expect(res.status).toBe(200);
  });

  it('behaves exactly as before when the caller stakes no claim', async () => {
    await http.request('PUT', `/api/v1/products/${productId}`, {
      name: 'تعديل',
      sku: 'SKU-UPD-1',
      price: 2500,
    });

    // No token: an older client keeps working, the compatibility posture the
    // Idempotency-Key and collections rollouts both took.
    const res = await rename();
    expect(res.status).toBe(200);
  });

  it('rolls the whole write back on a conflict, price_history included', async () => {
    const opened = await harness.pool.query<{ updated_at: Date }>(
      'SELECT updated_at FROM products WHERE id = $1',
      [productId]
    );
    const token = opened.rows[0].updated_at.toISOString();
    await http.request('PUT', `/api/v1/products/${productId}`, {
      name: 'غيّره زميل',
      sku: 'SKU-UPD-1',
      price: 1950,
    });

    const before = await priceHistoryCount();
    const stale = await rename({ expected_updated_at: token, price: 4000 });

    expect(stale.status).toBe(409);
    expect(await priceHistoryCount()).toBe(before);
  });

  /** MED-15: this is the assertion pg-mem cannot make. */
  it('writes no price_history row when neither price changed', async () => {
    const res = await rename({ cost_price: 900 });

    expect(res.status).toBe(200);
    expect(await priceHistoryCount()).toBe(0);
  });

  it('writes no price_history row when the price fields are omitted entirely', async () => {
    const res = await rename();

    expect(res.status).toBe(200);
    expect(await priceHistoryCount()).toBe(0);
  });

  it('writes exactly one price_history row for a real price change', async () => {
    const res = await rename({ price: 2100 });

    expect(res.status).toBe(200);
    const { rows } = await harness.pool.query<{ field: string }>(
      'SELECT field FROM price_history WHERE product_id = $1',
      [productId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].field).toBe('price');
  });
});
