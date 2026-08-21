import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';

const router: Router = Router();

const exchangeSchema = z.object({
  original_sale_id: z.number().int().positive(),
  return_items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional(),
        quantity: z.number().int().positive(),
        unit_price: z.number().min(0),
      })
    )
    .min(1),
  new_items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional(),
        quantity: z.number().int().positive(),
        unit_price: z.number().min(0),
      })
    )
    .min(1),
  payment_method: z.string().optional(),
  customer_id: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

// POST /api/exchanges — Process an exchange
router.post(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = exchangeSchema.parse(req.body);

      // Verify original sale exists
      const saleResult = await db.query('SELECT * FROM sales WHERE id = $1', [
        parsed.original_sale_id,
      ]);
      if (saleResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Original sale not found' });
      }

      const returnTotal = parsed.return_items.reduce(
        (sum, i) => sum + i.unit_price * i.quantity,
        0
      );
      const newTotal = parsed.new_items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
      const balance = newTotal - returnTotal;
      const balanceType = balance > 0 ? 'customer_pays' : balance < 0 ? 'store_refunds' : 'even';

      let exchange: Record<string, any>;
      try {
        exchange = await withTransaction(async (client) => {
          // Create exchange record
          const exchangeRes = await client.query(
            `INSERT INTO exchanges (original_sale_id, return_total, new_total, balance, balance_type, payment_method, cashier_id, customer_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
              parsed.original_sale_id,
              returnTotal,
              newTotal,
              Math.abs(balance),
              balanceType,
              parsed.payment_method || null,
              authReq.user!.id,
              parsed.customer_id || null,
              parsed.notes || null,
            ]
          );
          const ex = exchangeRes.rows[0];

          // Record return items and restock
          for (const item of parsed.return_items) {
            await client.query(
              'INSERT INTO exchange_return_items (exchange_id, product_id, variant_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)',
              [ex.id, item.product_id, item.variant_id || null, item.quantity, item.unit_price]
            );

            // Restock
            if (item.variant_id) {
              await client.query(
                'UPDATE product_variants SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
                [item.quantity, item.variant_id]
              );
            } else {
              await client.query(
                'UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
                [item.quantity, item.product_id]
              );
            }
          }

          // Record new items and deduct stock
          for (const item of parsed.new_items) {
            await client.query(
              'INSERT INTO exchange_new_items (exchange_id, product_id, variant_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)',
              [ex.id, item.product_id, item.variant_id || null, item.quantity, item.unit_price]
            );

            // Deduct stock
            if (item.variant_id) {
              const updated = await client.query(
                'UPDATE product_variants SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $3 RETURNING id',
                [item.quantity, item.variant_id, item.quantity]
              );
              if (updated.rows.length === 0)
                throw new Error(`Insufficient stock for variant ID ${item.variant_id}`);
            } else {
              const updated = await client.query(
                'UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $3 RETURNING id',
                [item.quantity, item.product_id, item.quantity]
              );
              if (updated.rows.length === 0)
                throw new Error(`Insufficient stock for product ID ${item.product_id}`);
            }
          }

          return ex;
        });
      } catch (err: any) {
        return res.status(400).json({ success: false, error: err.message });
      }

      logAuditFromReq(req, 'exchange', 'sale', parsed.original_sale_id, {
        exchange_id: exchange.id,
        return_total: returnTotal,
        new_total: newTotal,
        balance,
      });

      res.status(201).json({
        success: true,
        data: { ...exchange, return_items: parsed.return_items, new_items: parsed.new_items },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// GET /api/exchanges — List exchanges
router.get(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '25' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const countResult = await db.query<{ total: string | number }>(
        'SELECT COUNT(*)::int as total FROM exchanges'
      );
      const result = await db.query(
        `SELECT e.*, u.name as cashier_name, c.name as customer_name
         FROM exchanges e
         LEFT JOIN users u ON e.cashier_id = u.id
         LEFT JOIN customers c ON e.customer_id = c.id
         ORDER BY e.created_at DESC
         LIMIT $1 OFFSET $2`,
        [Number(limit), offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: {
          total: Number(countResult.rows[0].total),
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/exchanges/:id — Get exchange details
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const exchange = await db.query(
        `SELECT e.*, u.name as cashier_name FROM exchanges e LEFT JOIN users u ON e.cashier_id = u.id WHERE e.id = $1`,
        [id]
      );
      if (exchange.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Exchange not found' });
      }

      const returnItems = await db.query(
        `SELECT eri.*, p.name as product_name FROM exchange_return_items eri JOIN products p ON eri.product_id = p.id WHERE eri.exchange_id = $1`,
        [id]
      );
      const newItems = await db.query(
        `SELECT eni.*, p.name as product_name FROM exchange_new_items eni JOIN products p ON eni.product_id = p.id WHERE eni.exchange_id = $1`,
        [id]
      );

      res.json({
        success: true,
        data: { ...exchange.rows[0], return_items: returnItems.rows, new_items: newItems.rows },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
