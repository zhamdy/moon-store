import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { newDb } from 'pg-mem';
import { Pool as PgPool } from 'pg';
import path from 'path';
import fs from 'fs';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import {
  calculateSaleTotals,
  executeSaleTransaction,
  executeRefundTransaction,
} from '../services/saleService';
import {
  parseSaleListQuery,
  toMinorUnits,
  fromMinorUnits,
  STRICT_SPLIT_PAYMENT_VALIDATION,
  SPLIT_PAYMENT_MISMATCH_CODE,
  SalesValidationError,
} from '../src/modules/pos/sales/types';
import { SalesRepository } from '../src/modules/pos/sales/repository';
import { SalesController } from '../src/modules/pos/sales/controller';
import { salesService, calculateSaleBreakdown } from '../src/modules/pos/sales/service';
import { PublicError } from '../src/modules/http/errors';
import { paymentEntrySchema, saleSchema, MAX_PAYMENT_AMOUNT_MAJOR } from '../validators/saleSchema';
import { openApiSpec } from '../src/docs/openapi';
import {
  parseLoyaltySettings,
  LOYALTY_SETTINGS_DEFAULTS,
} from '../src/modules/core/settings/types';

const checkoutTotalsFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../contracts/checkout-totals.v1.json'), 'utf8')
);

describe('Sales - Mutation Contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards create validation errors to the shared error handler', async () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const next = vi.fn();

    await new SalesController().createSale(
      { body: {} } as Request,
      { status, json } as unknown as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }));
    expect(status).not.toHaveBeenCalled();
  });

  it('maps known create failures to the canonical validation error', async () => {
    vi.spyOn(salesService, 'executeSale').mockRejectedValueOnce(
      new Error('Insufficient stock for product')
    );
    const next = vi.fn();

    await new SalesController().createSale(
      {
        body: {
          items: [{ product_id: 1, quantity: 1, unit_price: 10 }],
          payment_method: 'Card',
        },
        user: { id: 1, name: 'Cashier' },
      } as unknown as Request,
      { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining<Partial<PublicError>>({ code: 'VALIDATION_ERROR' })
    );
  });

  it('maps a missing refund sale to the canonical not-found error', async () => {
    vi.spyOn(salesService, 'executeRefund').mockRejectedValueOnce(new Error('Sale not found'));
    const next = vi.fn();

    await new SalesController().refundSale(
      {
        params: { id: '42' },
        body: { items: [{ product_id: 1, quantity: 1, unit_price: 10 }], reason: 'Returned' },
        user: { id: 1, name: 'Cashier' },
      } as unknown as Request,
      { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining<Partial<PublicError>>({ code: 'NOT_FOUND' })
    );
  });
});

describe('Sales - List Contract', () => {
  it('parses canonical pagination and filters', () => {
    expect(
      parseSaleListQuery({
        page: '2',
        pageSize: '50',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-22',
        paymentMethod: 'Card',
        cashierId: '7',
        search: 'private receipt',
        sortBy: 'total',
        sortOrder: 'desc',
      })
    ).toEqual({
      page: 2,
      pageSize: 50,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-22',
      paymentMethod: 'Card',
      cashierId: 7,
      search: 'private receipt',
      sortBy: 'total',
      sortOrder: 'desc',
    });
  });

  it('rejects legacy and unknown list parameters', () => {
    expect(() => parseSaleListQuery({ limit: '200' })).toThrow();
    expect(() => parseSaleListQuery({ payment_method: 'Cash' })).toThrow();
  });
});

let testPool: PgPool;

beforeAll(async () => {
  const memDb = newDb({ noAstCoverageCheck: true });
  const { Pool } = memDb.adapters.createPg();
  testPool = new Pool() as unknown as PgPool;
  setPool(testPool);

  const migrationsDir = path.join(__dirname, '../src/database/migrations');
  await runMigrationsUp(testPool, migrationsDir);
});

afterAll(async () => {
  await closePool();
});

describe('Sales - Schema Validation', () => {
  it('should accept a valid sale', () => {
    const result = saleSchema.safeParse({
      items: [{ product_id: 1, quantity: 2, unit_price: 150 }],
      discount: 10,
      discount_type: 'fixed',
      payment_method: 'Cash',
    });
    expect(result.success).toBe(true);
  });

  it('should reject sale with no items', () => {
    const result = saleSchema.safeParse({
      items: [],
      payment_method: 'Cash',
    });
    expect(result.success).toBe(false);
  });

  it('should reject sale with negative quantity', () => {
    const result = saleSchema.safeParse({
      items: [{ product_id: 1, quantity: -1, unit_price: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid payment method', () => {
    const result = saleSchema.safeParse({
      items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
      payment_method: 'Bitcoin',
    });
    expect(result.success).toBe(false);
  });

  it('should accept sale with optional fields', () => {
    const result = saleSchema.safeParse({
      items: [{ product_id: 1, quantity: 1, unit_price: 200, memo: 'Gift wrap' }],
      discount: 5,
      discount_type: 'percentage',
      payment_method: 'Card',
      customer_id: 3,
      notes: 'VIP customer',
      tip: 20,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tip).toBe(20);
      expect(result.data.notes).toBe('VIP customer');
    }
  });

  it('should apply defaults for missing optional fields', () => {
    const result = saleSchema.safeParse({
      items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.discount).toBe(0);
      expect(result.data.discount_type).toBe('fixed');
      expect(result.data.payment_method).toBe('Cash');
      expect(result.data.tip).toBe(0);
    }
  });
});

describe('Sales - PostgreSQL Service & Transaction', () => {
  beforeEach(async () => {
    // Clear and seed test items
    await testPool.query('DELETE FROM sale_items');
    await testPool.query('DELETE FROM sales');
    await testPool.query('DELETE FROM products');
    await testPool.query('DELETE FROM users');

    await testPool.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [1, 'Admin', 'admin@moon.com', 'hash', 'Admin']
    );
    await testPool.query(
      'INSERT INTO products (id, name, sku, price, cost_price, stock) VALUES ($1, $2, $3, $4, $5, $6)',
      [1, 'Silk Dress', 'SKU-001', 500, 250, 10]
    );
    await testPool.query(
      'INSERT INTO products (id, name, sku, price, cost_price, stock) VALUES ($1, $2, $3, $4, $5, $6)',
      [2, 'Cotton Shirt', 'SKU-002', 200, 100, 5]
    );
  });

  it('should deduct stock and record sale atomically in PostgreSQL', async () => {
    const input = {
      items: [{ product_id: 1, quantity: 2, unit_price: 500 }],
      discount: 0,
      discount_type: 'fixed',
      payment_method: 'Cash',
    };

    const totals = await calculateSaleTotals(input, testPool);
    const sale = await executeSaleTransaction(input, totals, 1, testPool);

    expect(Number(sale.total)).toBe(1000);

    const prod = await testPool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [1]
    );
    expect(prod.rows[0].stock).toBe(8); // 10 - 2

    const items = await testPool.query('SELECT * FROM sale_items WHERE sale_id = $1', [sale.id]);
    expect(items.rows).toHaveLength(1);
  });

  it('should rollback transaction on insufficient stock', async () => {
    const input = {
      items: [{ product_id: 1, quantity: 20, unit_price: 500 }], // only 10 available
      discount: 0,
      discount_type: 'fixed',
      payment_method: 'Cash',
    };

    const totals = await calculateSaleTotals(input, testPool);
    await expect(executeSaleTransaction(input, totals, 1, testPool)).rejects.toThrow(
      /Insufficient stock/
    );

    const prod = await testPool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [1]
    );
    expect(prod.rows[0].stock).toBe(10); // unchanged

    const sales = await testPool.query('SELECT * FROM sales');
    expect(sales.rows).toHaveLength(0); // no orphaned sale
  });

  it('should execute refund and restock product in PostgreSQL', async () => {
    const input = {
      items: [{ product_id: 1, quantity: 2, unit_price: 500 }],
      discount: 0,
      discount_type: 'fixed',
      payment_method: 'Cash',
    };

    const totals = await calculateSaleTotals(input, testPool);
    const sale = await executeSaleTransaction(input, totals, 1, testPool);

    const refundRes = await executeRefundTransaction(
      sale.id,
      {
        items: [{ product_id: 1, quantity: 1, unit_price: 500 }],
        reason: 'Wrong size',
        restock: true,
      },
      1,
      testPool
    );

    expect(refundRes.refundStatus).toBe('partial');
    expect(refundRes.newRefundedTotal).toBe(500);

    const prod = await testPool.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [1]
    );
    expect(prod.rows[0].stock).toBe(9); // 8 + 1 restocked
  });

  it('should auto-fetch catalog price if unit_price is not provided', async () => {
    const input = {
      items: [{ product_id: 1, quantity: 2 }], // Silk Dress is 500 in catalog
      discount: 0,
      payment_method: 'Cash',
    };

    const totals = await calculateSaleTotals(input as any, testPool);
    expect(totals.subtotal).toBe(1000);
    const sale = await executeSaleTransaction(input as any, totals, 1, testPool);
    expect(Number(sale.total)).toBe(1000);
  });

  it('returns filtered totals, aggregates, and deterministic pages from one predicate', async () => {
    await testPool.query(
      `INSERT INTO sales (total, payment_method, cashier_id, created_at)
       VALUES (100, 'Cash', 1, '2026-08-20T10:00:00Z'),
              (250, 'Card', 1, '2026-08-21T10:00:00Z'),
              (300, 'Card', 1, '2026-08-21T10:00:00Z')`
    );
    const repository = new SalesRepository();
    const result = await repository.listSales(
      {
        page: 1,
        pageSize: 10,
        paymentMethod: 'Card',
        dateFrom: '2026-08-21',
        dateTo: '2026-08-21',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      testPool
    );

    expect(result.total).toBe(2);
    expect(result.totalRevenue).toBe(550);
    expect(result.rows.map((row) => Number(row.total))).toEqual([300, 250]);
  });
});

describe('Sales - Discount Calculation', () => {
  it('should apply fixed discount', () => {
    const subtotal = 1000;
    const discount = 100;
    const discountType = 'fixed';
    const discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
    const total = Math.max(0, subtotal - discountAmount);
    expect(total).toBe(900);
  });

  it('should apply percentage discount', () => {
    const subtotal = 1000;
    const discount = 15;
    const discountType = 'percentage';
    const discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
    const total = Math.max(0, subtotal - discountAmount);
    expect(total).toBe(850);
  });

  it('should not go below zero', () => {
    const subtotal = 100;
    const discount = 200;
    const total = Math.max(0, subtotal - discount);
    expect(total).toBe(0);
  });
});

describe('Sales - Tax Calculation', () => {
  it('should calculate exclusive tax correctly', () => {
    const afterDiscount = 1000;
    const taxRate = 14; // Egypt VAT
    const taxAmount = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
    const total = afterDiscount + taxAmount;
    expect(taxAmount).toBe(140);
    expect(total).toBe(1140);
  });

  it('should extract inclusive tax correctly', () => {
    const afterDiscount = 1140; // price already includes 14% tax
    const taxRate = 14;
    const taxAmount = Math.round((afterDiscount - afterDiscount / (1 + taxRate / 100)) * 100) / 100;
    expect(taxAmount).toBe(140);
  });

  it('should handle zero tax rate', () => {
    const afterDiscount = 1000;
    const taxRate = 0;
    const taxAmount = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
    expect(taxAmount).toBe(0);
  });
});

describe('Canonical loyalty settings parsing (issue #31 / checkout financial contract)', () => {
  it('happy path: canonical settings enabled with direct units parse exactly', () => {
    const parsed = parseLoyaltySettings({
      loyalty_enabled: 'true',
      loyalty_points_per_egp: '2',
      loyalty_egp_per_point: '0.1',
    });

    expect(parsed).toEqual({ enabled: true, pointsPerEgp: 2, egpPerPoint: 0.1 });
  });

  it('compatibility: only legacy alias keys exist -> their configured value is preserved under canonical names', () => {
    const parsed = parseLoyaltySettings({
      loyalty_enabled: 'true',
      loyalty_earn_rate: '3',
      loyalty_redeem_value: '0.25',
    });

    expect(parsed).toEqual({ enabled: true, pointsPerEgp: 3, egpPerPoint: 0.25 });
  });

  it('precedence: canonical and alias both exist -> canonical wins deterministically', () => {
    const parsed = parseLoyaltySettings({
      loyalty_enabled: 'true',
      loyalty_points_per_egp: '2',
      loyalty_earn_rate: '999',
      loyalty_egp_per_point: '0.1',
      loyalty_redeem_value: '999',
    });

    expect(parsed.pointsPerEgp).toBe(2);
    expect(parsed.egpPerPoint).toBe(0.1);
  });

  it('missing settings resolve to the documented safe defaults', () => {
    expect(parseLoyaltySettings({})).toEqual(LOYALTY_SETTINGS_DEFAULTS);
  });

  it.each([
    ['zero', '0'],
    ['negative', '-1'],
    ['non-numeric', 'abc'],
    ['reciprocal-looking (per-100 style value left over from the old UI)', 'NaN'],
    ['empty string', ''],
  ])(
    'error path: %s canonical value falls back to the safe default, not the alias',
    (_label, bad) => {
      const parsed = parseLoyaltySettings({
        loyalty_points_per_egp: bad,
        loyalty_earn_rate: '5', // must NOT be used once the canonical key is present
        loyalty_egp_per_point: bad,
        loyalty_redeem_value: '5',
      });

      expect(parsed.pointsPerEgp).toBe(LOYALTY_SETTINGS_DEFAULTS.pointsPerEgp);
      expect(parsed.egpPerPoint).toBe(LOYALTY_SETTINGS_DEFAULTS.egpPerPoint);
    }
  );

  it('error path: an invalid alias value (no canonical key present) also falls back to the safe default', () => {
    const parsed = parseLoyaltySettings({
      loyalty_earn_rate: '-5',
      loyalty_redeem_value: 'not-a-number',
    });

    expect(parsed.pointsPerEgp).toBe(LOYALTY_SETTINGS_DEFAULTS.pointsPerEgp);
    expect(parsed.egpPerPoint).toBe(LOYALTY_SETTINGS_DEFAULTS.egpPerPoint);
  });

  it('loyalty_enabled is false unless explicitly the string "true"', () => {
    expect(parseLoyaltySettings({ loyalty_enabled: 'false' }).enabled).toBe(false);
    expect(parseLoyaltySettings({ loyalty_enabled: 'yes' }).enabled).toBe(false);
    expect(parseLoyaltySettings({}).enabled).toBe(false);
  });
});

// ─── Unit 2: pure server calculation vs. the shared checkout-totals fixture ─

function fixtureCaseToCalculationInput(fixtureCase: any) {
  const { input } = fixtureCase;
  return {
    items: input.items.map((item: any) => ({
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
    })),
    manualDiscount:
      input.manualDiscount.type === 'percentage'
        ? { type: 'percentage' as const, valuePercent: input.manualDiscount.valuePercent }
        : { type: 'fixed' as const, valueMinor: input.manualDiscount.valueMinor },
    couponId: null,
    couponDiscountMinor: input.couponDiscountMinor,
    loyalty: {
      enabled: input.loyalty.enabled,
      pointsPerEgp: input.loyalty.pointsPerEgp,
      egpPerPointMinor: input.loyalty.egpPerPointMinor,
      pointsRedeemed: input.loyalty.pointsRedeemed,
    },
    tax: {
      enabled: input.tax.enabled,
      ratePercent: input.tax.ratePercent,
      mode: input.tax.mode,
    },
    tipMinor: input.tipMinor,
  };
}

describe('Unit 2 - calculateSaleBreakdown vs. contracts/checkout-totals.v1.json', () => {
  it.each(checkoutTotalsFixture.cases.map((c: any) => [c.name, c]))(
    'reproduces the "%s" fixture case exactly, in integer minor units',
    (_name: string, fixtureCase: any) => {
      const breakdown = calculateSaleBreakdown(fixtureCaseToCalculationInput(fixtureCase));
      expect(breakdown).toMatchObject(fixtureCase.expected);
    }
  );

  it('caps manual discount, coupon, and loyalty at the remaining value so tax base never goes negative, and tip remains payable', () => {
    const breakdown = calculateSaleBreakdown({
      items: [{ unitPriceMinor: 10000, quantity: 1 }],
      manualDiscount: { type: 'fixed', valueMinor: 50000 }, // far exceeds subtotal
      couponId: 7,
      couponDiscountMinor: 50000, // remaining is already 0 by this stage
      loyalty: {
        enabled: true,
        pointsPerEgp: 2,
        egpPerPointMinor: 10,
        pointsRedeemed: 500,
        pointsBalance: 500,
      },
      tax: { enabled: true, ratePercent: 14, mode: 'exclusive' },
      tipMinor: 500,
    });

    expect(breakdown.manualDiscountMinor).toBe(10000);
    expect(breakdown.couponDiscountMinor).toBe(0);
    expect(breakdown.pointsRedeemed).toBe(0);
    expect(breakdown.pointsDiscountMinor).toBe(0);
    expect(breakdown.taxableBaseMinor).toBe(0);
    expect(breakdown.taxAmountMinor).toBe(0);
    expect(breakdown.tipMinor).toBe(500);
    expect(breakdown.amountDueMinor).toBe(500);
  });

  it('caps loyalty redemption by point balance even when the monetary value would still fit', () => {
    const breakdown = calculateSaleBreakdown({
      items: [{ unitPriceMinor: 100000, quantity: 1 }],
      manualDiscount: { type: 'fixed', valueMinor: 0 },
      couponId: null,
      couponDiscountMinor: 0,
      loyalty: {
        enabled: true,
        pointsPerEgp: 2,
        egpPerPointMinor: 10,
        pointsRedeemed: 1000,
        pointsBalance: 50, // customer only has 50 points
      },
      tax: { enabled: false, ratePercent: 0, mode: 'exclusive' },
      tipMinor: 0,
    });

    expect(breakdown.pointsRedeemed).toBe(50);
    expect(breakdown.pointsDiscountMinor).toBe(500);
    expect(breakdown.amountDueMinor).toBe(99500);
  });

  it('never trusts a caller-supplied couponId as evidence that a discount was actually applied to a zero-remaining sale', () => {
    // Even though a couponId is passed, if manual discount already consumed
    // the subtotal, the coupon's monetary effect is correctly zero -- but the
    // identity is preserved so the caller (SalesService) can still decide
    // whether to record coupon usage.
    const breakdown = calculateSaleBreakdown({
      items: [{ unitPriceMinor: 1000, quantity: 1 }],
      manualDiscount: { type: 'fixed', valueMinor: 1000 },
      couponId: 3,
      couponDiscountMinor: 500,
      loyalty: { enabled: false, pointsPerEgp: 0, egpPerPointMinor: 0, pointsRedeemed: 0 },
      tax: { enabled: false, ratePercent: 0, mode: 'exclusive' },
      tipMinor: 0,
    });

    expect(breakdown.couponId).toBe(3);
    expect(breakdown.couponDiscountMinor).toBe(0);
  });
});

// ─── Unit 2: authoritative server pricing, coupon reuse, loyalty, snapshot ──

describe('Unit 2 - SalesService authoritative calculation and snapshot persistence', () => {
  const repo = new SalesRepository();

  beforeEach(async () => {
    await testPool.query('DELETE FROM sale_calculations');
    await testPool.query('DELETE FROM coupon_usage');
    await testPool.query('DELETE FROM sale_payments');
    await testPool.query('DELETE FROM sale_items');
    await testPool.query('DELETE FROM sales');
    await testPool.query('DELETE FROM loyalty_transactions');
    await testPool.query('DELETE FROM bundle_items');
    await testPool.query('DELETE FROM product_bundles');
    await testPool.query('DELETE FROM coupons');
    await testPool.query('DELETE FROM customers');
    await testPool.query('DELETE FROM products');
    await testPool.query('DELETE FROM users');
    await testPool.query('DELETE FROM settings');

    await testPool.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [1, 'Admin', 'admin@moon.com', 'hash', 'Admin']
    );
    await testPool.query(
      'INSERT INTO products (id, name, sku, price, cost_price, stock) VALUES ($1, $2, $3, $4, $5, $6)',
      [1, 'Silk Dress', 'SKU-001', 500, 250, 10]
    );
    await testPool.query(
      'INSERT INTO products (id, name, sku, price, cost_price, stock) VALUES ($1, $2, $3, $4, $5, $6)',
      [2, 'Cotton Shirt', 'SKU-002', 200, 100, 5]
    );
  });

  it('happy path: a fixed manual discount from the server catalog price persists an authoritative snapshot', async () => {
    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 2 }],
        discount: 100,
        discount_type: 'fixed',
        payment_method: 'Cash',
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(900); // (500*2) - 100

    const snapshot = await repo.getSaleCalculationBySaleId(sale.id, testPool);
    expect(snapshot).toMatchObject({
      contractVersion: 'v1',
      subtotal: 1000,
      manualDiscount: 100,
      amountDue: 900,
      earnedPoints: 0,
    });
  });

  it('happy path: a percentage manual discount is capped and rounded from server catalog prices', async () => {
    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 1 }],
        discount: 15,
        discount_type: 'percentage',
        payment_method: 'Cash',
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(425); // 500 - 15% = 425
  });

  it('security: a tampered client unit_price never changes the persisted subtotal or item price for a non-bundle line', async () => {
    const sale = await salesService.executeSale(
      { items: [{ product_id: 1, quantity: 1, unit_price: 1 }], payment_method: 'Cash' } as any,
      1
    );

    expect(Number(sale.total)).toBe(500); // catalog price, not the tampered 1

    const items = await testPool.query('SELECT unit_price FROM sale_items WHERE sale_id = $1', [
      sale.id,
    ]);
    expect(Number(items.rows[0].unit_price)).toBe(500);
  });

  it('error path: a missing product produces a deterministic validation failure and persists nothing', async () => {
    await expect(
      salesService.executeSale(
        { items: [{ product_id: 999, quantity: 1 }], payment_method: 'Cash' } as any,
        1
      )
    ).rejects.toThrow(/Product not found/);

    const sales = await testPool.query('SELECT * FROM sales');
    expect(sales.rows).toHaveLength(0);
  });

  it('error path: an invalid coupon code is rejected deterministically -- never silently omitted from the total', async () => {
    await expect(
      salesService.executeSale(
        {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: 'Cash',
          coupon_code: 'DOES-NOT-EXIST',
        } as any,
        1
      )
    ).rejects.toThrow(/Coupon not found or inactive/);

    const sales = await testPool.query('SELECT * FROM sales');
    expect(sales.rows).toHaveLength(0);
  });

  it('applies the canonical coupon rules (scope/limits) inside the sale transaction rather than a weaker parallel lookup', async () => {
    await testPool.query(
      `INSERT INTO coupons (code, type, value, scope, status) VALUES ($1, $2, $3, $4, $5)`,
      ['SAVE10', 'percentage', 10, 'all', 'active']
    );

    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 1 }],
        payment_method: 'Cash',
        coupon_code: 'save10',
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(450); // 500 - 10%

    const usage = await testPool.query('SELECT * FROM coupon_usage WHERE sale_id = $1', [sale.id]);
    expect(usage.rows).toHaveLength(1);
    expect(Number(usage.rows[0].discount_applied)).toBe(50);
  });

  it('error path: redeeming loyalty points without selecting a customer is rejected deterministically', async () => {
    await testPool.query(
      "INSERT INTO settings (key, value) VALUES ('loyalty_enabled', 'true'), ('loyalty_points_per_egp', '2'), ('loyalty_egp_per_point', '0.1')"
    );

    await expect(
      salesService.executeSale(
        {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: 'Cash',
          points_redeemed: 100,
        } as any,
        1
      )
    ).rejects.toThrow(/customer must be selected/i);
  });

  it('error path: redeeming loyalty points while the program is disabled is rejected deterministically', async () => {
    await testPool.query(
      'INSERT INTO customers (id, name, phone, loyalty_points) VALUES ($1, $2, $3, $4)',
      [1, 'Mona', '0100000000', 500]
    );

    await expect(
      salesService.executeSale(
        {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: 'Cash',
          customer_id: 1,
          points_redeemed: 100,
        } as any,
        1
      )
    ).rejects.toThrow(/loyalty program is disabled/i);
  });

  it('error path: redeeming more points than the customer holds is rejected deterministically', async () => {
    await testPool.query(
      "INSERT INTO settings (key, value) VALUES ('loyalty_enabled', 'true'), ('loyalty_points_per_egp', '2'), ('loyalty_egp_per_point', '0.1')"
    );
    await testPool.query(
      'INSERT INTO customers (id, name, phone, loyalty_points) VALUES ($1, $2, $3, $4)',
      [1, 'Mona', '0100000000', 10]
    );

    await expect(
      salesService.executeSale(
        {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: 'Cash',
          customer_id: 1,
          points_redeemed: 100,
        } as any,
        1
      )
    ).rejects.toThrow(/Insufficient loyalty points/);
  });

  it('loyalty parity: redemption and earning use the canonical settings and direct units', async () => {
    await testPool.query(
      "INSERT INTO settings (key, value) VALUES ('loyalty_enabled', 'true'), ('loyalty_points_per_egp', '2'), ('loyalty_egp_per_point', '0.1')"
    );
    await testPool.query(
      'INSERT INTO customers (id, name, phone, loyalty_points) VALUES ($1, $2, $3, $4)',
      [1, 'Mona', '0100000000', 200]
    );

    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 2 }], // 1000 EGP subtotal
        payment_method: 'Cash',
        customer_id: 1,
        points_redeemed: 200,
      } as any,
      1
    );

    // 200 points * 0.10 EGP/point = 20 EGP discount -> 980 due.
    expect(Number(sale.total)).toBe(980);

    const customer = await testPool.query(
      'SELECT loyalty_points FROM customers WHERE id = $1',
      [1]
    );
    // 200 - 200 redeemed + floor(980 * 2) = 1960 earned.
    expect(Number(customer.rows[0].loyalty_points)).toBe(1960);

    const snapshot = await repo.getSaleCalculationBySaleId(sale.id, testPool);
    expect(snapshot).toMatchObject({
      pointsRedeemed: 200,
      pointsDiscount: 20,
      earnedPoints: 1960,
    });
  });

  it('tax modes: the same discounted inputs under inclusive and exclusive tax return the contract-defined amount due', async () => {
    await testPool.query(
      "INSERT INTO settings (key, value) VALUES ('tax_enabled', 'true'), ('tax_rate', '14'), ('tax_mode', 'exclusive')"
    );
    const exclusiveSale = await salesService.executeSale(
      { items: [{ product_id: 1, quantity: 2 }], payment_method: 'Cash' } as any,
      1
    );
    expect(Number(exclusiveSale.total)).toBe(1140); // 1000 + 14%

    await testPool.query("UPDATE settings SET value = 'inclusive' WHERE key = 'tax_mode'");
    const inclusiveSale = await salesService.executeSale(
      { items: [{ product_id: 1, quantity: 2 }], payment_method: 'Cash' } as any,
      1
    );
    expect(Number(inclusiveSale.total)).toBe(1000); // tax already included in the taxable base
  });

  it('integration: a valid bundle checkout persists the server-validated allocated bundle price, not the catalog total', async () => {
    await testPool.query(
      `INSERT INTO product_bundles (id, name, bundle_price, status) VALUES ($1, $2, $3, $4)`,
      [1, 'Outfit Bundle', 630, 'active']
    );
    await testPool.query(
      'INSERT INTO bundle_items (bundle_id, product_id, quantity) VALUES ($1, $2, $3), ($1, $4, $5)',
      [1, 1, 1, 2, 1]
    );
    // Catalog total would be 500 + 200 = 700; the bundle sells for 630.

    const sale = await salesService.executeSale(
      {
        items: [
          { product_id: 1, quantity: 1, bundle_id: 1, unit_price: 999 }, // tampered price ignored
          { product_id: 2, quantity: 1, bundle_id: 1 },
        ],
        payment_method: 'Cash',
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(630);

    const items = await testPool.query(
      'SELECT product_id, unit_price, quantity FROM sale_items WHERE sale_id = $1 ORDER BY product_id',
      [sale.id]
    );
    const allocatedTotal = items.rows.reduce(
      (sum: number, row: any) => sum + Number(row.unit_price) * Number(row.quantity),
      0
    );
    expect(allocatedTotal).toBe(630);

    const snapshot = await repo.getSaleCalculationBySaleId(sale.id, testPool);
    expect(snapshot?.subtotal).toBe(630);
  });

  it('error path: a bundle allocation that does not match its definition is rejected', async () => {
    await testPool.query(
      `INSERT INTO product_bundles (id, name, bundle_price, status) VALUES ($1, $2, $3, $4)`,
      [1, 'Outfit Bundle', 630, 'active']
    );
    await testPool.query(
      'INSERT INTO bundle_items (bundle_id, product_id, quantity) VALUES ($1, $2, $3), ($1, $4, $5)',
      [1, 1, 1, 2, 1]
    );

    await expect(
      salesService.executeSale(
        {
          items: [{ product_id: 1, quantity: 1, bundle_id: 1 }], // missing product 2
          payment_method: 'Cash',
        } as any,
        1
      )
    ).rejects.toThrow(/Bundle allocation does not match its definition/);
  });

  it('historical read: the persisted snapshot is stable after settings change, unlike a value recomputed from current settings', async () => {
    await testPool.query(
      "INSERT INTO settings (key, value) VALUES ('tax_enabled', 'true'), ('tax_rate', '14'), ('tax_mode', 'exclusive')"
    );

    const sale = await salesService.executeSale(
      { items: [{ product_id: 1, quantity: 2 }], payment_method: 'Cash' } as any,
      1
    );
    expect(Number(sale.total)).toBe(1140);

    // Settings change after the sale.
    await testPool.query("UPDATE settings SET value = '20' WHERE key = 'tax_rate'");

    const reread = await repo.findById(sale.id, testPool);
    expect(reread?.calculation).toMatchObject({
      taxRatePercent: 14,
      taxAmount: 140,
      amountDue: 1140,
    });

    // A fresh sale under the new setting differs, proving the snapshot -- not
    // a live recomputation -- is what the historical read returned above.
    const newSale = await salesService.executeSale(
      { items: [{ product_id: 1, quantity: 2 }], payment_method: 'Cash' } as any,
      1
    );
    expect(Number(newSale.total)).toBe(1200); // 1000 + 20%
  });

  it('rounding: EGP <-> minor-unit boundary conversion round-trips exactly', () => {
    expect(toMinorUnits(19.99)).toBe(1999);
    expect(fromMinorUnits(1999)).toBe(19.99);
    expect(toMinorUnits(0)).toBe(0);
  });
});

// ─── Unit 4: split-payment integrity, confirmed response, register threading ─

describe('Unit 4 - Schema Validation: payment entry boundaries', () => {
  it('accepts a zero-amount entry (zero-due sale policy)', () => {
    expect(paymentEntrySchema.safeParse({ method: 'Cash', amount: 0 }).success).toBe(true);
    expect(paymentEntrySchema.safeParse({ method: 'Cash', amount: -0 }).success).toBe(true);
  });

  it('rejects a negative amount', () => {
    expect(paymentEntrySchema.safeParse({ method: 'Cash', amount: -1 }).success).toBe(false);
  });

  it('rejects a non-finite amount', () => {
    expect(paymentEntrySchema.safeParse({ method: 'Cash', amount: Infinity }).success).toBe(false);
    expect(paymentEntrySchema.safeParse({ method: 'Cash', amount: NaN }).success).toBe(false);
  });

  it('rejects more than two decimal places', () => {
    expect(paymentEntrySchema.safeParse({ method: 'Cash', amount: 33.333 }).success).toBe(false);
    expect(paymentEntrySchema.safeParse({ method: 'Cash', amount: 33.33 }).success).toBe(true);
  });

  it('rejects an unsupported payment method', () => {
    expect(paymentEntrySchema.safeParse({ method: 'Bitcoin', amount: 10 }).success).toBe(false);
  });

  it('rejects a huge amount beyond the sanity ceiling', () => {
    expect(
      paymentEntrySchema.safeParse({ method: 'Cash', amount: MAX_PAYMENT_AMOUNT_MAJOR + 1 }).success
    ).toBe(false);
  });

  it('rejects an empty payments array as ambiguous', () => {
    const result = saleSchema.safeParse({
      items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
      payments: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more payment entries than the documented cap', () => {
    const result = saleSchema.safeParse({
      items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
      payments: Array.from({ length: 11 }, () => ({ method: 'Cash', amount: 1 })),
    });
    expect(result.success).toBe(false);
  });

  it('allows duplicate payment methods at the schema boundary (documented policy: duplicates allowed)', () => {
    const result = saleSchema.safeParse({
      items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
      payments: [
        { method: 'Cash', amount: 50 },
        { method: 'Cash', amount: 50 },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('Unit 4 - SalesService split-payment integrity and confirmed response', () => {
  const repo = new SalesRepository();

  beforeEach(async () => {
    await testPool.query('DELETE FROM register_movements');
    await testPool.query('DELETE FROM register_sessions');
    await testPool.query('DELETE FROM sale_payments');
    await testPool.query('DELETE FROM sale_calculations');
    await testPool.query('DELETE FROM coupon_usage');
    await testPool.query('DELETE FROM sale_items');
    await testPool.query('DELETE FROM sales');
    await testPool.query('DELETE FROM products');
    await testPool.query('DELETE FROM users');
    await testPool.query('DELETE FROM settings');

    await testPool.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [1, 'Admin', 'admin@moon.com', 'hash', 'Admin']
    );
    await testPool.query(
      'INSERT INTO products (id, name, sku, price, cost_price, stock) VALUES ($1, $2, $3, $4, $5, $6)',
      [1, 'Silk Dress', 'SKU-001', 100, 50, 10]
    );
  });

  it('the compatibility gate defaults to strict (enabled) in this branch/PR (see types.ts for the rollback flip)', () => {
    expect(STRICT_SPLIT_PAYMENT_VALIDATION).toBe(true);
  });

  it('happy path: Cash/Card entries summing exactly to the server amount persist unchanged and are returned verbatim', async () => {
    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 1 }], // 100 EGP
        payment_method: 'Card',
        payments: [
          { method: 'Cash', amount: 40 },
          { method: 'Card', amount: 60 },
        ],
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(100);
    expect(sale.payments).toEqual([
      { method: 'Cash', amount: 40 },
      { method: 'Card', amount: 60 },
    ]);
    expect(sale.calculation).toMatchObject({ amountDue: 100 });
    expect(sale.items).toEqual([
      expect.objectContaining({ product_id: 1, quantity: 1, unit_price: 100 }),
    ]);

    const persisted = await repo.findPaymentsBySaleId(sale.id, testPool);
    expect(persisted.map((p: any) => ({ method: p.method, amount: Number(p.amount) }))).toEqual([
      { method: 'Cash', amount: 40 },
      { method: 'Card', amount: 60 },
    ]);
  });

  it('edge case: three-way split with fractional cents (33.33 + 33.33 + 33.34) balances to exactly 100.00', async () => {
    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 1 }], // 100 EGP
        payment_method: 'Cash',
        payments: [
          { method: 'Cash', amount: 33.33 },
          { method: 'Card', amount: 33.33 },
          { method: 'Other', amount: 33.34 },
        ],
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(100);
  });

  it('edge case: a classic 0.1 + 0.2 float trap balances exactly at the minor-unit boundary', async () => {
    await testPool.query('UPDATE products SET price = 0.30 WHERE id = 1');

    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 1 }], // 0.30 EGP
        payment_method: 'Cash',
        payments: [
          { method: 'Cash', amount: 0.1 },
          { method: 'Card', amount: 0.2 },
        ],
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(0.3);
  });

  it('edge case: a negative-zero entry amount is treated as zero, not rejected', async () => {
    // Fully discount the sale to zero-due, then confirm a -0 Cash entry balances it.
    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 1 }],
        discount: 100,
        discount_type: 'fixed',
        payment_method: 'Cash',
        payments: [{ method: 'Cash', amount: -0 }],
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(0);
  });

  it('zero-due policy: a fully-comped sale with omitted payments continues the non-split compatibility path', async () => {
    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 1 }],
        discount: 100,
        discount_type: 'fixed',
        payment_method: 'Cash',
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(0);
    expect(sale.payments).toEqual([]);
  });

  it('error path: an empty payments array is rejected at the service boundary even when the request bypasses Zod', async () => {
    await expect(
      salesService.executeSale(
        {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: 'Cash',
          payments: [],
        } as any,
        1
      )
    ).rejects.toMatchObject({ code: SPLIT_PAYMENT_MISMATCH_CODE });
  });

  it('error path: a negative payment amount is rejected at the service boundary even when the request bypasses Zod', async () => {
    await expect(
      salesService.executeSale(
        {
          items: [{ product_id: 1, quantity: 1 }],
          payment_method: 'Cash',
          payments: [{ method: 'Cash', amount: -50 }],
        } as any,
        1
      )
    ).rejects.toBeInstanceOf(SalesValidationError);
  });

  it('error path: underpayment is rejected with the stable SPLIT_PAYMENT_MISMATCH code and persists nothing', async () => {
    await expect(
      salesService.executeSale(
        {
          items: [{ product_id: 1, quantity: 1 }], // 100 EGP due
          payment_method: 'Cash',
          payments: [{ method: 'Cash', amount: 90 }],
        } as any,
        1
      )
    ).rejects.toMatchObject({ code: SPLIT_PAYMENT_MISMATCH_CODE });

    expect((await testPool.query('SELECT * FROM sales')).rows).toHaveLength(0);
    expect((await testPool.query('SELECT * FROM sale_items')).rows).toHaveLength(0);
    expect((await testPool.query('SELECT * FROM sale_payments')).rows).toHaveLength(0);
  });

  it('error path: overpayment (a tampered/stale client split) is rejected and persists nothing, including no register movement', async () => {
    const session = await testPool.query(
      'INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES ($1, $2, $2) RETURNING *',
      [1, 0]
    );

    await expect(
      salesService.executeSale(
        {
          items: [{ product_id: 1, quantity: 1 }], // 100 EGP due
          payment_method: 'Cash',
          payments: [{ method: 'Cash', amount: 150 }],
        } as any,
        1
      )
    ).rejects.toMatchObject({ code: SPLIT_PAYMENT_MISMATCH_CODE });

    expect((await testPool.query('SELECT * FROM sales')).rows).toHaveLength(0);
    expect((await testPool.query('SELECT * FROM register_movements')).rows).toHaveLength(0);
    const reread = await testPool.query(
      'SELECT expected_cash FROM register_sessions WHERE id = $1',
      [session.rows[0].id]
    );
    expect(Number(reread.rows[0].expected_cash)).toBe(0);
  });

  it('duplicate-method policy: two Cash entries that sum correctly are allowed and both count toward the register movement', async () => {
    await testPool.query(
      'INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES ($1, $2, $2)',
      [1, 0]
    );

    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 1 }], // 100 EGP due
        payment_method: 'Cash',
        payments: [
          { method: 'Cash', amount: 60 },
          { method: 'Cash', amount: 40 },
        ],
      } as any,
      1
    );

    expect(Number(sale.total)).toBe(100);

    const movements = await testPool.query('SELECT * FROM register_movements WHERE sale_id = $1', [
      sale.id,
    ]);
    expect(movements.rows).toHaveLength(1);
    expect(Number(movements.rows[0].amount)).toBe(100); // sum of both Cash entries

    const session = await testPool.query('SELECT expected_cash FROM register_sessions');
    expect(Number(session.rows[0].expected_cash)).toBe(100);
  });

  it('integration: the confirmed cash-register movement equals only the confirmed Cash component of a mixed split, not the whole total', async () => {
    await testPool.query(
      'INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES ($1, $2, $2)',
      [1, 0]
    );

    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 1 }], // 100 EGP due
        payment_method: 'Card',
        payments: [
          { method: 'Cash', amount: 25 },
          { method: 'Card', amount: 75 },
        ],
      } as any,
      1
    );

    const movements = await testPool.query('SELECT * FROM register_movements WHERE sale_id = $1', [
      sale.id,
    ]);
    expect(movements.rows).toHaveLength(1);
    expect(Number(movements.rows[0].amount)).toBe(25);
  });

  it('compatibility: a non-split Cash sale (no payments array) still records the whole amount as the register movement, unchanged', async () => {
    await testPool.query(
      'INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES ($1, $2, $2)',
      [1, 0]
    );

    const sale = await salesService.executeSale(
      { items: [{ product_id: 1, quantity: 1 }], payment_method: 'Cash' } as any,
      1
    );

    const movements = await testPool.query('SELECT * FROM register_movements WHERE sale_id = $1', [
      sale.id,
    ]);
    expect(movements.rows).toHaveLength(1);
    expect(Number(movements.rows[0].amount)).toBe(100);
  });

  it('compatibility: a non-split Card sale records no register movement, unchanged', async () => {
    await testPool.query(
      'INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES ($1, $2, $2)',
      [1, 0]
    );

    const sale = await salesService.executeSale(
      { items: [{ product_id: 1, quantity: 1 }], payment_method: 'Card' } as any,
      1
    );

    const movements = await testPool.query('SELECT * FROM register_movements WHERE sale_id = $1', [
      sale.id,
    ]);
    expect(movements.rows).toHaveLength(0);
  });

  it('when no open register session exists, a Cash sale still succeeds (register tracking is best-effort, not a checkout precondition)', async () => {
    const sale = await salesService.executeSale(
      { items: [{ product_id: 1, quantity: 1 }], payment_method: 'Cash' } as any,
      1
    );
    expect(Number(sale.total)).toBe(100);
  });

  it('integration: the confirmed response calculation/items/payments exactly equal the persisted rows', async () => {
    const sale = await salesService.executeSale(
      {
        items: [{ product_id: 1, quantity: 2 }], // 200 EGP
        discount: 20,
        discount_type: 'fixed',
        payment_method: 'Card',
        payments: [
          { method: 'Cash', amount: 80 },
          { method: 'Card', amount: 100 },
        ],
      } as any,
      1
    );

    const snapshot = await repo.getSaleCalculationBySaleId(sale.id, testPool);
    expect(sale.calculation).toEqual(snapshot);

    const persistedItems = await testPool.query(
      'SELECT product_id, variant_id, quantity, unit_price, cost_price, memo FROM sale_items WHERE sale_id = $1',
      [sale.id]
    );
    expect(sale.items).toEqual(
      persistedItems.rows.map((r: any) => ({
        product_id: r.product_id,
        variant_id: r.variant_id,
        quantity: r.quantity,
        unit_price: Number(r.unit_price),
        cost_price: Number(r.cost_price),
        memo: r.memo,
      }))
    );

    const persistedPayments = await repo.findPaymentsBySaleId(sale.id, testPool);
    expect(sale.payments).toEqual(
      persistedPayments.map((p: any) => ({ method: p.method, amount: Number(p.amount) }))
    );
  });
});

describe('Unit 4 - Controller: stable validation error mapping', () => {
  it('maps a SalesValidationError to a 400 VALIDATION_ERROR with the stable SPLIT_PAYMENT_MISMATCH detail code', async () => {
    vi.spyOn(salesService, 'executeSale').mockRejectedValueOnce(
      new SalesValidationError(
        'Split payment total does not equal the amount due',
        SPLIT_PAYMENT_MISMATCH_CODE
      )
    );
    const next = vi.fn();

    await new SalesController().createSale(
      {
        body: {
          items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
          payment_method: 'Cash',
          payments: [{ method: 'Cash', amount: 50 }],
        },
        user: { id: 1, name: 'Cashier' },
      } as unknown as Request,
      { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: [
          expect.objectContaining({ field: 'payments', code: SPLIT_PAYMENT_MISMATCH_CODE }),
        ],
      })
    );
  });
});

describe('Unit 4 - OpenAPI documentation: additive confirmed response is scoped to sale endpoints', () => {
  const salesPost = (openApiSpec.paths as any)['/api/v1/sales'].post;
  const saleGet = (openApiSpec.paths as any)['/api/v1/sales/{id}'].get;

  it('documents the SPLIT_PAYMENT_MISMATCH stable error code on sale creation', () => {
    expect(salesPost.description).toContain('SPLIT_PAYMENT_MISMATCH');
    expect(JSON.stringify(salesPost.responses['400'])).toContain('SPLIT_PAYMENT_MISMATCH');
  });

  it('documents the additive calculation/items/payments fields on the confirmed create response', () => {
    const dataSchema =
      salesPost.responses['200'].content['application/json'].schema.properties.data;
    expect(dataSchema.properties.calculation.$ref).toBe(
      '#/components/schemas/SaleCalculationSnapshot'
    );
    expect(dataSchema.properties.payments).toBeDefined();
    expect(dataSchema.properties.items).toBeDefined();
  });

  it('documents the immutable calculation snapshot on the sale detail response', () => {
    const dataSchema = saleGet.responses['200'].content['application/json'].schema.properties.data;
    expect(dataSchema.properties.calculation.$ref).toBe(
      '#/components/schemas/SaleCalculationSnapshot'
    );
  });

  it('defines the SaleCalculationSnapshot schema referenced by both endpoints', () => {
    expect((openApiSpec.components.schemas as any).SaleCalculationSnapshot).toBeDefined();
  });
});
