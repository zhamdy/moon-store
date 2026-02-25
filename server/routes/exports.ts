import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router: Router = Router();

const exportSchema = z.object({
  module: z.enum(['products', 'sales', 'customers', 'inventory', 'deliveries']),
  format: z.enum(['csv', 'xlsx']).default('csv'),
  filters: z.record(z.string(), z.any()).optional(),
});

// GET /api/exports — List export history
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT e.*, u.name as user_name
         FROM exports e
         LEFT JOIN users u ON e.user_id = u.id
         ORDER BY e.created_at DESC
         LIMIT 50`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/exports/generate — Generate export data
router.post(
  '/generate',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = exportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const authReq = req as AuthRequest;
      const { module: mod, format, filters } = parsed.data;

      let data: Record<string, unknown>[] = [];
      let columns: string[] = [];

      switch (mod) {
        case 'products': {
          const result = await db.query(
            `SELECT p.id, p.name, p.sku, p.barcode, p.price, p.cost_price, p.stock, p.min_stock,
                    p.category, p.status, p.abc_class, p.created_at
             FROM products p ORDER BY p.name`
          );
          data = result.rows;
          columns = [
            'id',
            'name',
            'sku',
            'barcode',
            'price',
            'cost_price',
            'stock',
            'min_stock',
            'category',
            'status',
            'abc_class',
            'created_at',
          ];
          break;
        }
        case 'sales': {
          const result = await db.query(
            `SELECT s.id, s.total, s.discount, s.discount_type, s.payment_method,
                    s.tip_amount, s.notes, s.created_at,
                    u.name as cashier_name
             FROM sales s
             LEFT JOIN users u ON s.cashier_id = u.id
             ORDER BY s.created_at DESC
             LIMIT 1000`
          );
          data = result.rows;
          columns = [
            'id',
            'total',
            'discount',
            'discount_type',
            'payment_method',
            'tip_amount',
            'notes',
            'cashier_name',
            'created_at',
          ];
          break;
        }
        case 'customers': {
          const result = await db.query(
            `SELECT id, name, phone, email, loyalty_points, total_spent, visit_count, created_at
             FROM customers ORDER BY name`
          );
          data = result.rows;
          columns = [
            'id',
            'name',
            'phone',
            'email',
            'loyalty_points',
            'total_spent',
            'visit_count',
            'created_at',
          ];
          break;
        }
        case 'inventory': {
          const result = await db.query(
            `SELECT p.id, p.name, p.sku, p.barcode, p.stock, p.min_stock, p.price, p.cost_price,
                    (p.stock * p.cost_price) as stock_value,
                    p.abc_class
             FROM products p WHERE p.status = 'active' ORDER BY p.name`
          );
          data = result.rows;
          columns = [
            'id',
            'name',
            'sku',
            'barcode',
            'stock',
            'min_stock',
            'price',
            'cost_price',
            'stock_value',
            'abc_class',
          ];
          break;
        }
        case 'deliveries': {
          const result = await db.query(
            `SELECT d.id, d.order_number, d.customer_name, d.phone, d.address,
                    d.status, d.notes, d.created_at, d.updated_at,
                    u.name as assigned_to_name
             FROM delivery_orders d
             LEFT JOIN users u ON d.assigned_to = u.id
             ORDER BY d.created_at DESC
             LIMIT 1000`
          );
          data = result.rows;
          columns = [
            'id',
            'order_number',
            'customer_name',
            'phone',
            'address',
            'status',
            'notes',
            'assigned_to_name',
            'created_at',
            'updated_at',
          ];
          break;
        }
      }

      // Record the export
      const rawDb = db.db;
      rawDb
        .prepare(
          `INSERT INTO exports (module, format, record_count, user_id, filters_json) VALUES (?, ?, ?, ?, ?)`
        )
        .run(mod, format, data.length, authReq.user!.id, filters ? JSON.stringify(filters) : null);

      res.json({ success: true, data: { columns, rows: data, format, module: mod } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/exports/backup — Download database backup
router.get(
  '/backup',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const path = require('path');
      const dbPath = path.join(__dirname, '..', 'db', 'moon.db');
      res.download(dbPath, `moon-backup-${new Date().toISOString().split('T')[0]}.db`);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
