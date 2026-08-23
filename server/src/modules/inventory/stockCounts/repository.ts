import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { StockCountRecord, StockCountItemRecord, StockCountFilters } from './types';

export interface IStockCountsRepository {
  list(
    filters: StockCountFilters,
    queryable?: Queryable
  ): Promise<{ rows: StockCountRecord[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<StockCountRecord | null>;
  findItemsByCountId(
    countId: number | string,
    queryable?: Queryable
  ): Promise<StockCountItemRecord[]>;
  findItemById(
    itemId: number | string,
    countId: number | string,
    queryable?: Queryable
  ): Promise<StockCountItemRecord | null>;
  findActiveProductsForCount(
    categoryId?: number,
    queryable?: Queryable
  ): Promise<
    { id: number; stock: number; variant_id?: number | null; variant_stock?: number | null }[]
  >;
  createStockCount(
    data: { category_id?: number | null; notes?: string | null; created_by: number },
    queryable?: Queryable
  ): Promise<number>;
  createStockCountItems(
    countId: number,
    items: { product_id: number; variant_id: number | null; expected_qty: number }[],
    queryable?: Queryable
  ): Promise<void>;
  updateCountItem(
    itemId: number | string,
    countedQty: number,
    variance: number,
    notes: string | null,
    queryable?: Queryable
  ): Promise<StockCountItemRecord | null>;
  findVarianceItemsForCount(
    countId: number | string,
    queryable?: Queryable
  ): Promise<StockCountItemRecord[]>;
  updateProductStock(productId: number, stock: number, queryable?: Queryable): Promise<void>;
  updateVariantStock(variantId: number, stock: number, queryable?: Queryable): Promise<void>;
  createStockAdjustment(
    data: {
      product_id: number;
      previous_qty: number;
      new_qty: number;
      delta: number;
      reason: string;
      user_id: number;
    },
    queryable?: Queryable
  ): Promise<void>;
  completeCount(countId: number | string, queryable?: Queryable): Promise<void>;
  cancelCount(countId: number | string, queryable?: Queryable): Promise<boolean>;
}

export class StockCountsRepository implements IStockCountsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: StockCountFilters,
    queryable?: Queryable
  ): Promise<{ rows: StockCountRecord[]; total: number }> {
    const { page, pageSize, status, sortOrder } = filters;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      where.push(`sc.status = $${params.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.q(queryable).query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM stock_counts sc ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.count || 0);

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const result = await this.q(queryable).query<StockCountRecord>(
      `SELECT sc.*, u.name as created_by_name, c.name as category_name,
              (SELECT COUNT(*)::int FROM stock_count_items WHERE count_id = sc.id) as total_items,
              (SELECT COUNT(*)::int FROM stock_count_items WHERE count_id = sc.id AND counted_qty IS NOT NULL) as counted_items,
              (SELECT COALESCE(SUM(variance), 0)::int FROM stock_count_items WHERE count_id = sc.id) as total_variance
       FROM stock_counts sc
       LEFT JOIN users u ON sc.created_by = u.id
       LEFT JOIN categories c ON sc.category_id = c.id
       ${whereClause}
        ORDER BY sc.created_at ${direction}, sc.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, offset]
    );

    return { rows: result.rows, total };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<StockCountRecord | null> {
    const res = await this.q(queryable).query<StockCountRecord>(
      `SELECT sc.*, u.name as created_by_name, c.name as category_name
       FROM stock_counts sc
       LEFT JOIN users u ON sc.created_by = u.id
       LEFT JOIN categories c ON sc.category_id = c.id
       WHERE sc.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findItemsByCountId(
    countId: number | string,
    queryable?: Queryable
  ): Promise<StockCountItemRecord[]> {
    const res = await this.q(queryable).query<StockCountItemRecord>(
      `SELECT sci.*, p.name as product_name, p.sku as product_sku, p.barcode as product_barcode,
              p.price, p.cost_price,
              pv.sku as variant_sku, pv.barcode as variant_barcode, pv.attributes as variant_attributes
       FROM stock_count_items sci
       JOIN products p ON sci.product_id = p.id
       LEFT JOIN product_variants pv ON sci.variant_id = pv.id
       WHERE sci.count_id = $1
       ORDER BY p.name ASC`,
      [countId]
    );
    return res.rows.map((row) => ({
      ...row,
      variant_attributes:
        typeof row.variant_attributes === 'string'
          ? JSON.parse(row.variant_attributes)
          : row.variant_attributes,
    }));
  }

  async findItemById(
    itemId: number | string,
    countId: number | string,
    queryable?: Queryable
  ): Promise<StockCountItemRecord | null> {
    const res = await this.q(queryable).query<StockCountItemRecord>(
      'SELECT * FROM stock_count_items WHERE id = $1 AND count_id = $2',
      [itemId, countId]
    );
    return res.rows[0] || null;
  }

  async findActiveProductsForCount(
    categoryId?: number,
    queryable?: Queryable
  ): Promise<
    { id: number; stock: number; variant_id?: number | null; variant_stock?: number | null }[]
  > {
    const query = categoryId
      ? `SELECT p.id, p.stock, pv.id as variant_id, pv.stock as variant_stock
         FROM products p
         LEFT JOIN product_variants pv ON pv.product_id = p.id
         WHERE p.category_id = $1 AND p.status = 'active'`
      : `SELECT p.id, p.stock, pv.id as variant_id, pv.stock as variant_stock
         FROM products p
         LEFT JOIN product_variants pv ON pv.product_id = p.id
         WHERE p.status = 'active'`;

    const params = categoryId ? [categoryId] : [];
    const res = await this.q(queryable).query<{
      id: number;
      stock: number;
      variant_id?: number | null;
      variant_stock?: number | null;
    }>(query, params);
    return res.rows;
  }

  async createStockCount(
    data: { category_id?: number | null; notes?: string | null; created_by: number },
    queryable?: Queryable
  ): Promise<number> {
    const res = await this.q(queryable).query<{ id: number }>(
      `INSERT INTO stock_counts (category_id, notes, status, created_by)
       VALUES ($1, $2, 'in_progress', $3) RETURNING id`,
      [data.category_id || null, data.notes || null, data.created_by]
    );
    return res.rows[0].id;
  }

  async createStockCountItems(
    countId: number,
    items: { product_id: number; variant_id: number | null; expected_qty: number }[],
    queryable?: Queryable
  ): Promise<void> {
    for (const row of items) {
      await this.q(queryable).query(
        `INSERT INTO stock_count_items (count_id, product_id, variant_id, expected_qty)
         VALUES ($1, $2, $3, $4)`,
        [countId, row.product_id, row.variant_id || null, row.expected_qty]
      );
    }
  }

  async updateCountItem(
    itemId: number | string,
    countedQty: number,
    variance: number,
    notes: string | null,
    queryable?: Queryable
  ): Promise<StockCountItemRecord | null> {
    const res = await this.q(queryable).query<StockCountItemRecord>(
      `UPDATE stock_count_items SET counted_qty = $1, variance = $2, notes = $3
       WHERE id = $4 RETURNING *`,
      [countedQty, variance, notes || null, itemId]
    );
    return res.rows[0] || null;
  }

  async findVarianceItemsForCount(
    countId: number | string,
    queryable?: Queryable
  ): Promise<StockCountItemRecord[]> {
    const res = await this.q(queryable).query<StockCountItemRecord>(
      `SELECT * FROM stock_count_items
       WHERE count_id = $1 AND counted_qty IS NOT NULL AND variance != 0`,
      [countId]
    );
    return res.rows;
  }

  async updateProductStock(productId: number, stock: number, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query(
      'UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2',
      [stock, productId]
    );
  }

  async updateVariantStock(variantId: number, stock: number, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query('UPDATE product_variants SET stock = $1 WHERE id = $2', [
      stock,
      variantId,
    ]);
  }

  async createStockAdjustment(
    data: {
      product_id: number;
      previous_qty: number;
      new_qty: number;
      delta: number;
      reason: string;
      user_id: number;
    },
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.product_id, data.previous_qty, data.new_qty, data.delta, data.reason, data.user_id]
    );
  }

  async completeCount(countId: number | string, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query(
      `UPDATE stock_counts SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [countId]
    );
  }

  async cancelCount(countId: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      `UPDATE stock_counts SET status = 'cancelled' WHERE id = $1 AND status = 'in_progress' RETURNING id`,
      [countId]
    );
    return res.rows.length > 0;
  }
}

export const stockCountsRepository = new StockCountsRepository();
