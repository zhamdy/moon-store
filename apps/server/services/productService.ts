import db from '../src/database/pool';
import { PublicError } from '../src/http/errors';
import { withTransaction, Queryable } from '../src/database/transaction';
import { productSchema } from '../validators/productSchema';
import { notifyLowStock } from './notifications';
import { stockAdjustmentsService } from '../src/modules/inventory/stockAdjustments/service';
import {
  assertSlugAvailable,
  assignGeneratedSlug,
  rethrowSlugViolation,
} from '../src/modules/inventory/shared/slug';

// --- Types ---

export interface CreateProductInput {
  name: string;
  sku: string;
  /** Absent on create: generated. Absent on update: left alone (KD-6). */
  slug?: string;
  /** Absent on update: left alone; null clears it. */
  name_en?: string | null;
  /** Same absent/null convention as `name_en`. */
  description?: string | null;
  description_en?: string | null;
  /** The storefront Details tab; same absent/null convention. */
  material?: string | null;
  material_en?: string | null;
  care?: string | null;
  care_en?: string | null;
  fit?: string | null;
  fit_en?: string | null;
  barcode?: string | null;
  price: number;
  cost_price: number;
  stock: number;
  category?: string | null;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
}

/**
 * Update differs from create in what an **absent** field means: these five keep their
 * stored value rather than being overwritten (HIGH-3 / MED-11). The type says so, so a
 * caller cannot assume the create shape and quietly reset a product's stock or cost.
 */
/** Stable, documented code for a product write refused because the row moved. */
export const PRODUCT_MODIFIED_CODE = 'PRODUCT_MODIFIED';

/**
 * Renders `products.updated_at` as the version token a client echoes back. Deliberately
 * `toISOString()`, the same call `res.json()` makes when it serializes the row, so the
 * token compared here is byte-identical to the one the client was given rather than two
 * formats kept in agreement. Millisecond resolution for the reason
 * `collectionVersionToken` documents at length: a JS `Date` holds milliseconds while
 * `timestamptz` holds microseconds, so the finer digits are gone before any client sees
 * them.
 */
export function productVersionToken(updatedAt: Date): string {
  return updatedAt.toISOString();
}

export type UpdateProductInput = Omit<CreateProductInput, 'stock' | 'cost_price' | 'min_stock'> & {
  stock?: number;
  cost_price?: number;
  min_stock?: number;
  /** The version the edit was composed against; absent stakes no claim on it. */
  expected_updated_at?: string;
};

export interface BulkUpdateUpdates {
  category_id?: number;
  distributor_id?: number | null;
  price_percent?: number;
  status?: 'active' | 'inactive' | 'discontinued';
}

export interface AdjustStockInput {
  delta: number;
  reason: string;
  /** The variant whose stock moved; absent for a product-level adjustment. */
  variant_id?: number | null;
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
 *
 * One transaction, so the row and its generated slug commit together: a product is never
 * visible without the slug the storefront addresses it by.
 */
export async function createProduct(data: CreateProductInput): Promise<Record<string, any>> {
  const {
    name,
    sku,
    slug,
    name_en,
    description,
    description_en,
    material,
    material_en,
    care,
    care_en,
    fit,
    fit_en,
    barcode,
    price,
    cost_price,
    stock,
    category,
    category_id,
    distributor_id,
    min_stock,
  } = data;

  return withTransaction(async (client) => {
    let categoryText = category || null;
    if (category_id && !categoryText) {
      categoryText = await resolveCategoryText(client, category_id);
    }

    if (slug) await assertSlugAvailable(client, 'products', slug);

    let created: Record<string, unknown>;
    try {
      const result = await client.query(
        `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, distributor_id, min_stock, slug, name_en, description, description_en,
                               material, material_en, care, care_en, fit, fit_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
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
          slug ?? null,
          name_en || null,
          description || null,
          description_en || null,
          material || null,
          material_en || null,
          care || null,
          care_en || null,
          fit || null,
          fit_en || null,
        ]
      );
      created = result.rows[0];
    } catch (error) {
      rethrowSlugViolation(error, 'products');
    }

    if (created.slug) return created;
    return assignGeneratedSlug(client, 'products', Number(created.id), [name_en, sku]);
  });
}

/**
 * Thrown when a product write carries a version token that is no longer current.
 *
 * Deliberately carries no "current" token, for the reason `CollectionConflictError`
 * documents: the recovery for a conflict is *review* — re-read, see what changed, decide
 * — and handing back a fresh token would make blind resubmission the easiest thing to do,
 * which is the silent overwrite the refusal exists to prevent.
 */
export class ProductConflictError extends Error {
  constructor(
    message: string,
    public readonly code: string = PRODUCT_MODIFIED_CODE,
    public readonly statusCode: number = 409
  ) {
    super(message);
    this.name = 'ProductConflictError';
  }
}

/**
 * Update an existing product. Tracks price history changes.
 *
 * `expected_updated_at` closes the lost-update window HIGH-3 measured: between the
 * operator opening the form and saving it, a cashier can sell the product, and a
 * full-replacement write composed against the stale read overwrites what it missed. The
 * check takes `FOR UPDATE` on the row first — the lock is what makes check-then-write
 * atomic, exactly as `PUT /collections/:id` does; a bare comparison would still let the
 * loser of a race write from stale data.
 */
export async function updateProduct(
  id: string | number,
  data: UpdateProductInput,
  userId: number
): Promise<Record<string, any> | null> {
  return withTransaction(async (client) => {
    if (data.expected_updated_at !== undefined) {
      const locked = await client.query<{ updated_at: Date }>(
        'SELECT updated_at FROM products WHERE id = $1 FOR UPDATE',
        [id]
      );
      const current = locked.rows[0];
      if (current && productVersionToken(current.updated_at) !== data.expected_updated_at) {
        throw new ProductConflictError(
          'This product was changed by someone else after you opened it. Reload to see the current values before saving.'
        );
      }
    }

    const existing = await client.query<{ status: string }>(
      'SELECT status FROM products WHERE id = $1',
      [id]
    );
    if (existing.rows.length > 0 && existing.rows[0].status === 'discontinued') {
      const err = new Error('Cannot edit a discontinued product. Reactivate it first.');
      (err as any).type = 'discontinued';
      throw err;
    }

    const {
      name,
      sku,
      slug,
      name_en,
      description,
      description_en,
      material,
      material_en,
      care,
      care_en,
      fit,
      fit_en,
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

    if (slug) await assertSlugAvailable(db, 'products', slug, { column: 'id', value: Number(id) });

    const oldProduct = await client.query<{ price: number; cost_price: number }>(
      'SELECT price, cost_price FROM products WHERE id = $1',
      [id]
    );

    // A replacement, except where absence has to mean "keep". The storefront text fields
    // were already like this so a client predating them could not wipe them; `stock`,
    // `cost_price`, `min_stock`, `barcode` and `distributor_id` join them because absence
    // was silently destructive there too (HIGH-3 / MED-11): a name edit resurrected stock
    // sold since the form opened, with no audit row, and a partial body reset a product's
    // cost basis to the schema default.
    let result;
    try {
      result = await client.query(
        `UPDATE products SET name=$1, sku=$2,
           barcode=CASE WHEN $31::boolean THEN $3::text ELSE barcode END,
           price=$4,
           cost_price=CASE WHEN $32::boolean THEN $5::numeric ELSE cost_price END,
           stock=CASE WHEN $33::boolean THEN $6::int ELSE stock END,
           category=$7, category_id=$8,
           distributor_id=CASE WHEN $34::boolean THEN $9::int ELSE distributor_id END,
           min_stock=CASE WHEN $35::boolean THEN $10::int ELSE min_stock END,
           slug=COALESCE($12::text, slug), name_en=CASE WHEN $13::boolean THEN $14::text ELSE name_en END,
           description=CASE WHEN $15::boolean THEN $16::text ELSE description END,
           description_en=CASE WHEN $17::boolean THEN $18::text ELSE description_en END,
           material=CASE WHEN $19::boolean THEN $20::text ELSE material END,
           material_en=CASE WHEN $21::boolean THEN $22::text ELSE material_en END,
           care=CASE WHEN $23::boolean THEN $24::text ELSE care END,
           care_en=CASE WHEN $25::boolean THEN $26::text ELSE care_en END,
           fit=CASE WHEN $27::boolean THEN $28::text ELSE fit END,
           fit_en=CASE WHEN $29::boolean THEN $30::text ELSE fit_en END,
           updated_at=NOW()
         WHERE id=$11 RETURNING *`,
        [
          name,
          sku,
          barcode ?? null,
          price,
          cost_price ?? null,
          stock ?? null,
          categoryText,
          category_id || null,
          distributor_id ?? null,
          min_stock ?? null,
          id,
          slug ?? null,
          name_en !== undefined,
          name_en || null,
          description !== undefined,
          description || null,
          description_en !== undefined,
          description_en || null,
          material !== undefined,
          material || null,
          material_en !== undefined,
          material_en || null,
          care !== undefined,
          care || null,
          care_en !== undefined,
          care_en || null,
          fit !== undefined,
          fit || null,
          fit_en !== undefined,
          fit_en || null,
          barcode !== undefined,
          cost_price !== undefined,
          stock !== undefined,
          distributor_id !== undefined,
          min_stock !== undefined,
        ]
      );
    } catch (error) {
      rethrowSlugViolation(error, 'products');
    }

    if (result.rows.length === 0) {
      return null;
    }

    if (oldProduct.rows.length > 0) {
      const old = oldProduct.rows[0];
      // MED-15: `old.price !== price` compared node-postgres's NUMERIC **string** ('1950')
      // against the request's **number** (1950), which is always true, so every product
      // edit wrote two phantom history rows and any "when did this price change" query was
      // noise. On pg-mem the comparison is number-vs-number and behaved correctly, so no
      // unit test caught it — an AD-5 case in the wild. Both sides are coerced now, and a
      // field the caller omitted did not change at all.
      if (Number(old.price) !== Number(price)) {
        await client.query(
          'INSERT INTO price_history (product_id, field, old_value, new_value, user_id) VALUES ($1, $2, $3, $4, $5)',
          [id, 'price', old.price, price, userId]
        );
      }
      if (cost_price !== undefined && Number(old.cost_price) !== Number(cost_price)) {
        await client.query(
          'INSERT INTO price_history (product_id, field, old_value, new_value, user_id) VALUES ($1, $2, $3, $4, $5)',
          [id, 'cost_price', old.cost_price, cost_price, userId]
        );
      }
    }

    const updated = result.rows[0] as Record<string, any>;
    if (updated.stock <= updated.min_stock) {
      notifyLowStock(updated.name, updated.stock, updated.id);
    }

    return updated;
  });
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
 *
 * Each row is its own transaction, as each row was its own autocommit statement before:
 * one bad row still fails alone. The transaction exists so a row and its generated slug
 * commit together, and the slug retry runs under a SAVEPOINT inside it. An explicit slug
 * held by a different SKU fails that row only. A re-imported SKU keeps its stored slug and
 * `name_en`, `description`, `material`, `care`, `fit` (and each `_en` twin) unless the row
 * supplies new ones.
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
        slug,
        name_en,
        description,
        description_en,
        material,
        material_en,
        care,
        care_en,
        fit,
        fit_en,
        barcode,
        price,
        cost_price,
        stock,
        category,
        category_id,
        distributor_id,
        min_stock,
      } = parsed.data;
      await withTransaction(async (client) => {
        if (slug)
          await assertSlugAvailable(client, 'products', slug, { column: 'sku', value: sku });

        let row: { id: number; slug: string | null };
        try {
          const result = await client.query<{ id: number; slug: string | null }>(
            `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, distributor_id, min_stock, slug, name_en, description, description_en,
                                   material, material_en, care, care_en, fit, fit_en)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text, $12::text, $13::text, $14::text,
                     $15::text, $16::text, $17::text, $18::text, $19::text, $20::text)
             ON CONFLICT(sku) DO UPDATE SET name=$1, price=$4, cost_price=$5, stock=$6, category=$7, category_id=$8, distributor_id=$9, min_stock=$10,
               slug=COALESCE($11::text, products.slug), name_en=COALESCE($12::text, products.name_en),
               description=COALESCE($13::text, products.description), description_en=COALESCE($14::text, products.description_en),
               material=COALESCE($15::text, products.material), material_en=COALESCE($16::text, products.material_en),
               care=COALESCE($17::text, products.care), care_en=COALESCE($18::text, products.care_en),
               fit=COALESCE($19::text, products.fit), fit_en=COALESCE($20::text, products.fit_en), updated_at=NOW()
             RETURNING id, slug`,
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
              slug ?? null,
              name_en || null,
              description || null,
              description_en || null,
              material || null,
              material_en || null,
              care || null,
              care_en || null,
              fit || null,
              fit_en || null,
            ]
          );
          row = result.rows[0];
        } catch (error) {
          rethrowSlugViolation(error, 'products');
        }

        if (!row.slug) await assignGeneratedSlug(client, 'products', row.id, [name_en, sku]);
      });
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
  const { delta, reason, variant_id: variantId } = input;

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
      client,
      variantId
    );

    if (applied === null) {
      // The guarded write matched nothing: either the delta would go below zero, or the
      // variant does not belong to this product. Both are the caller's to correct, and
      // neither wrote anything.
      throw new Error('Stock cannot go below zero');
    }

    // Only for a product-level adjustment: `applied.newQty` is that variant's stock when
    // one was named, and comparing one size against the product's reorder threshold would
    // raise a low-stock alert for a product that is well stocked in every other size.
    if (variantId == null && applied.newQty <= product.min_stock) {
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
