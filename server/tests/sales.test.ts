import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newDb } from 'pg-mem';
import { Pool as PgPool } from 'pg';
import path from 'path';
import { saleSchema } from '../validators/saleSchema';
import { setPool, closePool } from '../src/database/pool';
import { runMigrationsUp } from '../src/database/migrate';
import {
  calculateSaleTotals,
  executeSaleTransaction,
  executeRefundTransaction,
} from '../services/saleService';

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

    const prod = await testPool.query<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [1]);
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

    const prod = await testPool.query<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [1]);
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

    const prod = await testPool.query<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [1]);
    expect(prod.rows[0].stock).toBe(9); // 8 + 1 restocked
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
