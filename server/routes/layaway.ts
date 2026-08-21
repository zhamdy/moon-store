import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
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
        params.push(status);
        where += ` AND lo.status = $${params.length}`;
      }

      const countResult = await db.query<{ total: string | number }>(
        `SELECT COUNT(*)::int as total FROM layaway_orders lo WHERE ${where}`,
        params
      );

      const limitNum = Number(limit);
      const offsetNum = offset;
      const queryParams = [...params, limitNum, offsetNum];

      const result = await db.query(
        `SELECT lo.*, c.name as customer_name, c.phone as customer_phone, u.name as cashier_name
         FROM layaway_orders lo
         JOIN customers c ON lo.customer_id = c.id
         LEFT JOIN users u ON lo.cashier_id = u.id
         WHERE ${where}
         ORDER BY lo.created_at DESC
         LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
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

      const layaway = await withTransaction(async (client) => {
        const layawayRes = await client.query(
          `INSERT INTO layaway_orders (customer_id, cashier_id, total, deposit, balance, due_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            parsed.customer_id,
            authReq.user!.id,
            total,
            parsed.deposit,
            balance,
            parsed.due_date,
            parsed.notes || null,
          ]
        );
        const layawayRow = layawayRes.rows[0];

        for (const item of parsed.items) {
          await client.query(
            'INSERT INTO layaway_items (layaway_id, product_id, variant_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)',
            [
              layawayRow.id,
              item.product_id,
              item.variant_id || null,
              item.quantity,
              item.unit_price,
            ]
          );

          // Reserve stock
          if (item.variant_id) {
            const updated = await client.query(
              'UPDATE product_variants SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $3 RETURNING id',
              [item.quantity, item.variant_id, item.quantity]
            );
            if (updated.rows.length === 0) {
              throw new Error(`Insufficient stock for variant ID ${item.variant_id}`);
            }
          } else {
            const updated = await client.query(
              'UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2 AND stock >= $3 RETURNING id',
              [item.quantity, item.product_id, item.quantity]
            );
            if (updated.rows.length === 0) {
              throw new Error(`Insufficient stock for product ID ${item.product_id}`);
            }
          }
        }

        // Record initial deposit payment
        if (parsed.deposit > 0) {
          await client.query(
            'INSERT INTO layaway_payments (layaway_id, amount, payment_method, cashier_id) VALUES ($1, $2, $3, $4)',
            [layawayRow.id, parsed.deposit, 'Cash', authReq.user!.id]
          );
        }

        return layawayRow;
      });

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
        `SELECT lo.*, c.name as customer_name FROM layaway_orders lo JOIN customers c ON lo.customer_id = c.id WHERE lo.id = $1`,
        [id]
      );
      if (layaway.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Layaway not found' });
      }

      const items = await db.query(
        `SELECT li.*, p.name as product_name FROM layaway_items li JOIN products p ON li.product_id = p.id WHERE li.layaway_id = $1`,
        [id]
      );
      const payments = await db.query(
        `SELECT lp.*, u.name as cashier_name FROM layaway_payments lp LEFT JOIN users u ON lp.cashier_id = u.id WHERE lp.layaway_id = $1 ORDER BY lp.created_at ASC`,
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

      const result = await withTransaction(async (client) => {
        const layawayRes = await client.query(
          `SELECT id, balance, status FROM layaway_orders WHERE id = $1 AND status = 'active' FOR UPDATE`,
          [id]
        );
        if (layawayRes.rows.length === 0) {
          return null;
        }

        const currentBalance = Number(layawayRes.rows[0].balance);
        const payAmount = Math.min(parsed.amount, currentBalance);
        const newBalance = currentBalance - payAmount;

        await client.query(
          'INSERT INTO layaway_payments (layaway_id, amount, payment_method, cashier_id) VALUES ($1, $2, $3, $4)',
          [id, payAmount, parsed.payment_method || 'Cash', authReq.user!.id]
        );

        const newStatus = newBalance <= 0 ? 'completed' : 'active';
        await client.query(
          `UPDATE layaway_orders SET balance = $1, status = $2, updated_at = NOW() WHERE id = $3`,
          [newBalance, newStatus, id]
        );

        return { balance: newBalance, status: newStatus, paid: payAmount };
      });

      if (!result) {
        return res.status(404).json({ success: false, error: 'Layaway not found or not active' });
      }

      res.json({
        success: true,
        data: result,
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

      const result = await withTransaction(async (client) => {
        const layawayRes = await client.query(
          `SELECT id FROM layaway_orders WHERE id = $1 AND status = 'active' FOR UPDATE`,
          [id]
        );
        if (layawayRes.rows.length === 0) {
          return false;
        }

        // Restore stock
        const itemsRes = await client.query('SELECT * FROM layaway_items WHERE layaway_id = $1', [
          id,
        ]);
        for (const item of itemsRes.rows as Array<{
          variant_id: number | null;
          quantity: number;
          product_id: number;
        }>) {
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

        await client.query(
          `UPDATE layaway_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
          [id]
        );
        return true;
      });

      if (!result) {
        return res.status(404).json({ success: false, error: 'Layaway not found or not active' });
      }

      logAuditFromReq(req, 'cancel', 'layaway', Number(id));
      res.json({ success: true, data: { message: 'Layaway cancelled' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
