import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

// GET /api/analytics/dashboard
router.get('/dashboard', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todayRevenue = await db.query<{ revenue: number }>(
      `SELECT COALESCE(SUM(total), 0) as revenue FROM sales WHERE date(created_at) = date('now')`
    );
    const monthRevenue = await db.query<{ revenue: number }>(
      `SELECT COALESCE(SUM(total), 0) as revenue FROM sales WHERE created_at >= date('now', 'start of month')`
    );
    const totalSales = await db.query<{ count: number }>('SELECT COUNT(*) as count FROM sales');
    const pendingDeliveries = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM delivery_orders WHERE status IN ('Pending', 'Preparing', 'Out for Delivery')`
    );
    const lowStock = await db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM products WHERE stock <= min_stock'
    );

    res.json({
      success: true,
      data: {
        today_revenue: todayRevenue.rows[0].revenue,
        month_revenue: monthRevenue.rows[0].revenue,
        total_sales: totalSales.rows[0].count,
        pending_deliveries: pendingDeliveries.rows[0].count,
        low_stock_items: lowStock.rows[0].count,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/revenue
router.get('/revenue', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    let dateFilter = "created_at >= date('now', '-30 days')";
    let params: unknown[] = [];

    if (from && to) {
      dateFilter = 'created_at >= ? AND created_at <= ?';
      params = [from, to + ' 23:59:59'];
    }

    const result = await db.query(
      `SELECT date(created_at) as date, COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE ${dateFilter}
       GROUP BY date(created_at)
       ORDER BY date`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/top-products
router.get('/top-products', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    let dateFilter = "s.created_at >= date('now', '-30 days')";
    let params: unknown[] = [];

    if (from && to) {
      dateFilter = 's.created_at >= ? AND s.created_at <= ?';
      params = [from, to + ' 23:59:59'];
    }

    const result = await db.query(
      `SELECT p.name, SUM(si.quantity) as total_sold, SUM(si.quantity * si.unit_price) as total_revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       WHERE ${dateFilter}
       GROUP BY p.id, p.name
       ORDER BY total_sold DESC
       LIMIT 10`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/payment-methods
router.get('/payment-methods', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    let dateFilter = "created_at >= date('now', '-30 days')";
    let params: unknown[] = [];

    if (from && to) {
      dateFilter = 'created_at >= ? AND created_at <= ?';
      params = [from, to + ' 23:59:59'];
    }

    const result = await db.query(
      `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE ${dateFilter}
       GROUP BY payment_method
       ORDER BY count DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/orders-per-day
router.get('/orders-per-day', verifyToken, requireRole('Admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.query;
    let dateFilter = "created_at >= date('now', '-30 days')";
    let params: unknown[] = [];

    if (from && to) {
      dateFilter = 'created_at >= ? AND created_at <= ?';
      params = [from, to + ' 23:59:59'];
    }

    const result = await db.query(
      `SELECT date(created_at) as date, COUNT(*) as orders
       FROM sales
       WHERE ${dateFilter}
       GROUP BY date(created_at)
       ORDER BY date`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
