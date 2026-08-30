import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { OnlineOrderFilters, OnlineOrderItemRecord, OnlineOrderRecord } from './types';

export interface IOnlineOrdersRepository {
  findCustomerByPhone(phone: string, queryable?: Queryable): Promise<Record<string, any> | null>;
  createCustomer(
    name: string,
    phone: string,
    address: string,
    queryable?: Queryable
  ): Promise<Record<string, any>>;
  createOrder(orderData: Record<string, any>, queryable?: Queryable): Promise<OnlineOrderRecord>;
  createOrderItem(itemData: Record<string, any>, queryable?: Queryable): Promise<void>;
  deductStock(
    productId: number,
    variantId: number | null | undefined,
    quantity: number,
    queryable?: Queryable
  ): Promise<void>;
  restoreStock(
    productId: number,
    variantId: number | null | undefined,
    quantity: number,
    queryable?: Queryable
  ): Promise<void>;
  list(
    filters: OnlineOrderFilters,
    queryable?: Queryable
  ): Promise<{ rows: OnlineOrderRecord[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<OnlineOrderRecord | null>;
  getOrderItems(orderId: number | string, queryable?: Queryable): Promise<OnlineOrderItemRecord[]>;
  updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<OnlineOrderRecord | null>;
}

export class OnlineOrdersRepository implements IOnlineOrdersRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findCustomerByPhone(
    phone: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query<{ id: number }>(
      'SELECT * FROM customers WHERE phone = $1',
      [phone]
    );
    return res.rows[0] || null;
  }

  async createCustomer(
    name: string,
    phone: string,
    address: string,
    queryable?: Queryable
  ): Promise<Record<string, any>> {
    const res = await this.q(queryable).query<Record<string, any>>(
      'INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, address]
    );
    return res.rows[0];
  }

  async createOrder(
    orderData: Record<string, any>,
    queryable?: Queryable
  ): Promise<OnlineOrderRecord> {
    const res = await this.q(queryable).query<OnlineOrderRecord>(
      `INSERT INTO online_orders (order_number, customer_id, customer_name, customer_phone, customer_email, shipping_address, city, subtotal, shipping_fee, total, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11) RETURNING *`,
      [
        orderData.order_number,
        orderData.customer_id,
        orderData.customer_name,
        orderData.customer_phone,
        orderData.customer_email || null,
        orderData.shipping_address,
        orderData.city,
        orderData.subtotal,
        orderData.shipping_fee,
        orderData.total,
        orderData.notes || null,
      ]
    );
    return res.rows[0];
  }

  async createOrderItem(itemData: Record<string, any>, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO online_order_items (order_id, product_id, variant_id, quantity, price)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        itemData.order_id,
        itemData.product_id,
        itemData.variant_id || null,
        itemData.quantity,
        itemData.price,
      ]
    );
  }

  async deductStock(
    productId: number,
    variantId: number | null | undefined,
    quantity: number,
    queryable?: Queryable
  ): Promise<void> {
    if (variantId) {
      await this.q(queryable).query(
        'UPDATE product_variants SET stock = stock - $1 WHERE id = $2',
        [quantity, variantId]
      );
    } else {
      await this.q(queryable).query(
        'UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
        [quantity, productId]
      );
    }
  }

  async restoreStock(
    productId: number,
    variantId: number | null | undefined,
    quantity: number,
    queryable?: Queryable
  ): Promise<void> {
    if (variantId) {
      await this.q(queryable).query(
        'UPDATE product_variants SET stock = stock + $1 WHERE id = $2',
        [quantity, variantId]
      );
    } else {
      await this.q(queryable).query(
        'UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
        [quantity, productId]
      );
    }
  }

  async list(
    filters: OnlineOrderFilters,
    queryable?: Queryable
  ): Promise<{ rows: OnlineOrderRecord[]; total: number }> {
    const { status, page: pageNum, pageSize: limitNum, search, sortBy, sortOrder } = filters;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumn = sortBy === 'total' ? 'o.total' : 'o.created_at';
    const offset = (pageNum - 1) * limitNum;

    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND o.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (o.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR o.customer_phone ILIKE $${params.length})`;
    }

    const countResult = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COUNT(*)::int as total FROM online_orders o ${where}`,
      params
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const orders = await this.q(queryable).query<OnlineOrderRecord>(
      `SELECT o.id, o.order_number, o.customer_id, o.customer_name, o.customer_phone, o.customer_email,
              o.phone, o.email, o.shipping_address, o.address, o.city, o.subtotal, o.shipping_fee, o.total,
              o.status, o.items, o.notes, o.created_at, o.updated_at,
              COUNT(ooi.id)::int as item_count
       FROM online_orders o
       LEFT JOIN online_order_items ooi ON ooi.order_id = o.id
       ${where}
       GROUP BY o.id, o.order_number, o.customer_id, o.customer_name, o.customer_phone, o.customer_email,
                o.phone, o.email, o.shipping_address, o.address, o.city, o.subtotal, o.shipping_fee, o.total,
                o.status, o.items, o.notes, o.created_at, o.updated_at
       ORDER BY ${sortColumn} ${direction}, o.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limitNum, offset]
    );

    return { rows: orders.rows, total };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<OnlineOrderRecord | null> {
    const res = await this.q(queryable).query<OnlineOrderRecord>(
      'SELECT * FROM online_orders WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async getOrderItems(
    orderId: number | string,
    queryable?: Queryable
  ): Promise<OnlineOrderItemRecord[]> {
    const items = await this.q(queryable).query(
      `SELECT oi.*, p.name as product_name, p.sku, p.image_url,
              pv.sku as variant_sku, pv.attributes as variant_attributes
       FROM online_order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_variants pv ON oi.variant_id = pv.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    return items.rows.map((item: any) => ({
      ...item,
      variant_attributes:
        typeof item.variant_attributes === 'string'
          ? JSON.parse(item.variant_attributes)
          : item.variant_attributes,
    }));
  }

  async updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<OnlineOrderRecord | null> {
    const res = await this.q(queryable).query<OnlineOrderRecord>(
      'UPDATE online_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    return res.rows[0] || null;
  }
}

export const onlineOrdersRepository = new OnlineOrdersRepository();
