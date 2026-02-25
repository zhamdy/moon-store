import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';

const router: Router = Router();

const createLayawaySchema = z.object({
  customer_id: z.number().int().positive(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional(),
        quantity: z.number().int().positive(),
        unit_price: z.number().min(0),
      })
    )
    .min(1),
  deposit: z.number().min(0),
  due_date: z.string(),
  notes: z.string().max(500).optional(),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.string().optional(),
});

// GET /api/layaway — List layaway orders
router.get(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '25', status } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let where = '1=1';
      const params: unknown[] = [];
      if (status) {
        where += ' AND lo.status = ?';
        params.push(status);
      }

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM layaway_orders lo WHERE ${where}`,
        params
      );
      const result = await db.query(
        `SELECT lo.*, c.name as customer_name, c.phone as customer_phone, u.name as cashier_name
         FROM layaway_orders lo
         JOIN customers c ON lo.customer_id = c.id
         LEFT JOIN users u ON lo.cashier_id = u.id
         WHERE ${where}
         ORDER BY lo.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total: countResult.rows[0].total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/layaway — Create layaway
router.post(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = createLayawaySchema.parse(req.body);

      const total = parsed.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
      const balance = total - parsed.deposit;

      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        const layaway = rawDb
          .prepare(
            `INSERT INTO layaway_orders (customer_id, cashier_id, total, deposit, balance, due_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
          )
          .get(
            parsed.customer_id,
            authReq.user!.id,
            total,
            parsed.deposit,
            balance,
            parsed.due_date,
            parsed.notes || null
          ) as Record<string, any>;

        for (const item of parsed.items) {
          rawDb
            .prepare(
              'INSERT INTO layaway_items (layaway_id, product_id, variant_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)'
            )
            .run(
              layaway.id,
              item.product_id,
              item.variant_id || null,
              item.quantity,
              item.unit_price
            );

          // Reserve stock
          if (item.variant_id) {
            rawDb
              .prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
              .run(item.quantity, item.variant_id, item.quantity);
          } else {
            rawDb
              .prepare(
                "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND stock >= ?"
              )
              .run(item.quantity, item.product_id, item.quantity);
          }
        }

        // Record initial deposit payment
        if (parsed.deposit > 0) {
          rawDb
            .prepare(
              'INSERT INTO layaway_payments (layaway_id, amount, payment_method, cashier_id) VALUES (?, ?, ?, ?)'
            )
            .run(layaway.id, parsed.deposit, 'Cash', authReq.user!.id);
        }

        return layaway;
      });

      const layaway = txn();
      logAuditFromReq(req, 'create', 'layaway', layaway.id, { total, deposit: parsed.deposit });
      res.status(201).json({ success: true, data: layaway });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// GET /api/layaway/:id — Get layaway detail
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const layaway = await db.query(
        `SELECT lo.*, c.name as customer_name FROM layaway_orders lo JOIN customers c ON lo.customer_id = c.id WHERE lo.id = ?`,
        [id]
      );
      if (layaway.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Layaway not found' });
      }

      const items = await db.query(
        `SELECT li.*, p.name as product_name FROM layaway_items li JOIN products p ON li.product_id = p.id WHERE li.layaway_id = ?`,
        [id]
      );
      const payments = await db.query(
        `SELECT lp.*, u.name as cashier_name FROM layaway_payments lp LEFT JOIN users u ON lp.cashier_id = u.id WHERE lp.layaway_id = ? ORDER BY lp.created_at ASC`,
        [id]
      );

      res.json({
        success: true,
        data: { ...layaway.rows[0], items: items.rows, payments: payments.rows },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/layaway/:id/payment — Make a payment
router.post(
  '/:id/payment',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const parsed = paymentSchema.parse(req.body);

      const layaway = await db.query(
        `SELECT id, balance, status FROM layaway_orders WHERE id = ? AND status = 'active'`,
        [id]
      );
      if (layaway.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Layaway not found or not active' });
      }

      const currentBalance = layaway.rows[0].balance as number;
      const payAmount = Math.min(parsed.amount, currentBalance);
      const newBalance = currentBalance - payAmount;

      const rawDb = db.db;
      rawDb
        .prepare(
          'INSERT INTO layaway_payments (layaway_id, amount, payment_method, cashier_id) VALUES (?, ?, ?, ?)'
        )
        .run(id, payAmount, parsed.payment_method || 'Cash', authReq.user!.id);

      const newStatus = newBalance <= 0 ? 'completed' : 'active';
      rawDb
        .prepare(
          `UPDATE layaway_orders SET balance = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
        )
        .run(newBalance, newStatus, id);

      res.json({
        success: true,
        data: { balance: newBalance, status: newStatus, paid: payAmount },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// POST /api/layaway/:id/cancel — Cancel a layaway
router.post(
  '/:id/cancel',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const layaway = await db.query(
        `SELECT id FROM layaway_orders WHERE id = ? AND status = 'active'`,
        [id]
      );
      if (layaway.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Layaway not found or not active' });
      }

      // Restore stock
      const items = await db.query('SELECT * FROM layaway_items WHERE layaway_id = ?', [id]);
      const rawDb = db.db;
      for (const item of items.rows as Array<{
        variant_id: number | null;
        quantity: number;
        product_id: number;
      }>) {
        if (item.variant_id) {
          rawDb
            .prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?')
            .run(item.quantity, item.variant_id);
        } else {
          rawDb
            .prepare(
              "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?"
            )
            .run(item.quantity, item.product_id);
        }
      }

      await db.query(
        `UPDATE layaway_orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`,
        [id]
      );
      logAuditFromReq(req, 'cancel', 'layaway', Number(id));
      res.json({ success: true, data: { message: 'Layaway cancelled' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
