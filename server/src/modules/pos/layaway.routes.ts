import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { withTransaction } from '../../database/transaction';
import { verifyToken, requireRole, AuthRequest } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const createLayawaySchema = z.object({
  customer_id: z.number().int().positive(),
  total_amount: z.number().positive(),
  deposit_amount: z.number().positive(),
  payment_method: z.enum(['cash', 'card']).default('cash'),
  due_date: z.string(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().min(0),
      })
    )
    .min(1),
});

const installmentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.enum(['cash', 'card']).default('cash'),
  notes: z.string().max(255).optional(),
});

function generatePlanNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `LAY-${y}${m}${d}-${rand}`;
}

// POST /api/layaway
router.post(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = createLayawaySchema.parse(req.body);

      if (parsed.deposit_amount >= parsed.total_amount) {
        return res
          .status(400)
          .json({ success: false, error: 'Deposit cannot equal or exceed total amount' });
      }

      const planNumber = generatePlanNumber();
      const remainingBalance = parsed.total_amount - parsed.deposit_amount;

      const result = await withTransaction(async (client) => {
        // Create plan
        const planResult = await client.query(
          `INSERT INTO layaway_plans (plan_number, customer_id, total_amount, deposit_amount, remaining_balance, due_date, status, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8) RETURNING *`,
          [
            planNumber,
            parsed.customer_id,
            parsed.total_amount,
            parsed.deposit_amount,
            remainingBalance,
            parsed.due_date,
            parsed.notes || null,
            authReq.user!.id,
          ]
        );
        const plan = planResult.rows[0];

        // Insert items and hold inventory
        for (const item of parsed.items) {
          await client.query(
            `INSERT INTO layaway_items (plan_id, product_id, variant_id, quantity, price)
             VALUES ($1, $2, $3, $4, $5)`,
            [plan.id, item.product_id, item.variant_id || null, item.quantity, item.price]
          );

          // Deduct stock for held layaway items
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

        // Record deposit payment
        await client.query(
          `INSERT INTO layaway_payments (plan_id, amount, payment_method, notes, cashier_id)
           VALUES ($1, $2, $3, 'Initial deposit', $4)`,
          [plan.id, parsed.deposit_amount, parsed.payment_method, authReq.user!.id]
        );

        return plan;
      });

      logAuditFromReq(req, 'create', 'layaway', result.id as number, { plan_number: planNumber });
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// GET /api/layaway
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '20', search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND lp.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (lp.plan_number ILIKE $${params.length} OR c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
    }

    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM layaway_plans lp
         JOIN customers c ON lp.customer_id = c.id
         ${where}`,
      params
    );

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const plans = await db.query(
      `SELECT lp.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
         FROM layaway_plans lp
         JOIN customers c ON lp.customer_id = c.id
         JOIN users u ON lp.created_by = u.id
         ${where}
         ORDER BY lp.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: plans.rows,
      meta: {
        total: Number(countResult.rows[0]?.total || 0),
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/layaway/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const plan = await db.query(
      `SELECT lp.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
         FROM layaway_plans lp
         JOIN customers c ON lp.customer_id = c.id
         JOIN users u ON lp.created_by = u.id
         WHERE lp.id = $1`,
      [id]
    );

    if (plan.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Layaway plan not found' });
    }

    const items = await db.query(
      `SELECT li.*, p.name as product_name, p.sku
         FROM layaway_items li
         JOIN products p ON li.product_id = p.id
         WHERE li.plan_id = $1`,
      [id]
    );

    const payments = await db.query(
      `SELECT lp.*, u.name as cashier_name
         FROM layaway_payments lp
         JOIN users u ON lp.cashier_id = u.id
         WHERE lp.plan_id = $1
         ORDER BY lp.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...plan.rows[0],
        items: items.rows,
        payments: payments.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/layaway/:id/pay
router.post(
  '/:id/pay',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const id = Number(req.params.id);
      const parsed = installmentSchema.parse(req.body);

      const plan = (await db.query('SELECT * FROM layaway_plans WHERE id = $1', [id])).rows[0] as
        | Record<string, any>
        | undefined;
      if (!plan) {
        return res.status(404).json({ success: false, error: 'Plan not found' });
      }
      if (plan.status !== 'active') {
        return res.status(400).json({ success: false, error: 'Plan is not active' });
      }

      const remaining = Number(plan.remaining_balance);
      if (parsed.amount > remaining) {
        return res.status(400).json({
          success: false,
          error: `Payment amount exceeds remaining balance of ${remaining}`,
        });
      }

      const newRemaining = remaining - parsed.amount;
      const isCompleted = newRemaining <= 0;

      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO layaway_payments (plan_id, amount, payment_method, notes, cashier_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, parsed.amount, parsed.payment_method, parsed.notes || null, authReq.user!.id]
        );

        await client.query(
          `UPDATE layaway_plans SET
            remaining_balance = $1,
            status = $2,
            updated_at = NOW()
           WHERE id = $3`,
          [newRemaining, isCompleted ? 'completed' : 'active', id]
        );
      });

      logAuditFromReq(req, 'payment', 'layaway', id, {
        amount: parsed.amount,
        remaining: newRemaining,
        completed: isCompleted,
      });

      res.json({
        success: true,
        data: { remaining_balance: newRemaining, status: isCompleted ? 'completed' : 'active' },
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// POST /api/layaway/:id/cancel
router.post(
  '/:id/cancel',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      const plan = (await db.query('SELECT * FROM layaway_plans WHERE id = $1', [id])).rows[0] as
        | Record<string, any>
        | undefined;
      if (!plan) {
        return res.status(404).json({ success: false, error: 'Plan not found' });
      }
      if (plan.status !== 'active') {
        return res
          .status(400)
          .json({ success: false, error: 'Only active plans can be cancelled' });
      }

      await withTransaction(async (client) => {
        // Return held items to stock
        const items = await client.query('SELECT * FROM layaway_items WHERE plan_id = $1', [id]);
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
          "UPDATE layaway_plans SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
          [id]
        );
      });

      logAuditFromReq(req, 'cancel', 'layaway', id);
      res.json({ success: true, data: { status: 'cancelled' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
