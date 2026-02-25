import db from '../db';
import { productSchema } from '../validators/productSchema';
import { notifyLowStock } from './notifications';

// --- Types ---

export interface CreateProductInput {
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  cost_price: number;
  stock: number;
  category?: string | null;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
}

export type UpdateProductInput = CreateProductInput;

export interface BulkUpdateUpdates {
  category_id?: number;
  distributor_id?: number | null;
  price_percent?: number;
  status?: 'active' | 'inactive' | 'discontinued';
}

export interface AdjustStockInput {
  delta: number;
  reason: string;
}

export interface AdjustStockResult {
  previous_qty: number;
  new_qty: number;
  delta: number;
}

export interface VariantInput {
  sku: string;
  barcode?: string | null;
  price?: number | null;
  cost_price: number;
  stock: number;
  attributes: Record<string, string>;
}

export interface ImportResult {
  imported: number;
  errors: Array<{ row: number; error: string }>;
}

export interface BatchBarcodeResult {
  product_id: number;
  barcode: string;
}

// --- Helpers ---

function resolveCategoryText(categoryId: number): string | null {
  const rawDb = db.db;
  const cat = rawDb.prepare('SELECT name FROM categories WHERE id = ?').get(categoryId) as
    | { name: string }
    | undefined;
  return cat?.name || null;
}

function calculateEan13CheckDigit(partial12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(partial12[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

// --- Public API ---

/**
 * Generate the next SKU for a given category.
 * Format: MN-{CATEGORY_CODE}-{NNN}
 */
export async function generateSku(categoryId: number): Promise<{ sku: string } | null> {
  const catResult = await db.query<{ code: string }>('SELECT code FROM categories WHERE id = ?', [
    categoryId,
  ]);
  if (catResult.rows.length === 0) {
    return null;
  }

  const code = catResult.rows[0].code;
  const prefix = `MN-${code}-`;

  // Find the max SKU number for this prefix
  const maxResult = await db.query<{ max_num: number | null }>(
    `SELECT MAX(CAST(SUBSTR(sku, ?) AS INTEGER)) as max_num
     FROM products WHERE sku LIKE ?`,
    [prefix.length + 1, `${prefix}%`]
  );

  const nextNum = (maxResult.rows[0].max_num || 0) + 1;
  const sku = `${prefix}${String(nextNum).padStart(3, '0')}`;

  return { sku };
}

/**
 * Generate the next EAN-13 barcode.
 * Prefix: 890100, 6-digit sequential, 1 check digit.
 */
export async function generateBarcode(): Promise<{ barcode: string }> {
  const prefix = '890100';

  // Find the max barcode number with this prefix
  const maxResult = await db.query<{ max_bc: string | null }>(
    `SELECT MAX(barcode) as max_bc FROM products WHERE barcode LIKE ? AND LENGTH(barcode) = 13`,
    [`${prefix}%`]
  );

  let nextSeq: number;
  if (maxResult.rows[0].max_bc) {
    // Extract the sequential part (digits after prefix, before check digit)
    const existing = maxResult.rows[0].max_bc;
    const seqPart = existing.substring(prefix.length, 12); // 6 digits
    nextSeq = parseInt(seqPart, 10) + 1;
  } else {
    nextSeq = 1;
  }

  const seqStr = String(nextSeq).padStart(6, '0');
  const partial = prefix + seqStr; // 12 digits

  const checkDigit = calculateEan13CheckDigit(partial);
  const barcode = partial + checkDigit;

  return { barcode };
}

/**
 * Create a new product. Resolves category text from category_id if not provided.
 * Returns the created product row.
 * Throws on UNIQUE constraint violations.
 */
export async function createProduct(data: CreateProductInput): Promise<Record<string, any>> {
  const {
    name,
    sku,
    barcode,
    price,
    cost_price,
    stock,
    category,
    category_id,
    distributor_id,
    min_stock,
  } = data;

  // Resolve category text from category_id if not provided
  let categoryText = category || null;
  if (category_id && !categoryText) {
    categoryText = resolveCategoryText(category_id);
  }

  const result = await db.query(
    `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, distributor_id, min_stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      name,
      sku,
      barcode || null,
      price,
      cost_price,
      stock,
      categoryText,
      category_id || null,
      distributor_id || null,
      min_stock,
    ]
  );

  return result.rows[0];
}

/**
 * Update an existing product. Tracks price history changes.
 * Returns the updated product row, or null if not found.
 * Throws { type: 'discontinued' } if product is discontinued.
 * Throws on UNIQUE constraint violations.
 */
export async function updateProduct(
  id: string | number,
  data: UpdateProductInput,
  userId: number
): Promise<Record<string, any> | null> {
  // Block edits on discontinued products
  const existing = await db.query<{ status: string }>('SELECT status FROM products WHERE id = ?', [
    id,
  ]);
  if (existing.rows.length > 0 && existing.rows[0].status === 'discontinued') {
    const err = new Error('Cannot edit a discontinued product. Reactivate it first.');
    (err as any).type = 'discontinued';
    throw err;
  }

  const {
    name,
    sku,
    barcode,
    price,
    cost_price,
    stock,
    category,
    category_id,
    distributor_id,
    min_stock,
  } = data;

  // Resolve category text from category_id if not provided
  let categoryText = category || null;
  if (category_id && !categoryText) {
    categoryText = resolveCategoryText(category_id);
  }

  // Get old prices for price history tracking
  const oldProduct = await db.query<{ price: number; cost_price: number }>(
    'SELECT price, cost_price FROM products WHERE id = ?',
    [id]
  );

  const result = await db.query(
    `UPDATE products SET name=?, sku=?, barcode=?, price=?, cost_price=?, stock=?, category=?, category_id=?, distributor_id=?, min_stock=?, updated_at=datetime('now')
     WHERE id=? RETURNING *`,
    [
      name,
      sku,
      barcode || null,
      price,
      cost_price,
      stock,
      categoryText,
      category_id || null,
      distributor_id || null,
      min_stock,
      id,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Log price history if price or cost changed
  if (oldProduct.rows.length > 0) {
    const old = oldProduct.rows[0];
    if (old.price !== price) {
      db.db
        .prepare(
          'INSERT INTO price_history (product_id, field, old_value, new_value, user_id) VALUES (?, ?, ?, ?, ?)'
        )
        .run(id, 'price', old.price, price, userId);
    }
    if (old.cost_price !== cost_price) {
      db.db
        .prepare(
          'INSERT INTO price_history (product_id, field, old_value, new_value, user_id) VALUES (?, ?, ?, ?, ?)'
        )
        .run(id, 'cost_price', old.cost_price, cost_price, userId);
    }
  }

  // Check low stock
  const updated = result.rows[0] as Record<string, any>;
  if (updated.stock <= updated.min_stock) {
    notifyLowStock(updated.name, updated.stock, updated.id);
  }

  return result.rows[0];
}

/**
 * Soft-delete (discontinue) multiple products by ID.
 * Returns the count of discontinued products.
 */
export async function bulkDeleteProducts(ids: number[]): Promise<number> {
  const placeholders = ids.map(() => '?').join(',');
  const result = await db.query(
    `UPDATE products SET status = 'discontinued', updated_at = datetime('now') WHERE id IN (${placeholders}) RETURNING id`,
    ids
  );

  return result.rows.length;
}

/**
 * Bulk update products in a transaction.
 * Supports: category_id, distributor_id, price_percent, status.
 * Throws Error('Category not found') if category_id is invalid.
 */
export function bulkUpdateProducts(ids: number[], updates: BulkUpdateUpdates): number {
  const rawDb = db.db;

  const txn = rawDb.transaction(() => {
    let updated = 0;

    if (updates.category_id !== undefined) {
      // Resolve category name
      const cat = rawDb
        .prepare('SELECT name FROM categories WHERE id = ?')
        .get(updates.category_id) as { name: string } | undefined;
      if (!cat) throw new Error('Category not found');

      const placeholders = ids.map(() => '?').join(',');
      const stmt = rawDb.prepare(
        `UPDATE products SET category_id = ?, category = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
      );
      const result = stmt.run(updates.category_id, cat.name, ...ids);
      updated = result.changes;
    }

    if (updates.distributor_id !== undefined) {
      const placeholders = ids.map(() => '?').join(',');
      const stmt = rawDb.prepare(
        `UPDATE products SET distributor_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
      );
      const result = stmt.run(updates.distributor_id, ...ids);
      updated = result.changes;
    }

    if (updates.price_percent !== undefined) {
      const factor = 1 + updates.price_percent / 100;
      const placeholders = ids.map(() => '?').join(',');
      const stmt = rawDb.prepare(
        `UPDATE products SET price = ROUND(price * ?, 2), updated_at = datetime('now') WHERE id IN (${placeholders})`
      );
      const result = stmt.run(factor, ...ids);
      updated = result.changes;
    }

    if (updates.status !== undefined) {
      const placeholders = ids.map(() => '?').join(',');
      const stmt = rawDb.prepare(
        `UPDATE products SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
      );
      const result = stmt.run(updates.status, ...ids);
      updated = result.changes;
    }

    return updated;
  });

  return txn();
}

/**
 * Import products via CSV upsert (insert or update on SKU conflict).
 * Returns count of imported products and per-row errors.
 */
export async function importProducts(products: unknown[]): Promise<ImportResult> {
  let imported = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < products.length; i++) {
    const parsed = productSchema.safeParse(products[i]);
    if (!parsed.success) {
      errors.push({ row: i + 1, error: parsed.error.errors[0].message });
      continue;
    }
    try {
      const {
        name,
        sku,
        barcode,
        price,
        cost_price,
        stock,
        category,
        category_id,
        distributor_id,
        min_stock,
      } = parsed.data;
      await db.query(
        `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, distributor_id, min_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(sku) DO UPDATE SET name=?, price=?, cost_price=?, stock=?, category=?, category_id=?, distributor_id=?, min_stock=?, updated_at=datetime('now')`,
        [
          name,
          sku,
          barcode || null,
          price,
          cost_price,
          stock,
          category || null,
          category_id || null,
          distributor_id || null,
          min_stock,
          name,
          price,
          cost_price,
          stock,
          category || null,
          category_id || null,
          distributor_id || null,
          min_stock,
        ]
      );
      imported++;
    } catch (err: any) {
      errors.push({ row: i + 1, error: err.message });
    }
  }

  return { imported, errors };
}

/**
 * Adjust stock for a product. Runs in a transaction with audit trail.
 * Checks for discontinued products, prevents negative stock.
 * Notifies on low stock after adjustment.
 */
export function adjustStock(
  productId: number,
  input: AdjustStockInput,
  userId: number
): AdjustStockResult {
  const { delta, reason } = input;
  const rawDb = db.db;

  const txn = rawDb.transaction(() => {
    const product = rawDb
      .prepare('SELECT id, stock, status FROM products WHERE id = ?')
      .get(productId) as { id: number; stock: number; status: string } | undefined;

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.status === 'discontinued') {
      throw new Error('Cannot adjust stock on a discontinued product');
    }

    const previousQty = product.stock;
    const newQty = previousQty + delta;

    if (newQty < 0) {
      throw new Error('Stock cannot go below zero');
    }

    rawDb
      .prepare("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newQty, productId);

    rawDb
      .prepare(
        'INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(productId, previousQty, newQty, delta, reason, userId);

    return { previous_qty: previousQty, new_qty: newQty, delta };
  });

  const result = txn();

  // Check low stock after adjustment
  const prod = rawDb
    .prepare('SELECT name, stock, min_stock FROM products WHERE id = ?')
    .get(productId) as { name: string; stock: number; min_stock: number } | undefined;
  if (prod && prod.stock <= prod.min_stock) {
    notifyLowStock(prod.name, prod.stock, productId);
  }

  return result;
}

/**
 * Create a variant for a product in a transaction.
 * Sets has_variants=1 on the parent product.
 * Returns the variant row with parsed attributes.
 * Throws Error('Product not found') or Error('Cannot add variants to a discontinued product').
 */
export function createVariant(productId: number, data: VariantInput): Record<string, any> {
  const { sku, barcode, price, cost_price, stock, attributes } = data;
  const rawDb = db.db;

  const txn = rawDb.transaction(() => {
    // Verify product exists
    const product = rawDb.prepare('SELECT id, status FROM products WHERE id = ?').get(productId) as
      | Record<string, any>
      | undefined;
    if (!product) throw new Error('Product not found');
    if (product.status === 'discontinued')
      throw new Error('Cannot add variants to a discontinued product');

    // Mark product as has_variants
    rawDb.prepare('UPDATE products SET has_variants = 1 WHERE id = ?').run(productId);

    const variant = rawDb
      .prepare(
        `INSERT INTO product_variants (product_id, sku, barcode, price, cost_price, stock, attributes)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(
        productId,
        sku,
        barcode || null,
        price || null,
        cost_price,
        stock,
        JSON.stringify(attributes)
      ) as Record<string, any>;

    return variant;
  });

  const variant = txn();
  return { ...variant, attributes: JSON.parse(variant.attributes || '{}') };
}

/**
 * Update an existing variant.
 * Returns the updated variant with parsed attributes, or null if not found.
 */
export async function updateVariant(
  productId: string | number,
  variantId: string | number,
  data: VariantInput
): Promise<Record<string, any> | null> {
  const { sku, barcode, price, cost_price, stock, attributes } = data;

  const result = await db.query(
    `UPDATE product_variants SET sku=?, barcode=?, price=?, cost_price=?, stock=?, attributes=?
     WHERE id=? AND product_id=? RETURNING *`,
    [
      sku,
      barcode || null,
      price || null,
      cost_price,
      stock,
      JSON.stringify(attributes),
      variantId,
      productId,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const variant = result.rows[0] as Record<string, any>;
  return { ...variant, attributes: JSON.parse(variant.attributes || '{}') };
}

/**
 * Delete a variant. Unsets has_variants on the parent product if no variants remain.
 * Returns true if deleted, false if variant not found.
 */
export async function deleteVariant(
  productId: string | number,
  variantId: string | number
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM product_variants WHERE id = ? AND product_id = ? RETURNING id',
    [variantId, productId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  // Check if any variants remain -- if not, unset has_variants
  const remaining = await db.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM product_variants WHERE product_id = ?',
    [productId]
  );
  if (remaining.rows[0].count === 0) {
    await db.query('UPDATE products SET has_variants = 0 WHERE id = ?', [productId]);
  }

  return true;
}

/**
 * Generate barcodes for multiple products that don't already have one.
 * Runs in a transaction. Returns array of { product_id, barcode }.
 */
export function batchGenerateBarcodes(productIds: number[]): BatchBarcodeResult[] {
  const rawDb = db.db;
  const prefix = '890100';

  const txn = rawDb.transaction(() => {
    const results: BatchBarcodeResult[] = [];

    // Get current max barcode
    const maxResult = rawDb
      .prepare(
        `SELECT MAX(barcode) as max_bc FROM products WHERE barcode LIKE ? AND LENGTH(barcode) = 13`
      )
      .get(`${prefix}%`) as { max_bc: string | null };

    let nextSeq = 1;
    if (maxResult.max_bc) {
      const seqPart = maxResult.max_bc.substring(prefix.length, 12);
      nextSeq = parseInt(seqPart, 10) + 1;
    }

    for (const pid of productIds) {
      const product = rawDb.prepare('SELECT id, barcode FROM products WHERE id = ?').get(pid) as
        | { id: number; barcode: string | null }
        | undefined;
      if (!product || product.barcode) continue;

      const seqStr = String(nextSeq).padStart(6, '0');
      const partial = prefix + seqStr;
      const checkDigit = calculateEan13CheckDigit(partial);
      const barcode = partial + checkDigit;

      rawDb
        .prepare("UPDATE products SET barcode = ?, updated_at = datetime('now') WHERE id = ?")
        .run(barcode, pid);
      results.push({ product_id: pid, barcode });
      nextSeq++;
    }

    return results;
  });

  return txn();
}
