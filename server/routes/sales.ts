import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { saleSchema } from '../validators/saleSchema';

const router: Router = Router();

// GET /api/sales/stats/summary  (must be before /:id)
router.get('/stats/summary', verifyToken, requireRole('Admin', 'Cashier'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = await db.query<{ revenue: number; count: number }>(
      `SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as count
       FROM sales WHERE date(created_at) = date('now')`
    );
    const month = await db.query<{ revenue: number; count: number }>(
      `SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as count
       FROM sales WHERE created_at >= date('now', 'start of month')`
    );

    res.json({
      success: true,
      data: {
        today_revenue: today.rows[0].revenue,
        today_sales: today.rows[0].count,
        month_revenue: month.rows[0].revenue,
        month_sales: month.rows[0].count,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sales
router.post('/', verifyToken, requireRole('Admin', 'Cashier'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { items, discount, discount_type, payment_method } = parsed.data;

    // Calculate total
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.unit_price * item.quantity;
    }

    let discountAmount = discount;
    if (discount_type === 'percentage') {
      discountAmount = (subtotal * discount) / 100;
    }
    const total = Math.max(0, subtotal - discountAmount);

    // Use raw db for transaction
    const rawDb = db.db;
    const txn = rawDb.transaction(() => {
      const saleResult = rawDb.prepare(
        `INSERT INTO sales (total, discount, discount_type, payment_method, cashier_id)
         VALUES (?, ?, ?, ?, ?) RETURNING *`
      ).get(total, discount, discount_type, payment_method, authReq.user!.id) as Record<string, any>;

      for (const item of items) {
        rawDb.prepare(
          'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
        ).run(saleResult.id, item.product_id, item.quantity, item.unit_price);

        const updated = rawDb.prepare(
          "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND stock >= ?"
        ).run(item.quantity, item.product_id, item.quantity);

        if (updated.changes === 0) {
          throw new Error(`Insufficient stock for product ID ${item.product_id}`);
        }
      }

      return saleResult;
    });

    let sale: Record<string, any>;
    try {
      sale = txn();
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }

    // Fetch full sale with items
    const saleItems = (await db.query(
      `SELECT si.*, p.name as product_name
       FROM sale_items si JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`,
      [sale.id]
    )).rows;

    const cashier = (await db.query<{ name: string }>('SELECT name FROM users WHERE id = ?', [authReq.user!.id])).rows[0];

    res.status(201).json({
      success: true,
      data: { ...sale, cashier_name: cashier?.name, items: saleItems },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sales
router.get('/', verifyToken, requireRole('Admin', 'Cashier'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 25, from, to, payment_method, cashier_id, search } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const where: string[] = [];
    const params: unknown[] = [];

    if (from) {
      where.push(`s.created_at >= ?`);
      params.push(from);
    }
    if (to) {
      where.push(`s.created_at <= ?`);
      params.push(to + ' 23:59:59');
    }
    if (payment_method) {
      where.push(`s.payment_method = ?`);
      params.push(payment_method);
    }
    if (cashier_id) {
      where.push(`s.cashier_id = ?`);
      params.push(cashier_id);
    }
    if (search) {
      where.push(`CAST(s.id AS TEXT) LIKE ?`);
      params.push(`%${search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM sales s ${whereClause}`, params
    );
    const total = countResult.rows[0].count;

    const revenueResult = await db.query<{ total_revenue: number }>(
      `SELECT COALESCE(SUM(total), 0) as total_revenue FROM sales s ${whereClause}`, params
    );

    const result = await db.query(
      `SELECT s.*, u.name as cashier_name,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        total_revenue: revenueResult.rows[0].total_revenue,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/:id
router.get('/:id', verifyToken, requireRole('Admin', 'Cashier'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const saleResult = await db.query(
      `SELECT s.*, u.name as cashier_name
       FROM sales s LEFT JOIN users u ON s.cashier_id = u.id
       WHERE s.id = ?`,
      [req.params.id]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Sale not found' });
    }

    const items = await db.query(
      `SELECT si.*, p.name as product_name
       FROM sale_items si JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...saleResult.rows[0], items: items.rows } });
  } catch (err) {
    next(err);
  }
});

export default router;
