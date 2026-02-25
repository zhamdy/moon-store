import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import { z } from 'zod';
import crypto from 'crypto';

const router: Router = Router();

const orderSchema = z.object({
  customer_id: z.number().int().positive().optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  shipping_address_id: z.number().int().positive().optional(),
  shipping_method: z.enum(['standard', 'express']).default('standard'),
  payment_method: z.enum(['card', 'cash_on_delivery']).default('card'),
  notes: z.string().optional(),
});

function generateOrderNumber(): string {
  return (
    'ON-' +
    Date.now().toString(36).toUpperCase() +
    crypto.randomBytes(2).toString('hex').toUpperCase()
  );
}

// GET /api/online-orders/track/:orderNumber — public order tracking (MUST be before /:id)
router.get('/track/:orderNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT o.order_number, o.status, o.payment_status, o.total, o.shipping_method, o.tracking_number, o.created_at, o.updated_at
       FROM online_orders o WHERE o.order_number = ?`,
      [req.params.orderNumber]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/online-orders — list (admin)
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page = '1', limit = '25' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      let where = 'WHERE 1=1';
      const params: unknown[] = [];
      if (status) {
        where += ' AND o.status = ?';
        params.push(status);
      }
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM online_orders o ${where}`,
        params
      );
      const total = (countResult.rows[0] as { total: number }).total;
      const result = await db.query(
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM online_orders o LEFT JOIN customers c ON o.customer_id = c.id
       ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
      );
      res.json({
        success: true,
        data: result.rows,
        meta: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/online-orders/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await db.query(
      `SELECT o.*, c.name as customer_name FROM online_orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = ?`,
      [req.params.id]
    );
    if (order.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Order not found' });
    const items = await db.query(
      `SELECT oi.*, p.name as product_name, p.image_url FROM online_order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...order.rows[0], items: items.rows } });
  } catch (err) {
    next(err);
  }
});

// POST /api/online-orders — create order
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    const { customer_id, items, shipping_address_id, shipping_method, payment_method, notes } =
      parsed.data;
    const rawDb = db.db;

    const txn = rawDb.transaction(() => {
      let subtotal = 0;
      const resolvedItems: {
        product_id: number;
        variant_id?: number;
        quantity: number;
        unit_price: number;
        total: number;
      }[] = [];
      for (const item of items) {
        const product = rawDb
          .prepare('SELECT price, stock FROM products WHERE id = ?')
          .get(item.product_id) as { price: number; stock: number } | undefined;
        if (!product) throw new Error(`Product ${item.product_id} not found`);
        if (product.stock < item.quantity)
          throw new Error(`Insufficient stock for product ${item.product_id}`);
        const lineTotal = product.price * item.quantity;
        subtotal += lineTotal;
        resolvedItems.push({ ...item, unit_price: product.price, total: lineTotal });
      }

      const shippingConfig = rawDb.prepare(
        'SELECT config_value FROM storefront_config WHERE config_key = ?'
      );
      const freeThreshold = Number(
        (shippingConfig.get('shipping_free_threshold') as { config_value: string } | undefined)
          ?.config_value || 500
      );
      const standardRate = Number(
        (shippingConfig.get('shipping_standard_rate') as { config_value: string } | undefined)
          ?.config_value || 25
      );
      const expressRate = Number(
        (shippingConfig.get('shipping_express_rate') as { config_value: string } | undefined)
          ?.config_value || 50
      );
      const shipping_cost =
        subtotal >= freeThreshold ? 0 : shipping_method === 'express' ? expressRate : standardRate;
      const tax = subtotal * 0.15;
      const total = subtotal + shipping_cost + tax;
      const orderNumber = generateOrderNumber();

      const order = rawDb
        .prepare(
          `INSERT INTO online_orders (order_number, customer_id, subtotal, shipping_cost, tax, total, payment_method, shipping_address_id, shipping_method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
        )
        .get(
          orderNumber,
          customer_id || null,
          subtotal,
          shipping_cost,
          tax,
          total,
          payment_method,
          shipping_address_id || null,
          shipping_method,
          notes || null
        ) as { id: number; [key: string]: unknown };

      for (const item of resolvedItems) {
        rawDb
          .prepare(
            'INSERT INTO online_order_items (order_id, product_id, variant_id, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(
            order.id,
            item.product_id,
            item.variant_id || null,
            item.quantity,
            item.unit_price,
            item.total
          );
        rawDb
          .prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
          .run(item.quantity, item.product_id);
      }
      return order;
    });

    try {
      const order = txn();
      res.status(201).json({ success: true, data: order });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  } catch (err) {
    next(err);
  }
});

// PUT /api/online-orders/:id/status
router.put(
  '/:id/status',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, tracking_number } = req.body;
      const validStatuses = [
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded',
      ];
      if (!validStatuses.includes(status))
        return res.status(400).json({ success: false, error: 'Invalid status' });

      let updateFields = "status = ?, updated_at = datetime('now')";
      const params: unknown[] = [status];
      if (tracking_number) {
        updateFields += ', tracking_number = ?';
        params.push(tracking_number);
      }
      if (status === 'paid' || status === 'confirmed') {
        updateFields += ", payment_status = 'paid'";
      }
      if (status === 'cancelled') {
        // Restore stock
        const items = await db.query(
          'SELECT product_id, quantity FROM online_order_items WHERE order_id = ?',
          [req.params.id]
        );
        for (const item of items.rows as Array<{ product_id: number; quantity: number }>) {
          await db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [
            item.quantity,
            item.product_id,
          ]);
        }
      }
      params.push(req.params.id);
      const result = await db.query(
        `UPDATE online_orders SET ${updateFields} WHERE id = ? RETURNING *`,
        params
      );
      if (result.rows.length === 0)
        return res.status(404).json({ success: false, error: 'Order not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
