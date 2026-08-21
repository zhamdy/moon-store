import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { withTransaction } from '../../database/transaction';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const createOnlineOrderSchema = z.object({
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().min(1).max(30),
  customer_email: z.string().email().optional().nullable(),
  shipping_address: z.string().min(1).max(255),
  city: z.string().min(1).max(50),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    )
    .min(1),
  shipping_fee: z.number().min(0).default(0),
});

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `WEB-${y}${m}${d}-${rand}`;
}

// POST /api/online-orders — Public checkout
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createOnlineOrderSchema.parse(req.body);

    const subtotal = parsed.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + parsed.shipping_fee;
    const orderNumber = generateOrderNumber();

    const result = await withTransaction(async (client) => {
      // Find or create customer
      let customerId: number | null = null;
      const custRes = await client.query<{ id: number }>(
        'SELECT id FROM customers WHERE phone = $1',
        [parsed.customer_phone]
      );
      if (custRes.rows.length > 0) {
        customerId = custRes.rows[0].id;
      } else {
        const newCust = await client.query<{ id: number }>(
          `INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3) RETURNING id`,
          [
            parsed.customer_name,
            parsed.customer_phone,
            `${parsed.shipping_address}, ${parsed.city}`,
          ]
        );
        customerId = newCust.rows[0].id;
      }

      // Create online order
      const ordResult = await client.query(
        `INSERT INTO online_orders (order_number, customer_id, customer_name, customer_phone, customer_email, shipping_address, city, subtotal, shipping_fee, total, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11) RETURNING *`,
        [
          orderNumber,
          customerId,
          parsed.customer_name,
          parsed.customer_phone,
          parsed.customer_email || null,
          parsed.shipping_address,
          parsed.city,
          subtotal,
          parsed.shipping_fee,
          total,
          parsed.notes || null,
        ]
      );
      const order = ordResult.rows[0];

      // Insert items & reserve stock
      for (const item of parsed.items) {
        await client.query(
          `INSERT INTO online_order_items (order_id, product_id, variant_id, quantity, price)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, item.product_id, item.variant_id || null, item.quantity, item.price]
        );

        // Deduct inventory
        if (item.variant_id) {
          await client.query(`UPDATE product_variants SET stock = stock - $1 WHERE id = $2`, [
            item.quantity,
            item.variant_id,
          ]);
        } else {
          await client.query(
            `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2`,
            [item.quantity, item.product_id]
          );
        }
      }

      return order;
    });

    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// GET /api/online-orders (Admin)
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page = '1', limit = '20', search } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
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

      const countResult = await db.query<{ total: number }>(
        `SELECT COUNT(*)::int as total FROM online_orders o ${where}`,
        params
      );

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const orders = await db.query(
        `SELECT o.*,
          (SELECT COUNT(*)::int FROM online_order_items WHERE order_id = o.id) as item_count
         FROM online_orders o
         ${where}
         ORDER BY o.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, Number(limit), offset]
      );

      res.json({
        success: true,
        data: orders.rows,
        meta: {
          total: Number(countResult.rows[0]?.total || 0),
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/online-orders/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const order = await db.query('SELECT * FROM online_orders WHERE id = $1', [id]);
    if (order.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const items = await db.query(
      `SELECT oi.*, p.name as product_name, p.sku, p.image_url,
              pv.sku as variant_sku, pv.attributes as variant_attributes
       FROM online_order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_variants pv ON oi.variant_id = pv.id
       WHERE oi.order_id = $1`,
      [id]
    );

    const formattedItems = items.rows.map((item: any) => ({
      ...item,
      variant_attributes:
        typeof item.variant_attributes === 'string'
          ? JSON.parse(item.variant_attributes)
          : item.variant_attributes,
    }));

    res.json({
      success: true,
      data: {
        ...order.rows[0],
        items: formattedItems,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/online-orders/:id/status (Admin)
router.put(
  '/:id/status',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }

      const existing = await db.query('SELECT * FROM online_orders WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
      }

      const currentOrder = existing.rows[0];

      // If cancelling, restore inventory
      if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
        await withTransaction(async (client) => {
          const items = await client.query('SELECT * FROM online_order_items WHERE order_id = $1', [
            id,
          ]);
          for (const item of items.rows) {
            if (item.variant_id) {
              await client.query(`UPDATE product_variants SET stock = stock + $1 WHERE id = $2`, [
                item.quantity,
                item.variant_id,
              ]);
            } else {
              await client.query(
                `UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2`,
                [item.quantity, item.product_id]
              );
            }
          }
          await client.query(
            'UPDATE online_orders SET status = $1, updated_at = NOW() WHERE id = $2',
            [status, id]
          );
        });
      } else {
        await db.query('UPDATE online_orders SET status = $1, updated_at = NOW() WHERE id = $2', [
          status,
          id,
        ]);
      }

      logAuditFromReq(req, 'status_change', 'online_order', Number(id), { status });
      res.json({ success: true, data: { id, status } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
