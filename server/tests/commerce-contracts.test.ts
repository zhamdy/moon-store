import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import { Pool as PgPool } from 'pg';
import { createPgMemPool } from './support/pgMem';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import { GiftCardsService } from '../src/modules/commerce/giftCards/service';
import {
  parseCustomerListQuery,
  parseCustomerSalesQuery,
} from '../src/modules/commerce/customers/types';
import {
  parseGiftCardListQuery,
  parseGiftCardTransactionQuery,
} from '../src/modules/commerce/giftCards/types';
import { parseCouponListQuery } from '../src/modules/commerce/coupons/types';
import { parseFeedbackListQuery } from '../src/modules/commerce/feedback/types';
import { parseOnlineOrderListQuery } from '../src/modules/commerce/onlineOrders/types';
import { parseVendorListQuery } from '../src/modules/commerce/vendors/types';
import { parseVendorPayoutQuery } from '../src/modules/commerce/vendors/types';
import { parseWarrantyListQuery } from '../src/modules/commerce/warranty/types';

describe('commerce collection contracts', () => {
  it('parses canonical customer collection queries', () => {
    expect(
      parseCustomerListQuery({
        page: '2',
        pageSize: '25',
        search: 'Mona',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
    ).toEqual({
      page: 2,
      pageSize: 25,
      search: 'Mona',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(parseCustomerSalesQuery({ page: '3', pageSize: '10' })).toEqual({
      page: 3,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
  });

  it('rejects legacy customer limits and unknown filters', () => {
    expect(() => parseCustomerListQuery({ limit: '1000' })).toThrow();
    expect(() => parseCustomerSalesQuery({ limit: '100' })).toThrow();
    expect(() => parseCustomerListQuery({ search: 'x'.repeat(101) })).toThrow();
  });

  it('uses canonical pagination for gift cards and their transactions', () => {
    expect(parseGiftCardListQuery({ page: '2', pageSize: '50', status: 'active' })).toMatchObject({
      page: 2,
      pageSize: 50,
      status: 'active',
    });
    expect(parseGiftCardTransactionQuery({ page: '1', pageSize: '25' })).toEqual({
      page: 1,
      pageSize: 25,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(() => parseGiftCardListQuery({ limit: '200' })).toThrow();
  });

  it('uses canonical pagination for coupons and feedback', () => {
    expect(parseCouponListQuery({ page: '1', pageSize: '25', search: 'VIP' })).toMatchObject({
      page: 1,
      pageSize: 25,
      sortBy: 'createdAt',
      sortOrder: 'asc',
      search: 'VIP',
    });
    expect(parseFeedbackListQuery({ page: '2', pageSize: '10', rating: '5' })).toMatchObject({
      page: 2,
      pageSize: 10,
      rating: 5,
    });
    expect(() => parseCouponListQuery({ limit: '25' })).toThrow();
    expect(() => parseFeedbackListQuery({ limit: '20' })).toThrow();
  });

  it('uses canonical pagination for orders, vendors, and warranty', () => {
    expect(parseOnlineOrderListQuery({ page: '1', pageSize: '25' })).toMatchObject({
      page: 1,
      pageSize: 25,
    });
    expect(parseVendorListQuery({ page: '2', pageSize: '10', status: 'active' })).toMatchObject({
      page: 2,
      pageSize: 10,
      status: 'active',
    });
    expect(parseWarrantyListQuery({ page: '3', pageSize: '50' })).toMatchObject({
      page: 3,
      pageSize: 50,
    });
    expect(() => parseOnlineOrderListQuery({ limit: '20' })).toThrow();
    expect(() => parseVendorListQuery({ limit: '20' })).toThrow();
    expect(parseVendorPayoutQuery({ page: '2', pageSize: '25' })).toEqual({
      page: 2,
      pageSize: 25,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(() => parseVendorPayoutQuery({ limit: '20' })).toThrow();
    expect(() => parseWarrantyListQuery({ limit: '20' })).toThrow();
  });
});

describe('gift card redemption invariants', () => {
  let testPool: PgPool;
  let userId: number;
  let saleId: number;

  beforeAll(async () => {
    testPool = createPgMemPool();
    setPool(testPool);
    await runMigrationsUp(testPool, path.join(__dirname, '../src/database/migrations'));
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await testPool.query('DELETE FROM gift_card_transactions');
    await testPool.query('DELETE FROM gift_cards');
    await testPool.query('DELETE FROM sales');
    await testPool.query('DELETE FROM users');

    const users = await testPool.query<{ id: number }>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Cashier', 'gc@moon.com', 'x', 'Cashier') RETURNING id`
    );
    userId = users.rows[0].id;

    const sales = await testPool.query<{ id: number }>(
      'INSERT INTO sales (total, cashier_id) VALUES (100, $1) RETURNING id',
      [userId]
    );
    saleId = sales.rows[0].id;
  });

  async function makeCard(options: {
    balance: number;
    status?: string;
    expiresAt?: string | null;
  }): Promise<string> {
    const code = `GC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await testPool.query(
      `INSERT INTO gift_cards (code, barcode, initial_value, balance, status, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        code,
        code.replace('GC-', '890200'),
        options.balance,
        options.balance,
        options.status ?? 'active',
        options.expiresAt ?? null,
        userId,
      ]
    );
    return code;
  }

  async function balanceOf(code: string): Promise<number> {
    const { rows } = await testPool.query<{ balance: number }>(
      'SELECT balance FROM gift_cards WHERE code = $1',
      [code]
    );
    return Number(rows[0].balance);
  }

  async function transactionCount(): Promise<number> {
    const { rows } = await testPool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM gift_card_transactions'
    );
    return rows[0].n;
  }

  it('debits the redeemed amount and writes exactly one transaction row', async () => {
    const code = await makeCard({ balance: 100 });

    const result = await new GiftCardsService().redeem(code, 50, saleId, userId);

    expect(result.new_balance).toBe(50);
    expect(result.transaction).toMatchObject({ balance_before: 100, balance_after: 50 });
    expect(await balanceOf(code)).toBe(50);
    expect(await transactionCount()).toBe(1);
  });

  it('allows redeeming the exact remaining balance, leaving zero', async () => {
    const code = await makeCard({ balance: 100 });

    const result = await new GiftCardsService().redeem(code, 100, saleId, userId);

    expect(result.new_balance).toBe(0);
    expect(await balanceOf(code)).toBe(0);
  });

  it('refuses an over-redemption with the existing message and no balance change', async () => {
    const code = await makeCard({ balance: 40 });

    await expect(new GiftCardsService().redeem(code, 41, saleId, userId)).rejects.toThrow(
      'Insufficient balance. Available: 40'
    );
    expect(await balanceOf(code)).toBe(40);
    expect(await transactionCount()).toBe(0);
  });

  it('refuses an inactive card with the existing message and no balance change', async () => {
    const code = await makeCard({ balance: 100, status: 'inactive' });

    await expect(new GiftCardsService().redeem(code, 10, saleId, userId)).rejects.toThrow(
      'Gift card is not active'
    );
    expect(await balanceOf(code)).toBe(100);
    expect(await transactionCount()).toBe(0);
  });

  it('refuses an expired card with the existing message and no balance change', async () => {
    const code = await makeCard({ balance: 100, expiresAt: '2020-01-01T00:00:00Z' });

    await expect(new GiftCardsService().redeem(code, 10, saleId, userId)).rejects.toThrow(
      'Gift card has expired'
    );
    expect(await balanceOf(code)).toBe(100);
    expect(await transactionCount()).toBe(0);
  });

  it('reports an unknown code as not found', async () => {
    await expect(new GiftCardsService().redeem('GC-NOPE', 10, saleId, userId)).rejects.toThrow(
      'Gift card not found'
    );
  });
});
