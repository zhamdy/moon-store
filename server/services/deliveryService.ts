import db from '../db';
import type Database from 'better-sqlite3';
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

function resolveCustomer(
  rawDb: Database.Database,
  customer_id: number | null | undefined,
  customer_name: string,
  phone: string,
  address?: string
): number {
  if (customer_id) {
    const existing = rawDb.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id) as
      | Record<string, any>
      | undefined;
    if (!existing) {
      throw new Error('Customer not found');
    }
    return customer_id;
  }

  const newCustomer = rawDb
    .prepare('INSERT INTO customers (name, phone, address) VALUES (?, ?, ?) RETURNING *')
    .get(customer_name, phone, address || null) as Record<string, any>;
  return newCustomer.id as number;
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

  if (status && status !== 'All') {
    where.push(`d.status = ?`);
    params.push(status);
  }
  if (search) {
    where.push(`(d.customer_name LIKE ? OR d.order_number LIKE ? OR d.tracking_number LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countResult = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM delivery_orders d ${whereClause}`,
    params
  );
  const total = countResult.rows[0].count;

  // Get orders with shipping company name
  const orders = (
    await db.query(
      `SELECT d.*, sc.name as shipping_company_name
       FROM delivery_orders d
       LEFT JOIN shipping_companies sc ON d.shipping_company_id = sc.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    )
  ).rows as Record<string, any>[];

  // Batch-fetch items for all orders in a single query
  if (orders.length > 0) {
    const orderIds = orders.map((o) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');
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
  const totalResult = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM delivery_orders WHERE status = 'Delivered'`
  );
  const totalDelivered = totalResult.rows[0].count;

  const avgTimeResult = await db.query<{ avg_days: number | null }>(
    `SELECT AVG(
       julianday(updated_at) - julianday(created_at)
     ) as avg_days
     FROM delivery_orders
     WHERE status = 'Delivered'`
  );
  const avgDeliveryDays = Math.round((avgTimeResult.rows[0].avg_days || 0) * 10) / 10;

  const pendingResult = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM delivery_orders WHERE status = 'Pending'`
  );
  const pendingCount = pendingResult.rows[0].count;

  const shippedResult = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM delivery_orders WHERE status = 'Shipped'`
  );
  const shippedCount = shippedResult.rows[0].count;

  const companyStats = (
    await db.query(
      `SELECT sc.id, sc.name,
       COUNT(*) as total_orders,
       SUM(CASE WHEN d.status = 'Delivered' THEN 1 ELSE 0 END) as delivered,
       SUM(CASE WHEN d.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
       ROUND(AVG(CASE WHEN d.status = 'Delivered' THEN julianday(d.updated_at) - julianday(d.created_at) END), 1) as avg_days
     FROM delivery_orders d
     JOIN shipping_companies sc ON d.shipping_company_id = sc.id
     GROUP BY sc.id
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
     WHERE d.id = ?`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const items = (
    await db.query(
      `SELECT di.*, p.name as product_name, p.price as product_price
       FROM delivery_items di JOIN products p ON di.product_id = p.id
       WHERE di.order_id = ?`,
      [id]
    )
  ).rows;

  return { ...result.rows[0], items };
}

export function createDeliveryOrder(data: DeliveryOrderInput): Record<string, any> {
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

  const rawDb = db.db;
  const txn = rawDb.transaction(() => {
    const resolvedCustomerId = resolveCustomer(rawDb, customer_id, customer_name, phone, address);

    const order = rawDb
      .prepare(
        `INSERT INTO delivery_orders (order_number, customer_name, phone, address, notes, customer_id, estimated_delivery, shipping_company_id, tracking_number, shipping_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
      )
      .get(
        order_number,
        customer_name,
        phone,
        address,
        notes || null,
        resolvedCustomerId,
        resolvedEstimatedDelivery,
        shipping_company_id || null,
        tracking_number || null,
        shipping_cost || 0
      ) as Record<string, any>;

    for (const item of items) {
      rawDb
        .prepare('INSERT INTO delivery_items (order_id, product_id, quantity) VALUES (?, ?, ?)')
        .run(order.id, item.product_id, item.quantity);
    }

    return order;
  });

  return txn();
}

export function updateDeliveryOrder(
  id: string | number,
  data: DeliveryOrderInput
): Record<string, any> {
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

  const rawDb = db.db;
  const txn = rawDb.transaction(() => {
    const resolvedCustomerId = resolveCustomer(rawDb, customer_id, customer_name, phone, address);

    const order = rawDb
      .prepare(
        `UPDATE delivery_orders SET customer_name=?, phone=?, address=?, notes=?, customer_id=?, estimated_delivery=?, shipping_company_id=?, tracking_number=?, shipping_cost=?, updated_at=datetime('now')
         WHERE id=? RETURNING *`
      )
      .get(
        customer_name,
        phone,
        address,
        notes || null,
        resolvedCustomerId,
        estimated_delivery || null,
        shipping_company_id || null,
        tracking_number || null,
        shipping_cost || 0,
        id
      ) as Record<string, any> | undefined;

    if (!order) throw new Error('Order not found');

    rawDb.prepare('DELETE FROM delivery_items WHERE order_id = ?').run(id);
    for (const item of items) {
      rawDb
        .prepare('INSERT INTO delivery_items (order_id, product_id, quantity) VALUES (?, ?, ?)')
        .run(id, item.product_id, item.quantity);
    }

    return order;
  });

  return txn();
}

export async function updateDeliveryStatus(
  id: string | number,
  input: StatusUpdateInput,
  userId: number
): Promise<Record<string, any> | null> {
  const { status, notes } = input;

  const result = await db.query(
    `UPDATE delivery_orders SET status=?, updated_at=datetime('now') WHERE id=? RETURNING *`,
    [status, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const order = result.rows[0] as Record<string, any>;

  // Log status change to history
  db.db
    .prepare(
      `INSERT INTO delivery_status_history (order_id, status, notes, changed_by) VALUES (?, ?, ?, ?)`
    )
    .run(id, status, notes || null, userId);

  // Send notifications for shipped/delivered statuses
  if (status === 'Shipped') {
    // Get shipping company name for the SMS
    let companyName = '';
    if (order.shipping_company_id) {
      const scResult = await db.query('SELECT name FROM shipping_companies WHERE id = ?', [
        order.shipping_company_id,
      ]);
      if (scResult.rows.length > 0) {
        companyName = (scResult.rows[0] as Record<string, any>).name;
      }
    }
    const trackingInfo = order.tracking_number ? ` Tracking: ${order.tracking_number}` : '';
    const viaCompany = companyName ? ` via ${companyName}` : '';
    const msg = `Hi ${order.customer_name}! \u{1F319} Your MOON order ${order.order_number} has been shipped${viaCompany}.${trackingInfo} Thank you!`;
    sendSMS(order.phone, msg).catch(() => {});
    sendWhatsApp(order.phone, msg).catch(() => {});
  } else if (status === 'Delivered') {
    const msg = `Hi ${order.customer_name}! Your MOON order ${order.order_number} has been delivered. Thank you for shopping with us! \u{1F319}`;
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
     WHERE h.order_id = ?
     ORDER BY h.created_at ASC`,
    [id]
  );
  return result.rows as Record<string, any>[];
}
