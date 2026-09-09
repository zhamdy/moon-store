/**
 * Layaway installments under genuine concurrency (#127).
 *
 * `recordPayment` read `remaining_balance` outside its transaction, subtracted in
 * JavaScript, and wrote the absolute result back. Two installments taken at the same
 * till, or on two tills, both read 800, both wrote 400, and one customer's money
 * disappeared from the plan while its payment row stayed on the books.
 *
 * This is invisible on pg-mem, which has no MVCC: two "concurrent" writers there are
 * really sequential, so the lost update never happens and the suite passes against the
 * broken code. Only a real database can show it.
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { LayawayRepository } from '../../src/modules/pos/layaway/repository';
import { LayawayService } from '../../src/modules/pos/layaway/service';
import { LayawayController } from '../../src/modules/pos/layaway/controller';
import * as auditLogger from '../../../server/middleware/auditLogger';

interface CapturedResponse {
  status: number | null;
  body: unknown;
  headers: Record<string, string>;
}

describeWithPostgres('layaway installments under concurrency (#127)', () => {
  let harness: RealPostgresHarness;
  const repo = new LayawayRepository();
  const service = new LayawayService(repo);
  let customerId: number;
  let cashierId: number;

  beforeAll(async () => {
    harness = await setupRealPostgres('layaway-concurrency', { maxConnections: 6 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();

    const users = await harness.pool.query<{ id: number }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Cashier', 'c@moon.com', 'x', 'Cashier') RETURNING id"
    );
    cashierId = users.rows[0].id;

    const customers = await harness.pool.query<{ id: number }>(
      "INSERT INTO customers (name, phone) VALUES ('Nadia', '0100') RETURNING id"
    );
    customerId = customers.rows[0].id;

    // The audit logger reads req.socket.remoteAddress, which a hand-built request has
    // no reason to carry; what it writes is not what these cases are about.
    vi.spyOn(auditLogger, 'logAuditFromReq').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** An active plan of 1000 with a 200 deposit: 800 left to pay. */
  async function makePlan(remaining = 800): Promise<number> {
    const { rows } = await harness.pool.query<{ id: number }>(
      `INSERT INTO layaway_plans (plan_number, customer_id, total_amount, deposit_amount, remaining_balance, due_date, status, created_by)
       VALUES ($1, $2, 1000, 200, $3, NOW() + INTERVAL '30 days', 'active', $4) RETURNING id`,
      [`LAY-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, customerId, remaining, cashierId]
    );
    return rows[0].id;
  }

  async function readPlan(planId: number) {
    const { rows } = await harness.pool.query<{ remaining_balance: string; status: string }>(
      'SELECT remaining_balance, status FROM layaway_plans WHERE id = $1',
      [planId]
    );
    return { remaining: Number(rows[0].remaining_balance), status: rows[0].status };
  }

  async function countPayments(planId: number): Promise<number> {
    const { rows } = await harness.pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM layaway_payments WHERE plan_id = $1',
      [planId]
    );
    return rows[0].n;
  }

  /** Drives the real controller, which is where the idempotency wrapper lives. */
  async function payViaController(
    planId: number,
    amount: number,
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

    await new LayawayController(service).payInstallment(
      {
        params: { id: String(planId) },
        body: { amount },
        user: { id: cashierId, name: 'Cashier' },
        headers: key ? { 'idempotency-key': key } : {},
      } as unknown as Request,
      res,
      ((err: unknown) => {
        error = err;
      }) as NextFunction
    );

    return { response: captured, error };
  }

  it('lands both of two concurrent installments (#127 repro)', async () => {
    const planId = await makePlan(800);

    // Both read 800 under the old code, both wrote 400, and 400 of a customer's money
    // stopped existing on the plan while both payment rows remained.
    const outcomes = await Promise.allSettled([
      service.recordPayment(planId, { amount: 400 }, cashierId),
      service.recordPayment(planId, { amount: 400 }, cashierId),
    ]);

    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(2);

    const plan = await readPlan(planId);
    expect(plan.remaining).toBe(0);
    expect(plan.status).toBe('completed');
    expect(await countPayments(planId)).toBe(2);
  });

  it('never takes a plan below zero, however many installments race', async () => {
    const planId = await makePlan(500);

    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.recordPayment(planId, { amount: 200 }, cashierId))
    );

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    // 500 pays for two 200s; the third would overshoot and must be refused.
    expect(fulfilled).toHaveLength(2);

    const plan = await readPlan(planId);
    expect(plan.remaining).toBe(100);
    expect(plan.remaining).toBeGreaterThanOrEqual(0);
    expect(await countPayments(planId)).toBe(2);
  });

  it('refuses an installment that would overshoot, and writes no payment row', async () => {
    const planId = await makePlan(300);

    await expect(service.recordPayment(planId, { amount: 400 }, cashierId)).rejects.toMatchObject({
      name: 'PublicError',
    });

    expect((await readPlan(planId)).remaining).toBe(300);
    expect(await countPayments(planId)).toBe(0);
  });

  it('takes a retried installment once, and says it replayed', async () => {
    const planId = await makePlan(800);

    const first = await payViaController(planId, 400, 'installment-key');
    const second = await payViaController(planId, 400, 'installment-key');

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.response.headers['Idempotent-Replay']).toBe('true');
    expect(JSON.stringify(second.response.body)).toBe(JSON.stringify(first.response.body));

    // One payment, one deduction: the retry took nothing further from the customer.
    expect((await readPlan(planId)).remaining).toBe(400);
    expect(await countPayments(planId)).toBe(1);
  });

  it('refuses one key reused against a different plan instead of replaying it', async () => {
    const planA = await makePlan(800);
    const planB = await makePlan(800);

    await payViaController(planA, 400, 'shared-key');
    const { error } = await payViaController(planB, 400, 'shared-key');

    expect(error).toMatchObject({ name: 'PublicError', code: 'CONFLICT' });
    expect((await readPlan(planB)).remaining).toBe(800);
    expect(await countPayments(planB)).toBe(0);
  });

  it('serializes a cancel against a payment: one wins, the plan stays consistent', async () => {
    const planId = await makePlan(800);

    const outcomes = await Promise.allSettled([
      service.recordPayment(planId, { amount: 800 }, cashierId),
      service.cancelPlan(planId),
    ]);

    const plan = await readPlan(planId);

    // Whichever ran first, the plan cannot end up both paid off and cancelled, and a
    // payment cannot be booked against a cancelled plan.
    if (plan.status === 'completed') {
      expect(plan.remaining).toBe(0);
      expect(await countPayments(planId)).toBe(1);
    } else {
      expect(plan.status).toBe('cancelled');
      expect(await countPayments(planId)).toBe(0);
    }

    expect(outcomes.filter((o) => o.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
  });
});
