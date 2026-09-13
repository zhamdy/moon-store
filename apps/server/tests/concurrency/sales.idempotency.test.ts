/**
 * `POST /api/v1/sales` honouring `Idempotency-Key` end to end.
 *
 * Exercised through the controller rather than the service, because the parts that
 * matter most here are the controller's: the header is read, the replay suppresses the
 * notification and the audit entry, and the response body is byte-identical.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { SalesController } from '../../src/modules/pos/sales/controller';
import { resetEnvCache } from '../../src/config/env';
import { IDEMPOTENCY_KEY_REUSED } from '../../src/http/idempotency';
import * as notifications from '../../../server/services/notifications';
import * as auditLogger from '../../../server/middleware/auditLogger';

interface CapturedResponse {
  status: number | null;
  body: unknown;
  headers: Record<string, string>;
}

describeWithPostgres('POST /api/v1/sales idempotency', () => {
  let harness: RealPostgresHarness;
  let cashierId: number;
  let notifySpy: ReturnType<typeof vi.spyOn>;
  let auditSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    // The 20-way replay storm needs genuinely simultaneous requests.
    harness = await setupRealPostgres('sales-idempotency', { maxConnections: 12 });
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

    notifySpy = vi.spyOn(notifications, 'notifySale').mockImplementation(() => undefined as never);
    auditSpy = vi
      .spyOn(auditLogger, 'logAuditFromReq')
      .mockImplementation(() => undefined as never);

    delete process.env.IDEMPOTENCY_REQUIRED;
    resetEnvCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.IDEMPOTENCY_REQUIRED;
    resetEnvCache();
  });

  async function makeProduct(sku: string, stock: number, price = 100): Promise<number> {
    const { rows } = await harness.pool.query<{ id: number }>(
      'INSERT INTO products (name, sku, price, stock) VALUES ($1, $2, $3, $4) RETURNING id',
      [`Product ${sku}`, sku, price, stock]
    );
    return rows[0].id;
  }

  async function countRows(table: string): Promise<number> {
    const { rows } = await harness.pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${table}`
    );
    return rows[0].n;
  }

  /** Drives the real controller and captures what it wrote to the response. */
  async function postSale(
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

    await new SalesController().createSale(
      {
        body,
        user: { id: cashierId, name: 'Cashier' },
        headers: key ? { 'idempotency-key': key } : {},
      } as unknown as Request,
      res,
      next
    );

    return { response: captured, error };
  }

  function saleBody(productId: number, quantity = 1) {
    return {
      items: [{ product_id: productId, quantity, unit_price: 100 }],
      payment_method: 'Cash',
    };
  }

  it('persists one key row linked to the sale it produced', async () => {
    const productId = await makeProduct('SKU-I1', 10);

    const { response, error } = await postSale(saleBody(productId), 'key-1');

    expect(error).toBeNull();
    expect(response.status).toBe(201);

    const { rows } = await harness.pool.query<{
      key: string;
      endpoint: string;
      user_id: number;
      resource_type: string;
      resource_id: number;
      response_status: number;
    }>('SELECT * FROM idempotency_keys');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: 'key-1',
      endpoint: 'POST /api/v1/sales',
      user_id: cashierId,
      resource_type: 'sale',
      response_status: 201,
    });

    const sales = await harness.pool.query<{ id: number }>('SELECT id FROM sales');
    expect(rows[0].resource_id).toBe(sales.rows[0].id);
  });

  it('replays the original response byte-identically and flags it', async () => {
    const productId = await makeProduct('SKU-I2', 10);

    const first = await postSale(saleBody(productId), 'key-2');
    const second = await postSale(saleBody(productId), 'key-2');

    expect(second.error).toBeNull();
    expect(second.response.status).toBe(201);
    expect(second.response.headers['Idempotent-Replay']).toBe('true');
    expect(JSON.stringify(second.response.body)).toBe(JSON.stringify(first.response.body));

    expect(await countRows('sales')).toBe(1);
    expect(await countRows('sale_items')).toBe(1);
  });

  it('does not re-notify or re-audit on a replay', async () => {
    const productId = await makeProduct('SKU-I3', 10);

    await postSale(saleBody(productId), 'key-3');
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);

    await postSale(saleBody(productId), 'key-3');

    // A replayed request must not send a second SMS or write a second audit entry.
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });

  it('behaves exactly as before when no key is sent, writing no key row', async () => {
    const productId = await makeProduct('SKU-I4', 10);

    const { response, error } = await postSale(saleBody(productId));

    expect(error).toBeNull();
    expect(response.status).toBe(201);
    expect(response.headers['Idempotent-Replay']).toBeUndefined();
    expect(await countRows('idempotency_keys')).toBe(0);
    expect(await countRows('sales')).toBe(1);
  });

  it('treats two different keys with identical bodies as two distinct sales', async () => {
    const productId = await makeProduct('SKU-I5', 10);

    await postSale(saleBody(productId), 'key-5a');
    await postSale(saleBody(productId), 'key-5b');

    // Identical payloads are not duplicates; only a repeated key is.
    expect(await countRows('sales')).toBe(2);
    expect(await countRows('idempotency_keys')).toBe(2);
  });

  it('rejects the same key with a changed cart and creates no second sale', async () => {
    const productId = await makeProduct('SKU-I6', 10);

    await postSale(saleBody(productId, 1), 'key-6');
    const { error } = await postSale(saleBody(productId, 2), 'key-6');

    expect(error).toMatchObject({ name: 'PublicError', code: 'CONFLICT' });
    expect((error as { details: { code: string }[] }).details[0].code).toBe(IDEMPOTENCY_KEY_REUSED);
    expect(await countRows('sales')).toBe(1);
  });

  it('leaves no key row when the request fails validation, so a corrected retry works', async () => {
    const productId = await makeProduct('SKU-I7', 10);

    const mismatched = {
      ...saleBody(productId),
      payments: [{ method: 'Cash', amount: 1 }],
    };

    const failed = await postSale(mismatched, 'key-7');
    expect(failed.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await countRows('idempotency_keys')).toBe(0);

    // The key identifies a committed outcome, never a failed attempt.
    const corrected = await postSale(saleBody(productId), 'key-7');
    expect(corrected.error).toBeNull();
    expect(corrected.response.status).toBe(201);
    expect(await countRows('sales')).toBe(1);
  });

  it('leaves no key row and no sale when stock is insufficient', async () => {
    const productId = await makeProduct('SKU-I8', 1);

    const { error } = await postSale(saleBody(productId, 5), 'key-8');

    expect(error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await countRows('idempotency_keys')).toBe(0);
    expect(await countRows('sales')).toBe(0);
  });

  it('collapses 20 simultaneous identical requests into exactly one sale (R2, R4)', async () => {
    const productId = await makeProduct('SKU-I9', 50);

    const outcomes = await Promise.all(
      Array.from({ length: 20 }, () => postSale(saleBody(productId), 'storm'))
    );

    for (const outcome of outcomes) {
      expect(outcome.error).toBeNull();
      expect(outcome.response.status).toBe(201);
    }

    const bodies = new Set(outcomes.map((o) => JSON.stringify(o.response.body)));
    expect(bodies.size).toBe(1);

    expect(await countRows('sales')).toBe(1);
    expect(await countRows('sale_items')).toBe(1);
    expect(await countRows('stock_adjustments')).toBe(1);
    expect(await countRows('idempotency_keys')).toBe(1);

    const { rows } = await harness.pool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    expect(Number(rows[0].stock)).toBe(49);

    // Exactly one notification, however many duplicates arrived.
    expect(notifySpy).toHaveBeenCalledTimes(1);
  });

  it('requires the header once IDEMPOTENCY_REQUIRED closes the window', async () => {
    process.env.IDEMPOTENCY_REQUIRED = 'true';
    resetEnvCache();
    const productId = await makeProduct('SKU-I10', 10);

    const keyless = await postSale(saleBody(productId));
    expect(keyless.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(await countRows('sales')).toBe(0);

    const keyed = await postSale(saleBody(productId), 'key-10');
    expect(keyed.error).toBeNull();
    expect(keyed.response.status).toBe(201);
  });
});
