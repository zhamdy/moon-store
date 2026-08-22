import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  DeliveryOrderFilters,
  DeliveryListResult,
  PerformanceResult,
  DeliveryOrderInput,
  DeliveryHistoryFilters,
} from './types';

export interface IDeliveryRepository {
  list(filters: DeliveryOrderFilters, queryable?: Queryable): Promise<DeliveryListResult>;
  getPerformance(queryable?: Queryable): Promise<PerformanceResult>;
  findById(id: string | number, queryable?: Queryable): Promise<Record<string, any> | null>;
  findCustomerById(customerId: number, queryable?: Queryable): Promise<{ id: number } | null>;
  createCustomer(
    name: string,
    phone: string,
    address?: string | null,
    queryable?: Queryable
  ): Promise<{ id: number }>;
  createOrder(
    orderNumber: string,
    resolvedCustomerId: number,
    resolvedEstimatedDelivery: string,
    data: DeliveryOrderInput,
    queryable: Queryable
  ): Promise<Record<string, any>>;
  createOrderItems(
    orderId: number | string,
    items: Array<{ product_id: number; quantity: number }>,
    queryable: Queryable
  ): Promise<void>;
  updateOrder(
    id: string | number,
    resolvedCustomerId: number,
    data: DeliveryOrderInput,
    queryable: Queryable
  ): Promise<Record<string, any> | null>;
  deleteOrderItems(orderId: string | number, queryable: Queryable): Promise<void>;
  updateStatus(
    id: string | number,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  createStatusHistory(
    orderId: string | number,
    status: string,
    notes: string | null | undefined,
    userId: number,
    queryable?: Queryable
  ): Promise<void>;
  getStatusHistory(
    id: string | number,
    filters: DeliveryHistoryFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }>;
  getShippingCompanyName(id: number, queryable?: Queryable): Promise<string | null>;
}

export class DeliveryRepository implements IDeliveryRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(filters: DeliveryOrderFilters, queryable?: Queryable): Promise<DeliveryListResult> {
    const { page: pageNum, pageSize: limitNum, status, search } = filters;
    const offset = (pageNum - 1) * limitNum;

    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status && status !== 'All') {
      where.push(`d.status = $${paramIdx++}`);
      params.push(status);
    }
    if (search) {
      where.push(
        `(d.customer_name ILIKE $${paramIdx} OR d.order_number ILIKE $${paramIdx} OR d.tracking_number ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM delivery_orders d ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.count || 0);

    const queryParams = [...params, limitNum, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const orders = (
      await this.q(queryable).query(
        `SELECT d.*, sc.name as shipping_company_name
         FROM delivery_orders d
         LEFT JOIN shipping_companies sc ON d.shipping_company_id = sc.id
         ${whereClause}
         ORDER BY d.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        queryParams
      )
    ).rows as Record<string, any>[];

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');
      const allItems = (
        await this.q(queryable).query(
          `SELECT di.*, p.name as product_name, p.price as product_price
           FROM delivery_items di JOIN products p ON di.product_id = p.id
           WHERE di.order_id IN (${placeholders})`,
          orderIds
        )
      ).rows as Record<string, any>[];

      const itemsByOrder = new Map<number, Record<string, any>[]>();
      for (const item of allItems) {
        const list = itemsByOrder.get(item.order_id) || [];
        list.push(item);
        itemsByOrder.set(item.order_id, list);
      }
      for (const order of orders) {
        order.items = itemsByOrder.get(order.id) || [];
      }
    } else {
      for (const order of orders) {
        order.items = [];
      }
    }

    return {
      orders,
      total,
    };
  }

  async getPerformance(queryable?: Queryable): Promise<PerformanceResult> {
    const totalResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM delivery_orders WHERE status = 'Delivered'`
    );
    const totalDelivered = Number(totalResult.rows[0]?.count || 0);

    const avgTimeResult = await this.q(queryable).query<{ avg_days: string | number | null }>(
      `SELECT AVG(
         EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0
       ) as avg_days
       FROM delivery_orders
       WHERE status = 'Delivered'`
    );
    const avgDeliveryDays = Math.round(Number(avgTimeResult.rows[0]?.avg_days || 0) * 10) / 10;

    const pendingResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM delivery_orders WHERE status = 'Pending'`
    );
    const pendingCount = Number(pendingResult.rows[0]?.count || 0);

    const shippedResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM delivery_orders WHERE status = 'Shipped'`
    );
    const shippedCount = Number(shippedResult.rows[0]?.count || 0);

    const companyStats = (
      await this.q(queryable).query(
        `SELECT sc.id, sc.name,
         COUNT(*)::int as total_orders,
         COALESCE(SUM(CASE WHEN d.status = 'Delivered' THEN 1 ELSE 0 END), 0)::int as delivered,
         COALESCE(SUM(CASE WHEN d.status = 'Cancelled' THEN 1 ELSE 0 END), 0)::int as cancelled,
         ROUND(AVG(CASE WHEN d.status = 'Delivered' THEN EXTRACT(EPOCH FROM (d.updated_at - d.created_at)) / 86400.0 END)::numeric, 1) as avg_days
       FROM delivery_orders d
       JOIN shipping_companies sc ON d.shipping_company_id = sc.id
       GROUP BY sc.id, sc.name
       ORDER BY delivered DESC`
      )
    ).rows as Record<string, any>[];

    return {
      totalDelivered,
      avgDeliveryDays,
      pendingCount,
      shippedCount,
      companyStats,
    };
  }

  async findById(id: string | number, queryable?: Queryable): Promise<Record<string, any> | null> {
    const result = await this.q(queryable).query(
      `SELECT d.*, sc.name as shipping_company_name
       FROM delivery_orders d
       LEFT JOIN shipping_companies sc ON d.shipping_company_id = sc.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const items = (
      await this.q(queryable).query(
        `SELECT di.*, p.name as product_name, p.price as product_price
         FROM delivery_items di JOIN products p ON di.product_id = p.id
         WHERE di.order_id = $1`,
        [id]
      )
    ).rows;

    return { ...result.rows[0], items };
  }

  async findCustomerById(
    customerId: number,
    queryable?: Queryable
  ): Promise<{ id: number } | null> {
    const res = await this.q(queryable).query<{ id: number }>(
      'SELECT id FROM customers WHERE id = $1',
      [customerId]
    );
    return res.rows[0] || null;
  }

  async createCustomer(
    name: string,
    phone: string,
    address?: string | null,
    queryable?: Queryable
  ): Promise<{ id: number }> {
    const res = await this.q(queryable).query<{ id: number }>(
      'INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3) RETURNING id',
      [name, phone, address || null]
    );
    return res.rows[0];
  }

  async createOrder(
    orderNumber: string,
    resolvedCustomerId: number,
    resolvedEstimatedDelivery: string,
    data: DeliveryOrderInput,
    queryable: Queryable
  ): Promise<Record<string, any>> {
    const res = await queryable.query<Record<string, any>>(
      `INSERT INTO delivery_orders (order_number, customer_name, phone, address, notes, customer_id, estimated_delivery, shipping_company_id, tracking_number, shipping_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        orderNumber,
        data.customer_name,
        data.phone,
        data.address,
        data.notes || null,
        resolvedCustomerId,
        resolvedEstimatedDelivery,
        data.shipping_company_id || null,
        data.tracking_number || null,
        data.shipping_cost || 0,
      ]
    );
    return res.rows[0];
  }

  async createOrderItems(
    orderId: number | string,
    items: Array<{ product_id: number; quantity: number }>,
    queryable: Queryable
  ): Promise<void> {
    for (const item of items) {
      await queryable.query(
        'INSERT INTO delivery_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
        [orderId, item.product_id, item.quantity]
      );
    }
  }

  async updateOrder(
    id: string | number,
    resolvedCustomerId: number,
    data: DeliveryOrderInput,
    queryable: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await queryable.query<Record<string, any>>(
      `UPDATE delivery_orders SET customer_name=$1, phone=$2, address=$3, notes=$4, customer_id=$5, estimated_delivery=$6, shipping_company_id=$7, tracking_number=$8, shipping_cost=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [
        data.customer_name,
        data.phone,
        data.address,
        data.notes || null,
        resolvedCustomerId,
        data.estimated_delivery || null,
        data.shipping_company_id || null,
        data.tracking_number || null,
        data.shipping_cost || 0,
        id,
      ]
    );
    return res.rows[0] || null;
  }

  async deleteOrderItems(orderId: string | number, queryable: Queryable): Promise<void> {
    await queryable.query('DELETE FROM delivery_items WHERE order_id = $1', [orderId]);
  }

  async updateStatus(
    id: string | number,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `UPDATE delivery_orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, id]
    );
    return res.rows[0] || null;
  }

  async createStatusHistory(
    orderId: string | number,
    status: string,
    notes: string | null | undefined,
    userId: number,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO delivery_status_history (order_id, status, notes, changed_by) VALUES ($1, $2, $3, $4)`,
      [orderId, status, notes || null, userId]
    );
  }

  async getStatusHistory(
    id: string | number,
    filters: DeliveryHistoryFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }> {
    const offset = (filters.page - 1) * filters.pageSize;
    const count = await this.q(queryable).query<{ total: string | number }>(
      'SELECT COUNT(*) AS total FROM delivery_status_history WHERE order_id = $1',
      [id]
    );
    const result = await this.q(queryable).query(
      `SELECT h.*, u.name as changed_by_name
       FROM delivery_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.order_id = $1
       ORDER BY h.created_at ASC
       LIMIT $2 OFFSET $3`,
      [id, filters.pageSize, offset]
    );
    return { rows: result.rows as Record<string, any>[], total: Number(count.rows[0]?.total || 0) };
  }

  async getShippingCompanyName(id: number, queryable?: Queryable): Promise<string | null> {
    const scResult = await this.q(queryable).query<{ name: string }>(
      'SELECT name FROM shipping_companies WHERE id = $1',
      [id]
    );
    return scResult.rows[0]?.name || null;
  }
}

export const deliveryRepository = new DeliveryRepository();
