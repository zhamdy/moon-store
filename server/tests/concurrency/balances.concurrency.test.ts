/**
 * Balance and stock invariants for gift-card redemption and exchanges, under genuine
 * concurrency.
 *
 * These cannot live in a pg-mem suite: pg-mem has no MVCC (so two "concurrent" writers
 * are really sequential) and silently ignores ROLLBACK (so a rollback assertion would
 * pass for the wrong reason).
 *
 * The `CHECK (balance >= 0)` / `CHECK (stock >= 0)` constraints from migration 004 are a
 * silent backstop, not the mechanism under test. Every case below asserts the outcome the
 * APPLICATION guard produces — a clean typed error and an unchanged row — so a test that
 * only passed because a constraint fired would show up as the wrong error, not as a pass.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { GiftCardsController } from '../../src/modules/commerce/giftCards/controller';
import { ExchangesController } from '../../src/modules/pos/exchanges/controller';
import { giftCardsService } from '../../src/modules/commerce/giftCards/service';
import { adjustStock } from '../../../server/services/productService';
import * as auditLogger from '../../../server/middleware/auditLogger';

interface CapturedResponse {
  status: number | null;
  body: unknown;
  headers: Record<string, string>;
}

interface Outcome {
  response: CapturedResponse;
  error: unknown;
}

describeWithPostgres('gift card and exchange balance invariants', () => {
  let harness: RealPostgresHarness;
  let userId: number;
  let saleId: number;

  beforeAll(async () => {
    // The 5-way redemption race needs five genuinely simultaneous connections; one more
    // is margin. Anything larger competes with the other real-PG files for
    // max_connections and surfaces as opaque connection timeouts.
    harness = await setupRealPostgres('balances-concurrency', { maxConnections: 6 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    vi.spyOn(auditLogger, 'logAuditFromReq').mockImplementation(() => undefined as never);

    const users = await harness.pool.query<{ id: number }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Cashier', 'c@moon.com', 'x', 'Cashier') RETURNING id"
    );
    userId = users.rows[0].id;

    const sales = await harness.pool.query<{ id: number }>(
      'INSERT INTO sales (total, cashier_id) VALUES (100, $1) RETURNING id',
      [userId]
    );
    saleId = sales.rows[0].id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function capture(): { res: Response; captured: CapturedResponse } {
    const captured: CapturedResponse = { status: null, body: undefined, headers: {} };
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
    return { res, captured };
  }

  async function makeCard(balance: number): Promise<string> {
    const code = `GC-${balance}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await harness.pool.query(
      `INSERT INTO gift_cards (code, barcode, initial_value, balance, status, created_by)
       VALUES ($1, $2, $3, $3, 'active', $4)`,
      [code, code.slice(0, 20), balance, userId]
    );
    return code;
  }

  async function makeProduct(sku: string, stock: number): Promise<number> {
    const { rows } = await harness.pool.query<{ id: number }>(
      'INSERT INTO products (name, sku, price, stock) VALUES ($1, $2, 100, $3) RETURNING id',
      [`Product ${sku}`, sku, stock]
    );
    return rows[0].id;
  }

  async function redeem(code: string, amount: number, key?: string): Promise<Outcome> {
    const { res, captured } = capture();
    let error: unknown = null;

    await new GiftCardsController().redeemGiftCard(
      {
        body: { amount, sale_id: saleId },
        params: { code },
        user: { id: userId, name: 'Cashier' },
        headers: key ? { 'idempotency-key': key } : {},
      } as unknown as Request,
      res,
      ((err: unknown) => {
        error = err;
      }) as NextFunction
    );

    return { response: captured, error };
  }

  async function exchange(body: unknown, key?: string): Promise<Outcome> {
    const { res, captured } = capture();
    let error: unknown = null;

    await new ExchangesController().createExchange(
      {
        body,
        user: { id: userId, name: 'Cashier' },
        headers: key ? { 'idempotency-key': key } : {},
      } as unknown as Request,
      res,
      ((err: unknown) => {
        error = err;
      }) as NextFunction
    );

    return { response: captured, error };
  }

  async function balanceOf(code: string): Promise<number> {
    const { rows } = await harness.pool.query<{ balance: string }>(
      'SELECT balance FROM gift_cards WHERE code = $1',
      [code]
    );
    return Number(rows[0].balance);
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

  it('lets exactly one of five simultaneous full redemptions win (R1, R7)', async () => {
    const code = await makeCard(100);

    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () => giftCardsService.redeem(code, 100, saleId, userId))
    );

    const fulfilled = settled.filter((s) => s.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    // The losers must be stopped by the application guard, not by the CHECK backstop.
    for (const outcome of settled.filter((s) => s.status === 'rejected')) {
      expect((outcome as PromiseRejectedResult).reason.message).toBe(
        'Insufficient balance. Available: 0'
      );
    }

    expect(await balanceOf(code)).toBe(0);
    expect(await countRows('gift_card_transactions')).toBe(1);
  });

  it('debits once when a redemption is retried with the same key (R2)', async () => {
    const code = await makeCard(100);

    const first = await redeem(code, 40, 'gc-retry');
    const second = await redeem(code, 40, 'gc-retry');

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.response.headers['Idempotent-Replay']).toBe('true');
    expect(JSON.stringify(second.response.body)).toBe(JSON.stringify(first.response.body));

    expect(await balanceOf(code)).toBe(60);
    expect(await countRows('gift_card_transactions')).toBe(1);
  });

  it('collapses simultaneous duplicate redemptions of the same key into one debit (R2)', async () => {
    const code = await makeCard(100);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => redeem(code, 20, 'gc-storm'))
    );

    for (const outcome of outcomes) {
      expect(outcome.error).toBeNull();
      expect(outcome.response.status).toBe(200);
    }

    expect(await balanceOf(code)).toBe(80);
    expect(await countRows('gift_card_transactions')).toBe(1);
  });

  it('leaves no key row when a redemption fails, so a corrected retry works (R4)', async () => {
    const code = await makeCard(10);

    const failed = await redeem(code, 50, 'gc-fail');
    expect(failed.error).toMatchObject({
      code: 'CONFLICT',
      message: 'Insufficient balance. Available: 10',
    });
    expect(await countRows('idempotency_keys')).toBe(0);
    expect(await balanceOf(code)).toBe(10);

    const corrected = await redeem(code, 10, 'gc-fail');
    expect(corrected.error).toBeNull();
    expect(await balanceOf(code)).toBe(0);
  });

  function exchangeBody(returnProductId: number, newProductId: number, newQuantity: number) {
    return {
      original_sale_id: saleId,
      returned_items: [
        {
          product_id: returnProductId,
          quantity: 1,
          price: 10,
          reason: 'size',
          condition: 'good',
        },
      ],
      new_items: [{ product_id: newProductId, quantity: newQuantity, price: 10 }],
    };
  }

  it('rolls back the returned-item restock when a new item exceeds stock (R4)', async () => {
    const returned = await makeProduct('EXC-RET', 5);
    const wanted = await makeProduct('EXC-NEW', 1);

    const { error } = await exchange(exchangeBody(returned, wanted, 3));

    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: `Insufficient stock for product ID ${wanted}`,
    });

    // The restock ran before the failing deduction, so only a real ROLLBACK undoes it.
    expect(await stockOf(returned)).toBe(5);
    expect(await stockOf(wanted)).toBe(1);
    expect(await countRows('exchanges')).toBe(0);
    expect(await countRows('exchange_returned_items')).toBe(0);
    expect(await countRows('exchange_new_items')).toBe(0);
  });

  it('never drives product stock negative under concurrent exchanges (R1)', async () => {
    const returned = await makeProduct('EXC-CRET', 100);
    const wanted = await makeProduct('EXC-CNEW', 5);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => exchange(exchangeBody(returned, wanted, 2)))
    );

    const created = outcomes.filter((o) => o.error === null);
    // Five requests want two units each out of a stock of five: exactly two can commit.
    expect(created).toHaveLength(2);

    for (const failure of outcomes.filter((o) => o.error !== null)) {
      expect(failure.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: `Insufficient stock for product ID ${wanted}`,
      });
    }

    expect(await stockOf(wanted)).toBe(5 - created.length * 2);
    expect(await stockOf(wanted)).toBeGreaterThanOrEqual(0);
    expect(await countRows('exchanges')).toBe(created.length);
    // Only committed exchanges restocked the returned product.
    expect(await stockOf(returned)).toBe(100 + created.length);
  });

  it('creates one exchange when the same key is retried (R2)', async () => {
    const returned = await makeProduct('EXC-KRET', 10);
    const wanted = await makeProduct('EXC-KNEW', 10);

    const first = await exchange(exchangeBody(returned, wanted, 1), 'exc-retry');
    const second = await exchange(exchangeBody(returned, wanted, 1), 'exc-retry');

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.response.headers['Idempotent-Replay']).toBe('true');
    expect(JSON.stringify(second.response.body)).toBe(JSON.stringify(first.response.body));

    expect(await countRows('exchanges')).toBe(1);
    expect(await stockOf(wanted)).toBe(9);
    expect(await stockOf(returned)).toBe(11);
  });

  it('never lets concurrent manual adjustments drive stock negative (R1)', async () => {
    const productId = await makeProduct('ADJ-CONC', 10);

    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        adjustStock(productId, { delta: -4, reason: 'Shrinkage' }, userId)
      )
    );

    const fulfilled = settled.filter((s) => s.status === 'fulfilled');
    // Ten units, four per adjustment: two can succeed, the rest must be refused.
    expect(fulfilled).toHaveLength(2);

    for (const outcome of settled.filter((s) => s.status === 'rejected')) {
      expect((outcome as PromiseRejectedResult).reason.message).toBe('Stock cannot go below zero');
    }

    expect(await stockOf(productId)).toBe(2);
    expect(await countRows('stock_adjustments')).toBe(2);
  });
});
