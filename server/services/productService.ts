import db from '../src/database/pool';
import { PublicError } from '../src/http/errors';
import { withTransaction, Queryable } from '../src/database/transaction';
import { productSchema } from '../validators/productSchema';
import { notifyLowStock } from './notifications';
import { stockAdjustmentsService } from '../src/modules/inventory/stockAdjustments/service';

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

async function resolveCategoryText(
  queryable: Queryable,
  categoryId: number
): Promise<string | null> {
  const result = await queryable.query<{ name: string }>(
    'SELECT name FROM categories WHERE id = $1',
    [categoryId]
  );
  return result.rows[0]?.name || null;
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
  const catResult = await db.query<{ code: string }>('SELECT code FROM categories WHERE id = $1', [
    categoryId,
  ]);
  if (catResult.rows.length === 0) {
    return null;
  }

  const code = catResult.rows[0].code;
  const prefix = `MN-${code}-`;

  // Find the max SKU number for this prefix
  const maxResult = await db.query<{ max_num: number | null }>(
    `SELECT MAX(CAST(SUBSTR(sku, $1) AS INTEGER)) as max_num
     FROM products WHERE sku LIKE $2`,
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

  const maxResult = await db.query<{ max_bc: string | null }>(
    `SELECT MAX(barcode) as max_bc FROM products WHERE barcode LIKE $1 AND LENGTH(barcode) = 13`,
    [`${prefix}%`]
  );

  let nextSeq: number;
  if (maxResult.rows[0].max_bc) {
    const existing = maxResult.rows[0].max_bc;
    const seqPart = existing.substring(prefix.length, 12);
    nextSeq = parseInt(seqPart, 10) + 1;
  } else {
    nextSeq = 1;
  }

  const seqStr = String(nextSeq).padStart(6, '0');
  const partial = prefix + seqStr;

  const checkDigit = calculateEan13CheckDigit(partial);
  const barcode = partial + checkDigit;

  return { barcode };
}

/**
 * Create a new product. Resolves category text from category_id if not provided.
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

  let categoryText = category || null;
  if (category_id && !categoryText) {
    categoryText = await resolveCategoryText(db, category_id);
  }

  const result = await db.query(
    `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, distributor_id, min_stock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
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
 */
export async function updateProduct(
  id: string | number,
  data: UpdateProductInput,
  userId: number
): Promise<Record<string, any> | null> {
  const existing = await db.query<{ status: string }>('SELECT status FROM products WHERE id = $1', [
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

  let categoryText = category || null;
  if (category_id && !categoryText) {
    categoryText = await resolveCategoryText(db, category_id);
  }

  const oldProduct = await db.query<{ price: number; cost_price: number }>(
    'SELECT price, cost_price FROM products WHERE id = $1',
    [id]
  );

  const result = await db.query(
    `UPDATE products SET name=$1, sku=$2, barcode=$3, price=$4, cost_price=$5, stock=$6, category=$7, category_id=$8, distributor_id=$9, min_stock=$10, updated_at=NOW()
     WHERE id=$11 RETURNING *`,
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

  if (oldProduct.rows.length > 0) {
    const old = oldProduct.rows[0];
    if (old.price !== price) {
      await db.query(
        'INSERT INTO price_history (product_id, field, old_value, new_value, user_id) VALUES ($1, $2, $3, $4, $5)',
        [id, 'price', old.price, price, userId]
      );
    }
    if (old.cost_price !== cost_price) {
      await db.query(
        'INSERT INTO price_history (product_id, field, old_value, new_value, user_id) VALUES ($1, $2, $3, $4, $5)',
        [id, 'cost_price', old.cost_price, cost_price, userId]
      );
    }
  }

  const updated = result.rows[0] as Record<string, any>;
  if (updated.stock <= updated.min_stock) {
    notifyLowStock(updated.name, updated.stock, updated.id);
  }

  return result.rows[0];
}

/**
 * Soft-delete (discontinue) multiple products by ID.
 */
export async function bulkDeleteProducts(ids: number[]): Promise<number> {
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const result = await db.query(
    `UPDATE products SET status = 'discontinued', updated_at = NOW() WHERE id IN (${placeholders}) RETURNING id`,
    ids
  );

  return result.rows.length;
}

/**
 * Bulk update products in a transaction.
 */
export async function bulkUpdateProducts(
  ids: number[],
  updates: BulkUpdateUpdates
): Promise<number> {
  return withTransaction(async (client) => {
    let updated = 0;

    if (updates.category_id !== undefined) {
      const cat = await client.query<{ name: string }>(
        'SELECT name FROM categories WHERE id = $1',
        [updates.category_id]
      );
      if (cat.rows.length === 0) throw new PublicError('NOT_FOUND', 'Category not found');

      const placeholders = ids.map((_, i) => `$${i + 3}`).join(',');
      const result = await client.query(
        `UPDATE products SET category_id = $1, category = $2, updated_at = NOW() WHERE id IN (${placeholders})`,
        [updates.category_id, cat.rows[0].name, ...ids]
      );
      updated = result.rowCount || 0;
    }

    if (updates.distributor_id !== undefined) {
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      const result = await client.query(
        `UPDATE products SET distributor_id = $1, updated_at = NOW() WHERE id IN (${placeholders})`,
        [updates.distributor_id, ...ids]
      );
      updated = result.rowCount || 0;
    }

    if (updates.price_percent !== undefined) {
      const factor = 1 + updates.price_percent / 100;
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      const result = await client.query(
        `UPDATE products SET price = ROUND(price * $1, 2), updated_at = NOW() WHERE id IN (${placeholders})`,
        [factor, ...ids]
      );
      updated = result.rowCount || 0;
    }

    if (updates.status !== undefined) {
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
      const result = await client.query(
        `UPDATE products SET status = $1, updated_at = NOW() WHERE id IN (${placeholders})`,
        [updates.status, ...ids]
      );
      updated = result.rowCount || 0;
    }

    return updated;
  });
}

/**
 * Import products via CSV upsert (insert or update on SKU conflict).
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
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT(sku) DO UPDATE SET name=$1, price=$4, cost_price=$5, stock=$6, category=$7, category_id=$8, distributor_id=$9, min_stock=$10, updated_at=NOW()`,
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
 */
export async function adjustStock(
  productId: number,
  input: AdjustStockInput,
  userId: number
): Promise<AdjustStockResult> {
  const { delta, reason } = input;

  return withTransaction(async (client) => {
    const prodRes = await client.query<{
      id: number;
      name: string;
      stock: number;
      min_stock: number;
      status: string;
    }>('SELECT id, name, stock, min_stock, status FROM products WHERE id = $1', [productId]);
    const product = prodRes.rows[0];

    if (!product) {
      throw new PublicError('NOT_FOUND', 'Product not found');
    }

    if (product.status === 'discontinued') {
      throw new Error('Cannot adjust stock on a discontinued product');
    }

    // The read above only decides eligibility (exists, not discontinued). The quantity
    // it saw is deliberately not used to compute the new total: the guarded relative
    // write below is the authority, so two concurrent adjustments cannot lose one
    // another's delta or drive stock negative.
    const applied = await stockAdjustmentsService.applyDelta(
      productId,
      delta,
      reason,
      userId,
      client
    );

    if (applied === null) {
      throw new Error('Stock cannot go below zero');
    }

    if (applied.newQty <= product.min_stock) {
      notifyLowStock(product.name, applied.newQty, productId);
    }

    return { previous_qty: applied.previousQty, new_qty: applied.newQty, delta };
  });
}

/**
 * Create a variant for a product in a transaction.
 */
export async function createVariant(
  productId: number,
  data: VariantInput
): Promise<Record<string, any>> {
  const { sku, barcode, price, cost_price, stock, attributes } = data;

  return withTransaction(async (client) => {
    const prodRes = await client.query<{ id: number; status: string }>(
      'SELECT id, status FROM products WHERE id = $1',
      [productId]
    );
    const product = prodRes.rows[0];
    if (!product) throw new PublicError('NOT_FOUND', 'Product not found');
    if (product.status === 'discontinued')
      throw new Error('Cannot add variants to a discontinued product');

    await client.query('UPDATE products SET has_variants = 1 WHERE id = $1', [productId]);

    const variantRes = await client.query<Record<string, any>>(
      `INSERT INTO product_variants (product_id, sku, barcode, price, cost_price, stock, attributes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        productId,
        sku,
        barcode || null,
        price || null,
        cost_price,
        stock,
        JSON.stringify(attributes),
      ]
    );

    const variant = variantRes.rows[0];
    return {
      ...variant,
      attributes:
        typeof variant.attributes === 'string'
          ? JSON.parse(variant.attributes)
          : variant.attributes,
    };
  });
}

/**
 * Update an existing variant.
 */
export async function updateVariant(
  productId: string | number,
  variantId: string | number,
  data: VariantInput
): Promise<Record<string, any> | null> {
  const { sku, barcode, price, cost_price, stock, attributes } = data;

  const result = await db.query(
    `UPDATE product_variants SET sku=$1, barcode=$2, price=$3, cost_price=$4, stock=$5, attributes=$6, updated_at=NOW()
     WHERE id=$7 AND product_id=$8 RETURNING *`,
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
  return {
    ...variant,
    attributes:
      typeof variant.attributes === 'string' ? JSON.parse(variant.attributes) : variant.attributes,
  };
}

/**
 * Delete a variant.
 */
export async function deleteVariant(
  productId: string | number,
  variantId: string | number
): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM product_variants WHERE id = $1 AND product_id = $2 RETURNING id',
    [variantId, productId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const remaining = await db.query<{ count: string | number }>(
    'SELECT COUNT(*) as count FROM product_variants WHERE product_id = $1',
    [productId]
  );
  if (Number(remaining.rows[0].count) === 0) {
    await db.query('UPDATE products SET has_variants = 0 WHERE id = $1', [productId]);
  }

  return true;
}

/**
 * Generate barcodes for multiple products that don't already have one.
 */
export async function batchGenerateBarcodes(productIds: number[]): Promise<BatchBarcodeResult[]> {
  const prefix = '890100';

  return withTransaction(async (client) => {
    const results: BatchBarcodeResult[] = [];

    const maxResult = await client.query<{ max_bc: string | null }>(
      `SELECT MAX(barcode) as max_bc FROM products WHERE barcode LIKE $1 AND LENGTH(barcode) = 13`,
      [`${prefix}%`]
    );

    let nextSeq = 1;
    if (maxResult.rows[0]?.max_bc) {
      const seqPart = maxResult.rows[0].max_bc.substring(prefix.length, 12);
      nextSeq = parseInt(seqPart, 10) + 1;
    }

    for (const pid of productIds) {
      const prodRes = await client.query<{ id: number; barcode: string | null }>(
        'SELECT id, barcode FROM products WHERE id = $1',
        [pid]
      );
      const product = prodRes.rows[0];
      if (!product || product.barcode) continue;

      const seqStr = String(nextSeq).padStart(6, '0');
      const partial = prefix + seqStr;
      const checkDigit = calculateEan13CheckDigit(partial);
      const barcode = partial + checkDigit;

      await client.query('UPDATE products SET barcode = $1, updated_at = NOW() WHERE id = $2', [
        barcode,
        pid,
      ]);
      results.push({ product_id: pid, barcode });
      nextSeq++;
    }

    return results;
  });
}
