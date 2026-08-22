import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { PurchaseOrderFilters, PurchaseOrderListResult } from './types';

export interface IPurchaseOrdersRepository {
  list(filters: PurchaseOrderFilters, queryable?: Queryable): Promise<PurchaseOrderListResult>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findItemsByPoId(poId: number | string, queryable?: Queryable): Promise<Record<string, any>[]>;
  create(
    poNumber: string,
    distributorId: number,
    notes: string | null,
    total: number,
    createdBy: number,
    queryable: Queryable
  ): Promise<number>;
  createItem(
    poId: number,
    productId: number,
    variantId: number | null,
    quantity: number,
    costPrice: number,
    queryable: Queryable
  ): Promise<void>;
  updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  findPoItem(
    itemId: number,
    poId: number | string,
    queryable: Queryable
  ): Promise<Record<string, any> | null>;
  updateItemReceivedQuantity(
    itemId: number,
    actualReceive: number,
    queryable: Queryable
  ): Promise<void>;
  updateVariantStock(variantId: number, actualReceive: number, queryable: Queryable): Promise<void>;
  updateProductStock(productId: number, actualReceive: number, queryable: Queryable): Promise<void>;
  getProductStock(productId: number, queryable: Queryable): Promise<number>;
  createStockAdjustment(
    productId: number,
    previousQty: number,
    newQty: number,
    delta: number,
    userId: number,
    queryable: Queryable
  ): Promise<void>;
  getPoItemsSummary(
    poId: number | string,
    queryable: Queryable
  ): Promise<Array<{ quantity: number; received_quantity: number }>>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class PurchaseOrdersRepository implements IPurchaseOrdersRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: PurchaseOrderFilters,
    queryable?: Queryable
  ): Promise<PurchaseOrderListResult> {
    const { page: pageNum, pageSize: limitNum, distributorId, status } = filters;
    const offset = (pageNum - 1) * limitNum;

    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (distributorId) {
      where.push(`po.distributor_id = $${paramIdx++}`);
      params.push(distributorId);
    }
    if (status && status !== 'all') {
      where.push(`po.status = $${paramIdx++}`);
      params.push(status);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM purchase_orders po ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.count || 0);

    const queryParams = [...params, limitNum, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const orders = await this.q(queryable).query(
      `SELECT po.*, d.name as distributor_name, u.name as created_by_name,
              (SELECT COUNT(*)::int FROM purchase_order_items WHERE po_id = po.id) as item_count
       FROM purchase_orders po
       LEFT JOIN distributors d ON po.distributor_id = d.id
       LEFT JOIN users u ON po.created_by = u.id
       ${whereClause}
       ORDER BY po.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    return {
      rows: orders.rows,
      total,
    };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const order = await this.q(queryable).query(
      `SELECT po.*, d.name as distributor_name, u.name as created_by_name
       FROM purchase_orders po
       LEFT JOIN distributors d ON po.distributor_id = d.id
       LEFT JOIN users u ON po.created_by = u.id
       WHERE po.id = $1`,
      [id]
    );

    return order.rows[0] || null;
  }

  async findItemsByPoId(
    poId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const items = await this.q(queryable).query(
      `SELECT poi.*, p.name as product_name, p.sku as product_sku,
              pv.sku as variant_sku,
              pv.attributes as variant_attributes
       FROM purchase_order_items poi
       LEFT JOIN products p ON poi.product_id = p.id
       LEFT JOIN product_variants pv ON poi.variant_id = pv.id
       WHERE poi.po_id = $1`,
      [poId]
    );

    return items.rows;
  }

  async create(
    poNumber: string,
    distributorId: number,
    notes: string | null,
    total: number,
    createdBy: number,
    queryable: Queryable
  ): Promise<number> {
    const poRes = await queryable.query<{ id: number }>(
      `INSERT INTO purchase_orders (po_number, distributor_id, notes, total, created_by, status)
       VALUES ($1, $2, $3, $4, $5, 'Draft') RETURNING id`,
      [poNumber, distributorId, notes || null, total, createdBy]
    );
    return poRes.rows[0].id;
  }

  async createItem(
    poId: number,
    productId: number,
    variantId: number | null,
    quantity: number,
    costPrice: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      `INSERT INTO purchase_order_items (po_id, product_id, variant_id, quantity, cost_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [poId, productId, variantId || null, quantity, costPrice]
    );
  }

  async updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return res.rows[0] || null;
  }

  async findPoItem(
    itemId: number,
    poId: number | string,
    queryable: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await queryable.query(
      'SELECT * FROM purchase_order_items WHERE id = $1 AND po_id = $2',
      [itemId, poId]
    );
    return res.rows[0] || null;
  }

  async updateItemReceivedQuantity(
    itemId: number,
    actualReceive: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      'UPDATE purchase_order_items SET received_quantity = COALESCE(received_quantity, 0) + $1 WHERE id = $2',
      [actualReceive, itemId]
    );
  }

  async updateVariantStock(
    variantId: number,
    actualReceive: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query('UPDATE product_variants SET stock = stock + $1 WHERE id = $2', [
      actualReceive,
      variantId,
    ]);
  }

  async updateProductStock(
    productId: number,
    actualReceive: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      'UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
      [actualReceive, productId]
    );
  }

  async getProductStock(productId: number, queryable: Queryable): Promise<number> {
    const pRes = await queryable.query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return Number(pRes.rows[0]?.stock || 0);
  }

  async createStockAdjustment(
    productId: number,
    previousQty: number,
    newQty: number,
    delta: number,
    userId: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      `INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id)
       VALUES ($1, $2, $3, $4, 'Import', $5)`,
      [productId, previousQty, newQty, delta, userId]
    );
  }

  async getPoItemsSummary(
    poId: number | string,
    queryable: Queryable
  ): Promise<Array<{ quantity: number; received_quantity: number }>> {
    const res = await queryable.query<{ quantity: number; received_quantity: number }>(
      'SELECT quantity, COALESCE(received_quantity, 0) as received_quantity FROM purchase_order_items WHERE po_id = $1',
      [poId]
    );
    return res.rows;
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM purchase_orders WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows.length > 0;
  }
}

export const purchaseOrdersRepository = new PurchaseOrdersRepository();
