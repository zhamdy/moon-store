import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
import { verifyToken, requireRole } from '../middleware/auth';
import { customerSchema } from '../validators/customerSchema';

const router: Router = Router();

// GET /api/customers -- list with optional search + pagination
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, page = 1, limit = 50 } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const where: string[] = [];
      const params: unknown[] = [];

      if (search) {
        where.push(`(name ILIKE $${params.length + 1} OR phone ILIKE $${params.length + 2})`);
        params.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM customers ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.count || 0);

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;
      const result = await db.query(
        `SELECT * FROM customers ${whereClause} ORDER BY name ASC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, limitNum, offset]
      );
      res.json({
        success: true,
        data: result.rows,
        meta: { total, page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/customers
router.post(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, phone, address, notes } = parsed.data;

      const result = await db.query(
        `INSERT INTO customers (name, phone, address, notes) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, phone, address || null, notes || null]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/customers/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, phone, address, notes } = parsed.data;

      const result = await db.query(
        `UPDATE customers SET name = $1, phone = $2, address = $3, notes = $4, updated_at = NOW() WHERE id = $5 RETURNING *`,
        [name, phone, address || null, notes || null, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/customers/:id/stats
router.get(
  '/:id/stats',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.params.id;

      const stats = await db.query<{
        total_spent: string | number;
        order_count: number;
        avg_order: string | number;
        last_purchase: string | null;
      }>(
        `SELECT
          COALESCE(SUM(total), 0) as total_spent,
          COUNT(*)::int as order_count,
          COALESCE(AVG(total), 0) as avg_order,
          MAX(created_at) as last_purchase
         FROM sales WHERE customer_id = $1`,
        [customerId]
      );

      const statsRow = stats.rows[0];
      res.json({
        success: true,
        data: {
          total_spent: Number(statsRow?.total_spent || 0),
          order_count: Number(statsRow?.order_count || 0),
          avg_order: Number(statsRow?.avg_order || 0),
          last_purchase: statsRow?.last_purchase || null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/customers/:id/sales
router.get(
  '/:id/sales',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.params.id;
      const { page = 1, limit = 25 } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const countResult = await db.query<{ count: number }>(
        'SELECT COUNT(*)::int as count FROM sales WHERE customer_id = $1',
        [customerId]
      );

      const result = await db.query(
        `SELECT s.*, u.name as cashier_name,
         (SELECT COUNT(*)::int FROM sale_items WHERE sale_id = s.id) as items_count
         FROM sales s
         LEFT JOIN users u ON s.cashier_id = u.id
         WHERE s.customer_id = $1
         ORDER BY s.created_at DESC
         LIMIT $2 OFFSET $3`,
        [customerId, limitNum, offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total: Number(countResult.rows[0]?.count || 0), page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/customers/:id/loyalty — loyalty transaction history
router.get(
  '/:id/loyalty',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.params.id;

      // Get current points balance
      const customer = await db.query<{ loyalty_points: number }>(
        'SELECT loyalty_points FROM customers WHERE id = $1',
        [customerId]
      );
      if (customer.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }

      // Get transaction history
      const transactions = await db.query(
        `SELECT lt.*, s.total as sale_total
         FROM loyalty_transactions lt
         LEFT JOIN sales s ON lt.sale_id = s.id
         WHERE lt.customer_id = $1
         ORDER BY lt.created_at DESC
         LIMIT 100`,
        [customerId]
      );

      res.json({
        success: true,
        data: {
          points: customer.rows[0].loyalty_points,
          transactions: transactions.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/customers/:id/loyalty/adjust — manual admin adjustment
const loyaltyAdjustSchema = z.object({
  points: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Points cannot be zero'),
  note: z.string().min(1, 'Note is required'),
});

router.post(
  '/:id/loyalty/adjust',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = Number(req.params.id);
      const parsed = loyaltyAdjustSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { points, note } = parsed.data;

      let newPoints: number;
      try {
        newPoints = await withTransaction(async (client) => {
          const result = await client.query<{ loyalty_points: number }>(
            `UPDATE customers SET loyalty_points = GREATEST(0, loyalty_points + $1), updated_at = NOW() WHERE id = $2 RETURNING loyalty_points`,
            [points, customerId]
          );

          if (result.rows.length === 0) {
            throw new Error('Customer not found');
          }

          await client.query(
            `INSERT INTO loyalty_transactions (customer_id, points, type, note) VALUES ($1, $2, $3, $4)`,
            [customerId, points, 'adjustment', note]
          );

          return result.rows[0].loyalty_points;
        });
      } catch (err: any) {
        return res.status(400).json({ success: false, error: err.message });
      }

      res.json({ success: true, data: { loyalty_points: newPoints } });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/customers/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Customer not found' });
      }
      res.json({ success: true, data: { message: 'Customer deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
