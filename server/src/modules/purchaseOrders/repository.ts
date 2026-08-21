import { Queryable } from '../../database/transaction';
import pool from '../../database/pool';
import { PurchaseOrderFilters, LowStockProductPO } from './types';

export interface IPurchaseOrdersRepository {
  list(
    filters: PurchaseOrderFilters,
    queryable?: Queryable
  ): Promise<{ orders: Record<string, any>[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findItems(poId: number | string, queryable?: Queryable): Promise<Record<string, any>[]>;
  findLowStockForAutoPO(queryable?: Queryable): Promise<LowStockProductPO[]>;
  createOrder(data: Record<string, any>, queryable: Queryable): Promise<number>;
  createOrderItem(data: Record<string, any>, queryable: Queryable): Promise<void>;
  updateStatus(id: number | string, status: string, queryable?: Queryable): Promise<void>;
  deleteOrder(id: number | string, queryable?: Queryable): Promise<boolean>;
  findItemById(
    itemId: number,
    poId: number | string,
    queryable: Queryable
  ): Promise<Record<string, any> | null>;
  updateReceivedQuantity(
    itemId: number,
    actualReceive: number,
    queryable: Queryable
  ): Promise<void>;
  updateProductStock(productId: number, delta: number, queryable: Queryable): Promise<number>;
  updateVariantStock(variantId: number, delta: number, queryable: Queryable): Promise<void>;
  createStockAdjustment(data: Record<string, any>, queryable: Queryable): Promise<void>;
  getOrderItemsQuantityStatus(
    poId: number | string,
    queryable: Queryable
  ): Promise<{ quantity: number; received_quantity: number }[]>;
}

export class PurchaseOrdersRepository implements IPurchaseOrdersRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: PurchaseOrderFilters,
    queryable?: Queryable
  ): Promise<{ orders: Record<string, any>[]; total: number }> {
    const { page = 1, limit = 25, status, distributor_id, search } = filters;
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];

    if (status && status !== 'All') {
      params.push(status);
      where.push(`po.status = $${params.length}`);
    }
    if (distributor_id) {
      params.push(Number(distributor_id));
      where.push(`po.distributor_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      where.push(`(po.po_number ILIKE $${params.length - 1} OR d.name ILIKE $${params.length})`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.q(queryable).query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM purchase_orders po
       LEFT JOIN distributors d ON po.distributor_id = d.id
       ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.count || 0);

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const orders = await this.q(queryable).query(
      `SELECT po.*, d.name as distributor_name, u.name as created_by_name,
              (SELECT COUNT(*)::int FROM purchase_order_items WHERE po_id = po.id) as item_count
       FROM purchase_orders po
       LEFT JOIN distributors d ON po.distributor_id = d.id
       LEFT JOIN users u ON po.created_by = u.id
       ${whereClause}
       ORDER BY po.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limit, offset]
    );

    return { orders: orders.rows, total };
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

  async findItems(poId: number | string, queryable?: Queryable): Promise<Record<string, any>[]> {
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

    return items.rows.map((item: any) => ({
      ...item,
      variant_attributes:
        typeof item.variant_attributes === 'string'
          ? JSON.parse(item.variant_attributes)
          : item.variant_attributes || null,
    }));
  }

  async findLowStockForAutoPO(queryable?: Queryable): Promise<LowStockProductPO[]> {
    const lowStock = await this.q(queryable).query<LowStockProductPO>(
      `SELECT p.id as product_id, p.name, p.sku, p.cost_price, p.stock, p.min_stock,
              p.distributor_id, d.name as distributor_name,
              (p.min_stock * 2 - p.stock) as suggested_qty
       FROM products p
       LEFT JOIN distributors d ON p.distributor_id = d.id
       WHERE p.stock <= p.min_stock AND p.distributor_id IS NOT NULL AND p.status = 'active'
       ORDER BY d.name, p.name`
    );
    return lowStock.rows;
  }

  async createOrder(data: Record<string, any>, queryable: Queryable): Promise<number> {
    const result = await queryable.query<{ id: number }>(
      `INSERT INTO purchase_orders (po_number, distributor_id, notes, total, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.po_number, data.distributor_id, data.notes || null, data.total, data.created_by]
    );
    return result.rows[0].id;
  }

  async createOrderItem(data: Record<string, any>, queryable: Queryable): Promise<void> {
    await queryable.query(
      `INSERT INTO purchase_order_items (po_id, product_id, variant_id, quantity, cost_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [data.po_id, data.product_id, data.variant_id || null, data.quantity, data.cost_price]
    );
  }

  async updateStatus(id: number | string, status: string, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query(
      `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );
  }

  async deleteOrder(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM purchase_orders WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows.length > 0;
  }

  async findItemById(
    itemId: number,
    poId: number | string,
    queryable: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await queryable.query<Record<string, any>>(
      `SELECT * FROM purchase_order_items WHERE id = $1 AND po_id = $2`,
      [itemId, poId]
    );
    return res.rows[0] || null;
  }

  async updateReceivedQuantity(
    itemId: number,
    actualReceive: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      `UPDATE purchase_order_items SET received_quantity = received_quantity + $1 WHERE id = $2`,
      [actualReceive, itemId]
    );
  }

  async updateProductStock(
    productId: number,
    delta: number,
    queryable: Queryable
  ): Promise<number> {
    const res = await queryable.query<{ stock: number }>(
      `UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2 RETURNING stock`,
      [delta, productId]
    );
    return Number(res.rows[0]?.stock || 0);
  }

  async updateVariantStock(variantId: number, delta: number, queryable: Queryable): Promise<void> {
    await queryable.query(`UPDATE product_variants SET stock = stock + $1 WHERE id = $2`, [
      delta,
      variantId,
    ]);
  }

  async createStockAdjustment(data: Record<string, any>, queryable: Queryable): Promise<void> {
    await queryable.query(
      `INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.product_id, data.previous_qty, data.new_qty, data.delta, data.reason, data.user_id]
    );
  }

  async getOrderItemsQuantityStatus(
    poId: number | string,
    queryable: Queryable
  ): Promise<{ quantity: number; received_quantity: number }[]> {
    const res = await queryable.query<{ quantity: number; received_quantity: number }>(
      `SELECT quantity, received_quantity FROM purchase_order_items WHERE po_id = $1`,
      [poId]
    );
    return res.rows;
  }
}

export const purchaseOrdersRepository = new PurchaseOrdersRepository();
