/**
 * `POST /api/v1/sales/:id/refund` under concurrency and retry, against real PostgreSQL.
 *
 * Every invariant here needs genuine MVCC: the sale-row lock that serializes the
 * cumulative refund check, and the rollback that must take the register movement with it.
 * pg-mem has neither (it silently ignores ROLLBACK), so these cannot live in a pg-mem
 * suite — they would pass for the wrong reason.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { SalesController } from '../../src/modules/pos/sales/controller';
import { RegisterRepository } from '../../src/modules/pos/register/repository';
import { resetEnvCache } from '../../src/config/env';
import * as auditLogger from '../../../server/middleware/auditLogger';

interface CapturedResponse {
  status: number | null;
  body: unknown;
  headers: Record<string, string>;
}

describeWithPostgres('POST /api/v1/sales/:id/refund concurrency and idempotency', () => {
  let harness: RealPostgresHarness;
  let cashierId: number;
  let productId: number;

  beforeAll(async () => {
    // The default pool is enough: the widest test here holds three connections (one per
    // simultaneous refund waiting on the sale-row lock).
    harness = await setupRealPostgres('refunds-concurrency');
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();

    const users = await harness.pool.query<{ id: number }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Cashier', 'cashier@moon.com', 'x', 'Cashier') RETURNING id"
    );
    cashierId = users.rows[0].id;

    const products = await harness.pool.query<{ id: number }>(
      "INSERT INTO products (name, sku, price, stock) VALUES ('Silk Dress', 'SKU-R1', 500, 8) RETURNING id"
    );
    productId = products.rows[0].id;

    vi.spyOn(auditLogger, 'logAuditFromReq').mockImplementation(() => undefined as never);

    delete process.env.IDEMPOTENCY_REQUIRED;
    resetEnvCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.IDEMPOTENCY_REQUIRED;
    resetEnvCache();
  });

  /** A completed 2-unit sale totalling 1000, with stock already deducted to 8. */
  async function makeSale(): Promise<number> {
    const sale = await harness.pool.query<{ id: number }>(
      `INSERT INTO sales (subtotal, total, payment_method, cashier_id)
       VALUES (1000, 1000, 'Cash', $1) RETURNING id`,
      [cashierId]
    );
    const saleId = sale.rows[0].id;
    await harness.pool.query(
      'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES ($1, $2, 2, 500)',
      [saleId, productId]
    );
    return saleId;
  }

  async function openRegisterSession(): Promise<number> {
    const { rows } = await harness.pool.query<{ id: number }>(
      `INSERT INTO register_sessions (cashier_id, opening_float, expected_cash)
       VALUES ($1, 1000, 1000) RETURNING id`,
      [cashierId]
    );
    return rows[0].id;
  }

  async function countRows(table: string): Promise<number> {
    const { rows } = await harness.pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${table}`
    );
    return rows[0].n;
  }

  async function readSale(saleId: number) {
    const { rows } = await harness.pool.query<{ refund_status: string; refunded_amount: string }>(
      'SELECT refund_status, refunded_amount FROM sales WHERE id = $1',
      [saleId]
    );
    return { status: rows[0].refund_status, refunded: Number(rows[0].refunded_amount) };
  }

  /** Drives the real controller and captures what it wrote to the response. */
  async function postRefund(
    saleId: number,
    body: unknown,
    key?: string
  ): Promise<{ response: CapturedResponse; error: unknown }> {
    const captured: CapturedResponse = { status: null, body: undefined, headers: {} };
    let error: unknown = null;

    const res = {
      status(code: number) {
        captured.status = code;
        return this;
      },
      json(payload: unknown) {
        captured.body = payload;
        return this;
      },
      setHeader(name: string, value: string) {
        captured.headers[name] = value;
      },
    } as unknown as Response;

    const next = ((err: unknown) => {
      error = err;
    }) as NextFunction;

    await new SalesController().refundSale(
      {
        params: { id: String(saleId) },
        body,
        user: { id: cashierId, name: 'Cashier' },
        headers: key ? { 'idempotency-key': key } : {},
      } as unknown as Request,
      res,
      next
    );

    return { response: captured, error };
  }

  function refundBody(quantity: number, unitPrice: number, restock = false) {
    return {
      items: [{ product_id: productId, quantity, unit_price: unitPrice }],
      reason: 'Returned',
      restock,
    };
  }

  it('never lets concurrent partial refunds exceed the sale total (R1)', async () => {
    const saleId = await makeSale();

    // Three simultaneous 400 refunds against a 1000 sale: two fit, the third must not.
    // Without the FOR UPDATE lock all three read refunded_amount = 0 and all three commit.
    const outcomes = await Promise.all([
      postRefund(saleId, refundBody(1, 400)),
      postRefund(saleId, refundBody(1, 400)),
      postRefund(saleId, refundBody(1, 400)),
    ]);

    const accepted = outcomes.filter((o) => o.error === null);
    const rejected = outcomes.filter((o) => o.error !== null);

    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Refund amount exceeds sale total',
    });

    const sale = await readSale(saleId);
    expect(sale.refunded).toBe(800);
    expect(sale.refunded).toBeLessThanOrEqual(1000);
    expect(sale.status).toBe('partial');
    expect(await countRows('refunds')).toBe(2);
  });

  it('does not lose a restock when two refunds commit concurrently (R1)', async () => {
    const saleId = await makeSale();

    await Promise.all([
      postRefund(saleId, refundBody(1, 400, true)),
      postRefund(saleId, refundBody(1, 400, true)),
    ]);

    // 8 + 1 + 1. A read-then-write of an absolute value loses one of the two.
    const { rows } = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    expect(Number(rows[0].stock)).toBe(10);
  });

  it('replays a retried refund without refunding, restocking, or paying out twice (R2)', async () => {
    const saleId = await makeSale();
    await openRegisterSession();

    const first = await postRefund(saleId, refundBody(1, 400, true), 'refund-key');
    const second = await postRefund(saleId, refundBody(1, 400, true), 'refund-key');

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.response.status).toBe(201);
    expect(second.response.headers['Idempotent-Replay']).toBe('true');
    expect(JSON.stringify(second.response.body)).toBe(JSON.stringify(first.response.body));

    expect(await countRows('refunds')).toBe(1);
    expect(await countRows('register_movements')).toBe(1);
    expect((await readSale(saleId)).refunded).toBe(400);

    const { rows } = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    expect(Number(rows[0].stock)).toBe(9);
  });

  it('rejects one key reused against a different sale instead of replaying it', async () => {
    const saleA = await makeSale();
    const saleB = await makeSale();

    await postRefund(saleA, refundBody(1, 400), 'shared-key');
    const { error } = await postRefund(saleB, refundBody(1, 400), 'shared-key');

    // The sale id lives in the fingerprinted payload, not the endpoint label, so the
    // second refund conflicts rather than replaying saleA's response.
    expect(error).toMatchObject({ name: 'PublicError', code: 'CONFLICT' });
    expect((await readSale(saleB)).refunded).toBe(0);
    expect(await countRows('refunds')).toBe(1);
  });

  it('leaves no refund row and no register movement when the refund fails (R4)', async () => {
    const saleId = await makeSale();
    await openRegisterSession();

    // Fail the LAST statement of the refund transaction: by then the refund row and the
    // register movement are both already inserted, so only a real rollback can remove
    // them. The old code recorded the movement after the transaction and swallowed its
    // errors, which left exactly this orphan behind.
    vi.spyOn(RegisterRepository.prototype, 'updateSessionExpectedCash').mockRejectedValue(
      new Error('register write failed')
    );

    const { error } = await postRefund(saleId, refundBody(1, 400, true), 'doomed-key');

    expect(error).toMatchObject({ message: 'register write failed' });
    expect(await countRows('refunds')).toBe(0);
    expect(await countRows('register_movements')).toBe(0);
    expect(await countRows('idempotency_keys')).toBe(0);
    expect((await readSale(saleId)).refunded).toBe(0);

    const { rows } = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    expect(Number(rows[0].stock)).toBe(8);
  });
});
