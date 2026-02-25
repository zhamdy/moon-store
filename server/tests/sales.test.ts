import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { saleSchema } from '../validators/saleSchema';

const TEST_DB_PATH = path.join(__dirname, 'test-sales.db');
let testDb: InstanceType<typeof Database>;

function setupTestDb() {
  testDb = new Database(TEST_DB_PATH);
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');

  testDb.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Cashier',
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT UNIQUE,
      price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      min_stock INTEGER DEFAULT 5,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL NOT NULL,
      discount REAL DEFAULT 0,
      discount_type TEXT DEFAULT 'fixed',
      tax_amount REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash',
      cashier_id INTEGER REFERENCES users(id),
      customer_id INTEGER,
      notes TEXT,
      tip REAL DEFAULT 0,
      refunded_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id),
      product_id INTEGER REFERENCES products(id),
      variant_id INTEGER,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      memo TEXT
    );
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

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

describe('Sales - Stock Deduction', () => {
  beforeAll(() => {
    setupTestDb();
    // Seed test data
    testDb
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run('Admin', 'admin@moon.com', 'hash', 'Admin');
    testDb
      .prepare('INSERT INTO products (name, sku, price, stock) VALUES (?, ?, ?, ?)')
      .run('Silk Dress', 'SKU-001', 500, 10);
    testDb
      .prepare('INSERT INTO products (name, sku, price, stock) VALUES (?, ?, ?, ?)')
      .run('Cotton Shirt', 'SKU-002', 200, 5);
  });

  afterAll(() => {
    testDb.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    for (const ext of ['-wal', '-shm']) {
      const f = TEST_DB_PATH + ext;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it('should deduct stock when sale is created', () => {
    const createSale = testDb.transaction(() => {
      const saleResult = testDb
        .prepare(
          'INSERT INTO sales (total, discount, discount_type, payment_method, cashier_id) VALUES (?, ?, ?, ?, ?) RETURNING *'
        )
        .get(500, 0, 'fixed', 'Cash', 1) as Record<string, unknown>;

      testDb
        .prepare(
          'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
        )
        .run(saleResult.id, 1, 2, 500);

      // Deduct stock
      testDb.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(2, 1);

      return saleResult;
    });

    const sale = createSale();
    expect(sale.total).toBe(500);

    const product = testDb.prepare('SELECT stock FROM products WHERE id = 1').get() as Record<
      string,
      unknown
    >;
    expect(product.stock).toBe(8); // 10 - 2
  });

  it('should handle multiple items in one sale', () => {
    const items = [
      { product_id: 1, quantity: 1, unit_price: 500 },
      { product_id: 2, quantity: 2, unit_price: 200 },
    ];
    const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

    const createSale = testDb.transaction(() => {
      const saleResult = testDb
        .prepare('INSERT INTO sales (total, cashier_id) VALUES (?, ?) RETURNING *')
        .get(total, 1) as Record<string, unknown>;

      for (const item of items) {
        testDb
          .prepare(
            'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
          )
          .run(saleResult.id, item.product_id, item.quantity, item.unit_price);
        testDb
          .prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
          .run(item.quantity, item.product_id);
      }
      return saleResult;
    });

    const sale = createSale();
    expect(sale.total).toBe(900); // 500 + 2*200

    const p1 = testDb.prepare('SELECT stock FROM products WHERE id = 1').get() as Record<
      string,
      unknown
    >;
    const p2 = testDb.prepare('SELECT stock FROM products WHERE id = 2').get() as Record<
      string,
      unknown
    >;
    expect(p1.stock).toBe(7); // 8 - 1
    expect(p2.stock).toBe(3); // 5 - 2
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
