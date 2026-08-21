import { Router, Request, Response, NextFunction } from 'express';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
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
       FROM online_orders o WHERE o.order_number = $1`,
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
        params.push(status);
        where += ` AND o.status = $${params.length}`;
      }
      const countResult = await db.query<{ total: string | number }>(
        `SELECT COUNT(*)::int as total FROM online_orders o ${where}`,
        params
      );
      const total = Number(countResult.rows[0].total);

      const limitNum = Number(limit);
      const offsetNum = offset;
      const queryParams = [...params, limitNum, offsetNum];

      const result = await db.query(
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM online_orders o LEFT JOIN customers c ON o.customer_id = c.id
       ${where} ORDER BY o.created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
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
      `SELECT o.*, c.name as customer_name FROM online_orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = $1`,
      [req.params.id]
    );
    if (order.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Order not found' });
    const items = await db.query(
      `SELECT oi.*, p.name as product_name, p.image_url FROM online_order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1`,
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

    try {
      const order = await withTransaction(async (client) => {
        let subtotal = 0;
        const resolvedItems: {
          product_id: number;
          variant_id?: number;
          quantity: number;
          unit_price: number;
          total: number;
        }[] = [];

        for (const item of items) {
          const prodRes = await client.query<{ price: number; stock: number }>(
            'SELECT price, stock FROM products WHERE id = $1',
            [item.product_id]
          );
          const product = prodRes.rows[0];
          if (!product) throw new Error(`Product ${item.product_id} not found`);
          if (product.stock < item.quantity)
            throw new Error(`Insufficient stock for product ${item.product_id}`);
          const lineTotal = Number(product.price) * item.quantity;
          subtotal += lineTotal;
          resolvedItems.push({ ...item, unit_price: Number(product.price), total: lineTotal });
        }

        const shippingConfigRes = await client.query<{ config_key: string; config_value: string }>(
          'SELECT config_key, config_value FROM storefront_config WHERE config_key IN ($1, $2, $3)',
          ['shipping_free_threshold', 'shipping_standard_rate', 'shipping_express_rate']
        );
        const configMap = new Map(
          shippingConfigRes.rows.map((r) => [r.config_key, r.config_value])
        );

        const freeThreshold = Number(configMap.get('shipping_free_threshold') || 500);
        const standardRate = Number(configMap.get('shipping_standard_rate') || 25);
        const expressRate = Number(configMap.get('shipping_express_rate') || 50);

        const shipping_cost =
          subtotal >= freeThreshold
            ? 0
            : shipping_method === 'express'
              ? expressRate
              : standardRate;
        const tax = subtotal * 0.15;
        const total = subtotal + shipping_cost + tax;
        const orderNumber = generateOrderNumber();

        const orderRes = await client.query(
          `INSERT INTO online_orders (order_number, customer_id, subtotal, shipping_cost, tax, total, payment_method, shipping_address_id, shipping_method, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [
            orderNumber,
            customer_id || null,
            subtotal,
            shipping_cost,
            tax,
            total,
            payment_method,
            shipping_address_id || null,
            shipping_method,
            notes || null,
          ]
        );
        const orderRow = orderRes.rows[0];

        for (const item of resolvedItems) {
          await client.query(
            'INSERT INTO online_order_items (order_id, product_id, variant_id, quantity, unit_price, total) VALUES ($1, $2, $3, $4, $5, $6)',
            [
              orderRow.id,
              item.product_id,
              item.variant_id || null,
              item.quantity,
              item.unit_price,
              item.total,
            ]
          );
          await client.query(
            'UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
        return orderRow;
      });

      res.status(201).json({ success: true, data: order });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ success: false, error: message });
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

      let updateFields = 'status = $1, updated_at = NOW()';
      const params: unknown[] = [status];
      if (tracking_number) {
        params.push(tracking_number);
        updateFields += `, tracking_number = $${params.length}`;
      }
      if (status === 'paid' || status === 'confirmed') {
        updateFields += ", payment_status = 'paid'";
      }
      if (status === 'cancelled') {
        // Restore stock
        const items = await db.query<{ product_id: number; quantity: number }>(
          'SELECT product_id, quantity FROM online_order_items WHERE order_id = $1',
          [req.params.id]
        );
        for (const item of items.rows) {
          await db.query(
            'UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
      }
      params.push(req.params.id);
      const result = await db.query(
        `UPDATE online_orders SET ${updateFields} WHERE id = $${params.length} RETURNING *`,
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
