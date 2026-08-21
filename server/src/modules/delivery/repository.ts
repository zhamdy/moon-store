import { Queryable } from '../../database/transaction';
import pool from '../../database/pool';
import { DeliveryOrderFilters } from './types';

export interface IDeliveryRepository {
  list(
    filters: DeliveryOrderFilters,
    queryable?: Queryable
  ): Promise<{ orders: Record<string, any>[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findItemsByOrderId(
    orderId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]>;
  findItemsByOrderIds(orderIds: number[], queryable?: Queryable): Promise<Record<string, any>[]>;
  createOrder(data: Record<string, any>, queryable: Queryable): Promise<Record<string, any>>;
  updateOrder(
    id: number | string,
    data: Record<string, any>,
    queryable: Queryable
  ): Promise<Record<string, any> | null>;
  createDeliveryItem(
    orderId: number,
    productId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<void>;
  deleteDeliveryItems(orderId: number | string, queryable: Queryable): Promise<void>;
  updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  createStatusHistory(
    orderId: number | string,
    status: string,
    notes: string | null,
    changedBy: number,
    queryable?: Queryable
  ): Promise<void>;
  getStatusHistory(orderId: number | string, queryable?: Queryable): Promise<Record<string, any>[]>;
  getPerformance(queryable?: Queryable): Promise<Record<string, any>>;
  findCustomerById(customerId: number, queryable?: Queryable): Promise<Record<string, any> | null>;
  createCustomer(
    name: string,
    phone: string,
    address?: string,
    queryable?: Queryable
  ): Promise<Record<string, any>>;
  findShippingCompanyById(
    companyId: number,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
}

export class DeliveryRepository implements IDeliveryRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: DeliveryOrderFilters,
    queryable?: Queryable
  ): Promise<{ orders: Record<string, any>[]; total: number }> {
    const { page = 1, limit = 25, status, search } = filters;
    const offset = (page - 1) * limit;

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

    const countRes = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM delivery_orders d ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const queryParams = [...params, limit, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const rowsRes = await this.q(queryable).query(
      `SELECT d.*, sc.name as shipping_company_name
       FROM delivery_orders d
       LEFT JOIN shipping_companies sc ON d.shipping_company_id = sc.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    return { orders: rowsRes.rows, total };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `SELECT d.*, sc.name as shipping_company_name
       FROM delivery_orders d
       LEFT JOIN shipping_companies sc ON d.shipping_company_id = sc.id
       WHERE d.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findItemsByOrderId(
    orderId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT di.*, p.name as product_name, p.price as product_price
       FROM delivery_items di JOIN products p ON di.product_id = p.id
       WHERE di.order_id = $1`,
      [orderId]
    );
    return res.rows;
  }

  async findItemsByOrderIds(
    orderIds: number[],
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    if (orderIds.length === 0) return [];
    const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');
    const res = await this.q(queryable).query(
      `SELECT di.*, p.name as product_name, p.price as product_price
       FROM delivery_items di JOIN products p ON di.product_id = p.id
       WHERE di.order_id IN (${placeholders})`,
      orderIds
    );
    return res.rows;
  }

  async createOrder(data: Record<string, any>, queryable: Queryable): Promise<Record<string, any>> {
    const res = await queryable.query(
      `INSERT INTO delivery_orders (order_number, customer_name, phone, address, notes, customer_id, estimated_delivery, shipping_company_id, tracking_number, shipping_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.order_number,
        data.customer_name,
        data.phone,
        data.address,
        data.notes || null,
        data.customer_id,
        data.estimated_delivery,
        data.shipping_company_id || null,
        data.tracking_number || null,
        data.shipping_cost || 0,
      ]
    );
    return res.rows[0];
  }

  async updateOrder(
    id: number | string,
    data: Record<string, any>,
    queryable: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await queryable.query(
      `UPDATE delivery_orders SET customer_name=$1, phone=$2, address=$3, notes=$4, customer_id=$5, estimated_delivery=$6, shipping_company_id=$7, tracking_number=$8, shipping_cost=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [
        data.customer_name,
        data.phone,
        data.address,
        data.notes || null,
        data.customer_id,
        data.estimated_delivery || null,
        data.shipping_company_id || null,
        data.tracking_number || null,
        data.shipping_cost || 0,
        id,
      ]
    );
    return res.rows[0] || null;
  }

  async createDeliveryItem(
    orderId: number,
    productId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      'INSERT INTO delivery_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
      [orderId, productId, quantity]
    );
  }

  async deleteDeliveryItems(orderId: number | string, queryable: Queryable): Promise<void> {
    await queryable.query('DELETE FROM delivery_items WHERE order_id = $1', [orderId]);
  }

  async updateStatus(
    id: number | string,
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
    orderId: number | string,
    status: string,
    notes: string | null,
    changedBy: number,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO delivery_status_history (order_id, status, notes, changed_by) VALUES ($1, $2, $3, $4)`,
      [orderId, status, notes, changedBy]
    );
  }

  async getStatusHistory(
    orderId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT h.*, u.name as changed_by_name
       FROM delivery_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.order_id = $1
       ORDER BY h.created_at ASC`,
      [orderId]
    );
    return res.rows;
  }

  async getPerformance(queryable?: Queryable): Promise<Record<string, any>> {
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
    ).rows;

    return {
      totalDelivered,
      avgDeliveryDays,
      pendingCount,
      shippedCount,
      companyStats,
    };
  }

  async findCustomerById(
    customerId: number,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM customers WHERE id = $1', [
      customerId,
    ]);
    return res.rows[0] || null;
  }

  async createCustomer(
    name: string,
    phone: string,
    address?: string,
    queryable?: Queryable
  ): Promise<Record<string, any>> {
    const res = await this.q(queryable).query(
      'INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, address || null]
    );
    return res.rows[0];
  }

  async findShippingCompanyById(
    companyId: number,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM shipping_companies WHERE id = $1', [
      companyId,
    ]);
    return res.rows[0] || null;
  }
}

export const deliveryRepository = new DeliveryRepository();
