import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

// GET /api/analytics/dashboard
router.get(
  '/dashboard',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const todayRevenue = await db.query<{ revenue: number }>(
        `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue FROM sales WHERE date(created_at) = date('now')`
      );
      const monthRevenue = await db.query<{ revenue: number }>(
        `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue FROM sales WHERE created_at >= date('now', 'start of month')`
      );
      const totalSales = await db.query<{ count: number }>('SELECT COUNT(*) as count FROM sales');
      const pendingDeliveries = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM delivery_orders WHERE status IN ('Order Received', 'Shipping Contacted', 'In Transit')`
      );
      const lowStock = await db.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND status = 'active'"
      );

      // Gross profit = revenue - cost of goods sold
      const monthProfit = await db.query<{ profit: number }>(
        `SELECT COALESCE(SUM((si.unit_price - si.cost_price) * si.quantity), 0) as profit
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.created_at >= date('now', 'start of month')`
      );

      res.json({
        success: true,
        data: {
          today_revenue: todayRevenue.rows[0].revenue,
          month_revenue: monthRevenue.rows[0].revenue,
          month_profit: monthProfit.rows[0].profit,
          total_sales: totalSales.rows[0].count,
          pending_deliveries: pendingDeliveries.rows[0].count,
          low_stock_items: lowStock.rows[0].count,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/revenue
router.get(
  '/revenue',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

// GET /api/analytics/top-products
router.get(
  '/top-products',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

// GET /api/analytics/payment-methods
router.get(
  '/payment-methods',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

// GET /api/analytics/orders-per-day
router.get(
  '/orders-per-day',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

// GET /api/analytics/cashier-performance
router.get(
  '/cashier-performance',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      let dateFilter = "s.created_at >= date('now', '-30 days')";
      let params: unknown[] = [];

      if (from && to) {
        dateFilter = 's.created_at >= ? AND s.created_at <= ?';
        params = [from, to + ' 23:59:59'];
      }

      const result = await db.query(
        `SELECT u.id as cashier_id, u.name as cashier_name,
                COUNT(s.id) as total_sales,
                COALESCE(SUM(s.total - COALESCE(s.refunded_amount, 0)), 0) as total_revenue,
                ROUND(COALESCE(AVG(s.total), 0), 2) as avg_order_value,
                COALESCE(SUM(
                  (SELECT SUM(si.quantity) FROM sale_items si WHERE si.sale_id = s.id)
                ), 0) as total_items
         FROM sales s
         JOIN users u ON s.cashier_id = u.id
         WHERE ${dateFilter}
         GROUP BY u.id, u.name
         ORDER BY total_revenue DESC`,
        params
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/sales-by-category
router.get(
  '/sales-by-category',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      let dateFilter = "s.created_at >= date('now', '-30 days')";
      let params: unknown[] = [];

      if (from && to) {
        dateFilter = 's.created_at >= ? AND s.created_at <= ?';
        params = [from, to + ' 23:59:59'];
      }

      const result = await db.query(
        `SELECT COALESCE(c.name, p.category, 'Uncategorized') as category_name,
                SUM(si.quantity) as total_sold,
                COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN products p ON si.product_id = p.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE ${dateFilter}
         GROUP BY category_name
         ORDER BY revenue DESC`,
        params
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/sales-by-distributor
router.get(
  '/sales-by-distributor',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      let dateFilter = "s.created_at >= date('now', '-30 days')";
      let params: unknown[] = [];

      if (from && to) {
        dateFilter = 's.created_at >= ? AND s.created_at <= ?';
        params = [from, to + ' 23:59:59'];
      }

      const result = await db.query(
        `SELECT COALESCE(d.name, 'No Distributor') as distributor_name,
                SUM(si.quantity) as total_sold,
                COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN products p ON si.product_id = p.id
         LEFT JOIN distributors d ON p.distributor_id = d.id
         WHERE ${dateFilter}
         GROUP BY distributor_name
         ORDER BY revenue DESC`,
        params
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/abc-classification — ABC/Pareto analysis
router.get(
  '/abc-classification',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Rank products by revenue contribution over last 90 days
      const result = await db.query(
        `SELECT p.id, p.name, p.sku, p.stock, p.price, p.abc_class,
                COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue,
                COALESCE(SUM(si.quantity), 0) as units_sold
         FROM products p
         LEFT JOIN sale_items si ON si.product_id = p.id
         LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= date('now', '-90 days')
         WHERE p.status = 'active'
         GROUP BY p.id
         ORDER BY revenue DESC`
      );

      const products = result.rows as any[];
      const totalRevenue = products.reduce((sum: number, p: any) => sum + p.revenue, 0);

      // Calculate cumulative percentages and assign ABC
      let cumulative = 0;
      const rawDb = db.db;
      const updateStmt = rawDb.prepare('UPDATE products SET abc_class = ? WHERE id = ?');

      for (const product of products) {
        cumulative += product.revenue;
        const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 100;
        let newClass = 'C';
        if (pct <= 80) newClass = 'A';
        else if (pct <= 95) newClass = 'B';

        if (product.abc_class !== newClass) {
          updateStmt.run(newClass, product.id);
        }
        product.abc_class = newClass;
        product.revenue_pct =
          totalRevenue > 0 ? Math.round((product.revenue / totalRevenue) * 10000) / 100 : 0;
        product.cumulative_pct = Math.round(pct * 100) / 100;
      }

      res.json({
        success: true,
        data: {
          products,
          summary: {
            total_revenue: totalRevenue,
            a_count: products.filter((p: any) => p.abc_class === 'A').length,
            b_count: products.filter((p: any) => p.abc_class === 'B').length,
            c_count: products.filter((p: any) => p.abc_class === 'C').length,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/reorder-suggestions — Auto reorder point suggestions
router.get(
  '/reorder-suggestions',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Products below reorder point based on sales velocity
      const result = await db.query(
        `SELECT p.id, p.name, p.sku, p.stock, p.min_stock, p.price, p.cost_price,
                p.lead_time_days, p.reorder_qty,
                COALESCE(
                  (SELECT SUM(si.quantity) FROM sale_items si
                   JOIN sales s ON si.sale_id = s.id
                   WHERE si.product_id = p.id AND s.created_at >= date('now', '-30 days')),
                  0
                ) as sold_last_30d
         FROM products p
         WHERE p.status = 'active' AND p.stock <= p.min_stock
         ORDER BY p.stock ASC`
      );

      const suggestions = (result.rows as any[]).map((p: any) => {
        const dailyVelocity = p.sold_last_30d / 30;
        const daysOfStock = dailyVelocity > 0 ? Math.round(p.stock / dailyVelocity) : 999;
        const suggestedQty =
          p.reorder_qty > 0
            ? p.reorder_qty
            : Math.max(Math.ceil(dailyVelocity * (p.lead_time_days + 14)), p.min_stock * 2);

        return {
          ...p,
          daily_velocity: Math.round(dailyVelocity * 100) / 100,
          days_of_stock: daysOfStock,
          suggested_qty: suggestedQty,
          estimated_cost: suggestedQty * (p.cost_price || 0),
        };
      });

      res.json({ success: true, data: suggestions });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/analytics/inventory-snapshot — Create inventory snapshot
router.post(
  '/inventory-snapshot',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rawDb = db.db;
      const products = rawDb
        .prepare(`SELECT id, stock, cost_price, price FROM products WHERE status = 'active'`)
        .all() as Array<{ id: number; stock: number; cost_price: number; price: number }>;

      const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
      const totalCostValue = products.reduce((sum, p) => sum + p.stock * (p.cost_price || 0), 0);
      const totalRetailValue = products.reduce((sum, p) => sum + p.stock * p.price, 0);

      const snapshot = rawDb
        .prepare(
          `INSERT INTO inventory_snapshots (total_products, total_units, total_cost_value, total_retail_value, snapshot_data)
         VALUES (?, ?, ?, ?, ?) RETURNING *`
        )
        .get(
          products.length,
          totalUnits,
          Math.round(totalCostValue * 100) / 100,
          Math.round(totalRetailValue * 100) / 100,
          JSON.stringify(
            products.map((p) => ({ id: p.id, stock: p.stock, cost: p.cost_price, price: p.price }))
          )
        );

      res.status(201).json({ success: true, data: snapshot });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/inventory-snapshots — List snapshots
router.get(
  '/inventory-snapshots',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT id, total_products, total_units, total_cost_value, total_retail_value, created_at
         FROM inventory_snapshots ORDER BY created_at DESC LIMIT 30`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
