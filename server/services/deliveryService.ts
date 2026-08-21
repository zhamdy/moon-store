import db from '../src/database/pool';
import { withTransaction, Queryable } from '../src/database/transaction';
import { sendSMS, sendWhatsApp } from './twilio';

// --- Types ---

export interface DeliveryOrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface DeliveryOrderInput {
  customer_id?: number | null;
  customer_name: string;
  phone: string;
  address: string;
  notes?: string | null;
  items: Array<{ product_id: number; quantity: number }>;
  estimated_delivery?: string | null;
  shipping_company_id?: number | null;
  tracking_number?: string | null;
  shipping_cost?: number | null;
}

export interface StatusUpdateInput {
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  notes?: string | null;
}

interface DeliveryListResult {
  orders: Record<string, any>[];
  meta: { total: number; page: number; limit: number };
}

interface PerformanceResult {
  totalDelivered: number;
  avgDeliveryDays: number;
  pendingCount: number;
  shippedCount: number;
  companyStats: Record<string, any>[];
}

// --- Helpers ---

export function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `DEL-${y}${m}${d}-${rand}`;
}

function resolveEstimatedDelivery(estimated_delivery?: string | null): string {
  if (estimated_delivery) return estimated_delivery;
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 16);
}

async function resolveCustomer(
  queryable: Queryable,
  customer_id: number | null | undefined,
  customer_name: string,
  phone: string,
  address?: string
): Promise<number> {
  if (customer_id) {
    const existing = await queryable.query<{ id: number }>(
      'SELECT id FROM customers WHERE id = $1',
      [customer_id]
    );
    if (existing.rows.length === 0) {
      throw new Error('Customer not found');
    }
    return customer_id;
  }

  const newCustomer = await queryable.query<{ id: number }>(
    'INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3) RETURNING id',
    [customer_name, phone, address || null]
  );
  return newCustomer.rows[0].id;
}

// --- Public API ---

export async function getDeliveryOrders(
  filters: DeliveryOrderFilters
): Promise<DeliveryListResult> {
  const { page = 1, limit = 25, status, search } = filters;
  const pageNum = Number(page);
  const limitNum = Number(limit);
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

  const countResult = await db.query<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM delivery_orders d ${whereClause}`,
    params
  );
  const total = Number(countResult.rows[0]?.count || 0);

  const queryParams = [...params, limitNum, offset];
  const limitIdx = paramIdx++;
  const offsetIdx = paramIdx++;

  const orders = (
    await db.query(
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
      await db.query(
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
    meta: { total, page: pageNum, limit: limitNum },
  };
}

export async function getDeliveryPerformance(): Promise<PerformanceResult> {
  const totalResult = await db.query<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM delivery_orders WHERE status = 'Delivered'`
  );
  const totalDelivered = Number(totalResult.rows[0]?.count || 0);

  const avgTimeResult = await db.query<{ avg_days: string | number | null }>(
    `SELECT AVG(
       EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0
     ) as avg_days
     FROM delivery_orders
     WHERE status = 'Delivered'`
  );
  const avgDeliveryDays = Math.round(Number(avgTimeResult.rows[0]?.avg_days || 0) * 10) / 10;

  const pendingResult = await db.query<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM delivery_orders WHERE status = 'Pending'`
  );
  const pendingCount = Number(pendingResult.rows[0]?.count || 0);

  const shippedResult = await db.query<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM delivery_orders WHERE status = 'Shipped'`
  );
  const shippedCount = Number(shippedResult.rows[0]?.count || 0);

  const companyStats = (
    await db.query(
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

export async function getDeliveryOrder(id: string | number): Promise<Record<string, any> | null> {
  const result = await db.query(
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
    await db.query(
      `SELECT di.*, p.name as product_name, p.price as product_price
       FROM delivery_items di JOIN products p ON di.product_id = p.id
       WHERE di.order_id = $1`,
      [id]
    )
  ).rows;

  return { ...result.rows[0], items };
}

export async function createDeliveryOrder(data: DeliveryOrderInput): Promise<Record<string, any>> {
  const {
    customer_id,
    customer_name,
    phone,
    address,
    notes,
    items,
    estimated_delivery,
    shipping_company_id,
    tracking_number,
    shipping_cost,
  } = data;

  const order_number = generateOrderNumber();
  const resolvedEstimatedDelivery = resolveEstimatedDelivery(estimated_delivery);

  return withTransaction(async (client) => {
    const resolvedCustomerId = await resolveCustomer(
      client,
      customer_id,
      customer_name,
      phone,
      address
    );

    const orderRes = await client.query<Record<string, any>>(
      `INSERT INTO delivery_orders (order_number, customer_name, phone, address, notes, customer_id, estimated_delivery, shipping_company_id, tracking_number, shipping_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        order_number,
        customer_name,
        phone,
        address,
        notes || null,
        resolvedCustomerId,
        resolvedEstimatedDelivery,
        shipping_company_id || null,
        tracking_number || null,
        shipping_cost || 0,
      ]
    );
    const order = orderRes.rows[0];

    for (const item of items) {
      await client.query(
        'INSERT INTO delivery_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
        [order.id, item.product_id, item.quantity]
      );
    }

    return order;
  });
}

export async function updateDeliveryOrder(
  id: string | number,
  data: DeliveryOrderInput
): Promise<Record<string, any>> {
  const {
    customer_id,
    customer_name,
    phone,
    address,
    notes,
    items,
    estimated_delivery,
    shipping_company_id,
    tracking_number,
    shipping_cost,
  } = data;

  return withTransaction(async (client) => {
    const resolvedCustomerId = await resolveCustomer(
      client,
      customer_id,
      customer_name,
      phone,
      address
    );

    const orderRes = await client.query<Record<string, any>>(
      `UPDATE delivery_orders SET customer_name=$1, phone=$2, address=$3, notes=$4, customer_id=$5, estimated_delivery=$6, shipping_company_id=$7, tracking_number=$8, shipping_cost=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [
        customer_name,
        phone,
        address,
        notes || null,
        resolvedCustomerId,
        estimated_delivery || null,
        shipping_company_id || null,
        tracking_number || null,
        shipping_cost || 0,
        id,
      ]
    );

    if (orderRes.rows.length === 0) throw new Error('Order not found');
    const order = orderRes.rows[0];

    await client.query('DELETE FROM delivery_items WHERE order_id = $1', [id]);
    for (const item of items) {
      await client.query(
        'INSERT INTO delivery_items (order_id, product_id, quantity) VALUES ($1, $2, $3)',
        [id, item.product_id, item.quantity]
      );
    }

    return order;
  });
}

export async function updateDeliveryStatus(
  id: string | number,
  input: StatusUpdateInput,
  userId: number
): Promise<Record<string, any> | null> {
  const { status, notes } = input;

  const result = await db.query(
    `UPDATE delivery_orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
    [status, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const order = result.rows[0] as Record<string, any>;

  await db.query(
    `INSERT INTO delivery_status_history (order_id, status, notes, changed_by) VALUES ($1, $2, $3, $4)`,
    [id, status, notes || null, userId]
  );

  if (status === 'Shipped') {
    let companyName = '';
    if (order.shipping_company_id) {
      const scResult = await db.query<{ name: string }>(
        'SELECT name FROM shipping_companies WHERE id = $1',
        [order.shipping_company_id]
      );
      if (scResult.rows.length > 0) {
        companyName = scResult.rows[0].name;
      }
    }
    const trackingInfo = order.tracking_number ? ` Tracking: ${order.tracking_number}` : '';
    const viaCompany = companyName ? ` via ${companyName}` : '';
    const msg = `Hi ${order.customer_name}! 🌙 Your MOON order ${order.order_number} has been shipped${viaCompany}.${trackingInfo} Thank you!`;
    sendSMS(order.phone, msg).catch(() => {});
    sendWhatsApp(order.phone, msg).catch(() => {});
  } else if (status === 'Delivered') {
    const msg = `Hi ${order.customer_name}! Your MOON order ${order.order_number} has been delivered. Thank you for shopping with us! 🌙`;
    sendSMS(order.phone, msg).catch(() => {});
    sendWhatsApp(order.phone, msg).catch(() => {});
  }

  return order;
}

export async function getOrderStatusHistory(id: string | number): Promise<Record<string, any>[]> {
  const result = await db.query(
    `SELECT h.*, u.name as changed_by_name
     FROM delivery_status_history h
     LEFT JOIN users u ON h.changed_by = u.id
     WHERE h.order_id = $1
     ORDER BY h.created_at ASC`,
    [id]
  );
  return result.rows as Record<string, any>[];
}
