/**
 * Store credit: the ledger, and the exchange that issues it (#138).
 *
 * `exchanges.payment_method` has always accepted `store_credit`, and `writeExchange`
 * defaults to it whenever an exchange leaves the shop owing the customer money -- but no
 * code wrote a balance anywhere. The exchange recorded that the customer was owed money
 * and then lost it, and their only recourse was that somebody remembered.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { StoreCreditRepository } from '../src/modules/commerce/storeCredit/repository';
import { StoreCreditService } from '../src/modules/commerce/storeCredit/service';

const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

describe('store credit (#138)', () => {
  let testPool: PgPool;
  const repo = new StoreCreditRepository();
  const service = new StoreCreditService(repo);

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, MIGRATIONS_DIR);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM customer_credit_ledger');
    await testPool.query('DELETE FROM customers');
    await testPool.query(
      `INSERT INTO customers (id, name, phone) VALUES (1, 'Nadia', '01000000000')`
    );
  });

  it('starts a customer at zero without an entry to say so', async () => {
    const balance = await service.getBalance(1);
    expect(balance).toMatchObject({ customer_id: 1, balance: 0 });
    expect(balance?.entries).toEqual([]);
  });

  it('returns null for a customer that does not exist, rather than a balance of zero', async () => {
    // Zero and "no such customer" are different answers, and a credit balance is the
    // wrong place to blur them.
    expect(await service.getBalance(9999)).toBeNull();
  });

  it('issues credit and reports it as the sum of the entries', async () => {
    await service.issue({
      customer_id: 1,
      amount: 250,
      reason: 'Exchange EX-1',
      source_type: 'exchange',
      source_id: '1',
    });
    await service.issue({
      customer_id: 1,
      amount: 100,
      reason: 'Goodwill',
      source_type: 'manual',
    });

    const balance = await service.getBalance(1);
    expect(balance?.balance).toBe(350);
    expect(balance?.entries).toHaveLength(2);
  });

  it('spends credit, leaving the entries that explain the balance', async () => {
    await service.issue({
      customer_id: 1,
      amount: 500,
      reason: 'Exchange EX-1',
      source_type: 'exchange',
      source_id: '1',
    });

    const result = await service.redeem({ customer_id: 1, amount: 200, sale_id: 7 });

    expect(result.new_balance).toBe(300);
    expect(result.entry.delta).toBe(-200);
    expect((await service.getBalance(1))?.balance).toBe(300);

    // The ledger is the record: the spend did not overwrite the issue.
    expect((await service.getBalance(1))?.entries).toHaveLength(2);
  });

  it('refuses to overdraw, naming what is available', async () => {
    await service.issue({
      customer_id: 1,
      amount: 100,
      reason: 'Exchange EX-1',
      source_type: 'exchange',
      source_id: '1',
    });

    await expect(service.redeem({ customer_id: 1, amount: 150 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(service.redeem({ customer_id: 1, amount: 150 })).rejects.toThrow(/Available: 100/);

    // Refused, not partially applied.
    expect((await service.getBalance(1))?.balance).toBe(100);
  });

  it('refuses to spend against a customer with no credit at all', async () => {
    await expect(service.redeem({ customer_id: 1, amount: 1 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('refuses a non-positive movement in either direction', async () => {
    await expect(
      service.issue({ customer_id: 1, amount: 0, reason: 'x', source_type: 'manual' })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.redeem({ customer_id: 1, amount: -5 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('refuses to credit a customer that does not exist', async () => {
    await expect(
      service.issue({ customer_id: 9999, amount: 10, reason: 'x', source_type: 'manual' })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('keeps each entry traceable to what caused it', async () => {
    await service.issue({
      customer_id: 1,
      amount: 250,
      reason: 'Exchange EX-9',
      source_type: 'exchange',
      source_id: '9',
    });

    const [entry] = (await service.getBalance(1))!.entries;
    expect(entry).toMatchObject({ source_type: 'exchange', source_id: '9', delta: 250 });
  });
});
