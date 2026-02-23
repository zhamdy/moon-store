import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { deliverySchema, statusUpdateSchema } from '../validators/deliverySchema';
import { sendSMS, sendWhatsApp } from '../services/twilio';

const router: Router = Router();

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `DEL-${y}${m}${d}-${rand}`;
}

// GET /api/delivery
router.get('/', verifyToken, requireRole('Admin', 'Delivery'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { page = 1, limit = 25, status, search } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const where: string[] = [];
    const params: unknown[] = [];

    if (authReq.user!.role === 'Delivery') {
      where.push(`d.assigned_to = ?`);
      params.push(authReq.user!.id);
    }
    if (status && status !== 'All') {
      where.push(`d.status = ?`);
      params.push(status);
    }
    if (search) {
      where.push(`(d.customer_name LIKE ? OR d.order_number LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM delivery_orders d ${whereClause}`, params
    );
    const total = countResult.rows[0].count;

    // Get orders
    const orders = (await db.query(
      `SELECT d.*, u.name as assigned_name
       FROM delivery_orders d
       LEFT JOIN users u ON d.assigned_to = u.id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    )).rows as Record<string, any>[];

    // Fetch items for each order
    for (const order of orders) {
      const items = (await db.query(
        `SELECT di.*, p.name as product_name, p.price as product_price
         FROM delivery_items di JOIN products p ON di.product_id = p.id
         WHERE di.order_id = ?`,
        [order.id]
      )).rows;
      order.items = items;
    }

    res.json({
      success: true,
      data: orders,
      meta: { total, page: pageNum, limit: limitNum },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/delivery/:id
router.get('/:id', verifyToken, requireRole('Admin', 'Delivery'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.name as assigned_name
       FROM delivery_orders d LEFT JOIN users u ON d.assigned_to = u.id
       WHERE d.id = ?`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delivery order not found' });
    }

    const items = (await db.query(
      `SELECT di.*, p.name as product_name, p.price as product_price
       FROM delivery_items di JOIN products p ON di.product_id = p.id
       WHERE di.order_id = ?`,
      [req.params.id]
    )).rows;

    res.json({ success: true, data: { ...result.rows[0], items } });
  } catch (err) {
    next(err);
  }
});

// POST /api/delivery
router.post('/', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = deliverySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { customer_id, customer_name, phone, address, notes, items, assigned_to } = parsed.data;
    const order_number = generateOrderNumber();

    const rawDb = db.db;
    const txn = rawDb.transaction(() => {
      let resolvedCustomerId: number | null = customer_id || null;

      if (resolvedCustomerId) {
        // Fetch existing customer to verify it exists
        const existing = rawDb.prepare('SELECT id FROM customers WHERE id = ?').get(resolvedCustomerId) as Record<string, any> | undefined;
        if (!existing) {
          throw new Error('Customer not found');
        }
      } else {
        // Auto-create customer from provided name/phone/address
        const newCustomer = rawDb.prepare(
          'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?) RETURNING *'
        ).get(customer_name, phone, address || null) as Record<string, any>;
        resolvedCustomerId = newCustomer.id as number;
      }

      const order = rawDb.prepare(
        `INSERT INTO delivery_orders (order_number, customer_name, phone, address, notes, assigned_to, customer_id)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
      ).get(order_number, customer_name, phone, address, notes || null, assigned_to || null, resolvedCustomerId) as Record<string, any>;

      for (const item of items) {
        rawDb.prepare(
          'INSERT INTO delivery_items (order_id, product_id, quantity) VALUES (?, ?, ?)'
        ).run(order.id, item.product_id, item.quantity);
      }

      return order;
    });

    try {
      const order = txn();
      res.status(201).json({ success: true, data: order });
    } catch (err: any) {
      if (err.message === 'Customer not found') {
        return res.status(400).json({ success: false, error: 'Customer not found' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// PUT /api/delivery/:id
router.put('/:id', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = deliverySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { customer_id, customer_name, phone, address, notes, items, assigned_to } = parsed.data;

    const rawDb = db.db;
    const txn = rawDb.transaction(() => {
      let resolvedCustomerId: number | null = customer_id || null;

      if (resolvedCustomerId) {
        const existing = rawDb.prepare('SELECT id FROM customers WHERE id = ?').get(resolvedCustomerId) as Record<string, any> | undefined;
        if (!existing) {
          throw new Error('Customer not found');
        }
      } else {
        const newCustomer = rawDb.prepare(
          'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?) RETURNING *'
        ).get(customer_name, phone, address || null) as Record<string, any>;
        resolvedCustomerId = newCustomer.id as number;
      }

      const order = rawDb.prepare(
        `UPDATE delivery_orders SET customer_name=?, phone=?, address=?, notes=?, assigned_to=?, customer_id=?, updated_at=datetime('now')
         WHERE id=? RETURNING *`
      ).get(customer_name, phone, address, notes || null, assigned_to || null, resolvedCustomerId, req.params.id) as Record<string, any> | undefined;

      if (!order) throw new Error('Order not found');

      rawDb.prepare('DELETE FROM delivery_items WHERE order_id = ?').run(req.params.id);
      for (const item of items) {
        rawDb.prepare(
          'INSERT INTO delivery_items (order_id, product_id, quantity) VALUES (?, ?, ?)'
        ).run(req.params.id, item.product_id, item.quantity);
      }

      return order;
    });

    try {
      const order = txn();
      res.json({ success: true, data: order });
    } catch (err: any) {
      if (err.message === 'Order not found') {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// PUT /api/delivery/:id/status
router.put('/:id/status', verifyToken, requireRole('Admin', 'Delivery'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = statusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { status } = parsed.data;

    const result = await db.query(
      `UPDATE delivery_orders SET status=?, updated_at=datetime('now') WHERE id=? RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = result.rows[0] as Record<string, any>;

    if (status === 'Out for Delivery') {
      const msg = `Hi ${order.customer_name}! \u{1F319} Your MOON order ${order.order_number} is on its way. Expected: 30-45 mins. Thank you!`;
      sendSMS(order.phone, msg);
      sendWhatsApp(order.phone, msg);
    } else if (status === 'Delivered') {
      const msg = `Hi ${order.customer_name}! Your MOON order ${order.order_number} has been delivered. Thank you for shopping with us! \u{1F319}`;
      sendSMS(order.phone, msg);
      sendWhatsApp(order.phone, msg);
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

export default router;
