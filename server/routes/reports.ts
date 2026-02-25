import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router: Router = Router();

const reportSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  report_type: z.enum(['sales', 'inventory', 'customers', 'financial', 'custom']),
  config: z.string(),
  chart_type: z.enum(['table', 'bar', 'line', 'pie', 'area']).default('table'),
  is_public: z.boolean().default(false),
});

const scheduleSchema = z.object({
  report_id: z.number().int().positive(),
  schedule: z.enum(['daily', 'weekly', 'monthly']),
  recipients: z.string(),
});

// POST /api/reports/quick — run a quick ad-hoc report (MUST be before /:id)
router.post('/quick', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, date_from, date_to } = req.body;
    let result;
    if (type === 'revenue_by_category') {
      result = await db.query(
        `SELECT p.category, SUM(si.quantity * si.unit_price) as revenue, SUM(si.quantity) as units
         FROM sale_items si JOIN products p ON si.product_id = p.id JOIN sales s ON si.sale_id = s.id
         WHERE s.created_at BETWEEN ? AND ? GROUP BY p.category ORDER BY revenue DESC`,
        [date_from || '2000-01-01', date_to || '2099-12-31']
      );
    } else if (type === 'revenue_by_date') {
      result = await db.query(
        `SELECT date(s.created_at) as date, SUM(s.total) as revenue, COUNT(*) as orders
         FROM sales s WHERE s.created_at BETWEEN ? AND ? GROUP BY date(s.created_at) ORDER BY date`,
        [date_from || '2000-01-01', date_to || '2099-12-31']
      );
    } else if (type === 'top_products') {
      result = await db.query(
        `SELECT p.name, p.sku, SUM(si.quantity) as units, SUM(si.quantity * si.unit_price) as revenue
         FROM sale_items si JOIN products p ON si.product_id = p.id JOIN sales s ON si.sale_id = s.id
         WHERE s.created_at BETWEEN ? AND ? GROUP BY p.id ORDER BY revenue DESC LIMIT 20`,
        [date_from || '2000-01-01', date_to || '2099-12-31']
      );
    } else {
      return res.status(400).json({ success: false, error: 'Unknown report type' });
    }
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/schedules (MUST be before /:id)
router.get(
  '/schedules',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT sr.*, r.name as report_name FROM scheduled_reports sr LEFT JOIN saved_reports r ON sr.report_id = r.id ORDER BY sr.created_at DESC`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/reports/schedules (MUST be before /:id)
router.post(
  '/schedules',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = scheduleSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      const { report_id, schedule, recipients } = parsed.data;
      const result = await db.query(
        'INSERT INTO scheduled_reports (report_id, schedule, recipients) VALUES (?, ?, ?) RETURNING *',
        [report_id, schedule, recipients]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports — list saved reports
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const result = await db.query(
      `SELECT r.*, u.name as created_by_name FROM saved_reports r LEFT JOIN users u ON r.created_by = u.id
       WHERE r.is_public = 1 OR r.created_by = ? ORDER BY r.updated_at DESC`,
      [authReq.user!.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports — create saved report
router.post('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    const { name, description, report_type, config, chart_type, is_public } = parsed.data;
    const result = await db.query(
      `INSERT INTO saved_reports (name, description, report_type, config, chart_type, is_public, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [
        name,
        description || null,
        report_type,
        config,
        chart_type,
        is_public ? 1 : 0,
        authReq.user!.id,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/reports/:id
router.put('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    const { name, description, report_type, config, chart_type, is_public } = parsed.data;
    const result = await db.query(
      `UPDATE saved_reports SET name=?, description=?, report_type=?, config=?, chart_type=?, is_public=?, updated_at=datetime('now') WHERE id=? RETURNING *`,
      [name, description || null, report_type, config, chart_type, is_public ? 1 : 0, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reports/:id
router.delete('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.query('DELETE FROM saved_reports WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: { message: 'Report deleted' } });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/:id/run — execute a report
router.post('/:id/run', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await db.query('SELECT * FROM saved_reports WHERE id = ?', [req.params.id]);
    if (report.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Report not found' });
    const reportType = (report.rows[0] as Record<string, string>).report_type;

    let data: any[] = [];
    if (reportType === 'sales') {
      const result = await db.query(
        `SELECT date(s.created_at) as date, COUNT(*) as count, SUM(s.total) as revenue, AVG(s.total) as avg_order,
         s.payment_method FROM sales s WHERE s.created_at >= date('now', '-30 days')
         GROUP BY date(s.created_at) ORDER BY date DESC`
      );
      data = result.rows;
    } else if (reportType === 'inventory') {
      const result = await db.query(
        `SELECT p.name, p.sku, p.category, p.stock, p.price, p.cost_price,
         (p.price - COALESCE(p.cost_price, 0)) as margin, p.stock * p.price as stock_value
         FROM products p WHERE p.status = 'active' ORDER BY p.stock ASC`
      );
      data = result.rows;
    } else if (reportType === 'customers') {
      const result = await db.query(
        `SELECT c.name, c.phone, COUNT(s.id) as order_count, COALESCE(SUM(s.total), 0) as total_spent,
         MAX(s.created_at) as last_purchase
         FROM customers c LEFT JOIN sales s ON s.customer_id = c.id
         GROUP BY c.id ORDER BY total_spent DESC`
      );
      data = result.rows;
    } else if (reportType === 'financial') {
      const result = await db.query(
        `SELECT date(s.created_at) as date, SUM(s.total) as revenue,
         SUM(si.quantity * COALESCE(p.cost_price, 0)) as cogs,
         SUM(s.total) - SUM(si.quantity * COALESCE(p.cost_price, 0)) as profit
         FROM sales s JOIN sale_items si ON s.id = si.sale_id JOIN products p ON si.product_id = p.id
         WHERE s.created_at >= date('now', '-30 days')
         GROUP BY date(s.created_at) ORDER BY date DESC`
      );
      data = result.rows;
    }

    await db.query("UPDATE saved_reports SET last_run_at = datetime('now') WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
