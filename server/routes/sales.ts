import { Router, Request, Response, NextFunction } from 'express';
import db from '../src/database/pool';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { saleSchema } from '../validators/saleSchema';
import { refundSchema } from '../validators/refundSchema';
import { logAuditFromReq } from '../middleware/auditLogger';
import { notifySale } from '../services/notifications';
import { recordSaleMovement, recordRefundMovement } from './register';
import {
  calculateSaleTotals,
  executeSaleTransaction,
  executeRefundTransaction,
} from '../services/saleService';

const router: Router = Router();

// GET /api/sales/stats/summary  (must be before /:id)
router.get(
  '/stats/summary',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const today = await db.query<{ revenue: string | number; count: string | number }>(
        `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue, COUNT(*) as count
         FROM sales WHERE created_at::date = CURRENT_DATE`
      );
      const month = await db.query<{ revenue: string | number; count: string | number }>(
        `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue, COUNT(*) as count
         FROM sales WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)`
      );

      res.json({
        success: true,
        data: {
          today_revenue: Number(today.rows[0].revenue),
          today_sales: Number(today.rows[0].count),
          month_revenue: Number(month.rows[0].revenue),
          month_sales: Number(month.rows[0].count),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/sales
router.post(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = saleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const totals = await calculateSaleTotals(parsed.data);

      let sale: Record<string, any>;
      try {
        sale = await executeSaleTransaction(parsed.data, totals, authReq.user!.id);
      } catch (err: any) {
        return res.status(400).json({ success: false, error: err.message });
      }

      // Fetch full sale with items
      const saleItems = (
        await db.query(
          `SELECT si.*, p.name as product_name
           FROM sale_items si JOIN products p ON si.product_id = p.id
           WHERE si.sale_id = $1`,
          [sale.id]
        )
      ).rows;

      const cashier = (
        await db.query<{ name: string }>('SELECT name FROM users WHERE id = $1', [authReq.user!.id])
      ).rows[0];

      logAuditFromReq(req, 'create', 'sale', sale.id, {
        total: sale.total,
        items: parsed.data.items.length,
      });

      notifySale(Number(sale.total), sale.id, cashier?.name || 'Unknown');

      // Record cash register movement for cash payments
      const cashPayments = (parsed.data.payments || []).filter(
        (p: { method: string }) => p.method === 'Cash'
      );
      const cashAmount = cashPayments.reduce(
        (sum: number, p: { amount: number }) => sum + p.amount,
        0
      );
      const singleCashPayment = parsed.data.payment_method === 'Cash' ? Number(sale.total) : 0;
      const totalCashForRegister = cashAmount || singleCashPayment;
      if (totalCashForRegister > 0) {
        recordSaleMovement(authReq.user!.id, sale.id, totalCashForRegister);
      }

      res.status(201).json({
        success: true,
        data: { ...sale, cashier_name: cashier?.name, items: saleItems },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sales
router.get(
  '/',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 25,
        from,
        to,
        payment_method,
        cashier_id,
        customer_id,
        search,
      } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const where: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (from) {
        where.push(`s.created_at >= $${paramIdx++}`);
        params.push(from);
      }
      if (to) {
        where.push(`s.created_at <= $${paramIdx++}`);
        params.push(to + ' 23:59:59');
      }
      if (payment_method) {
        where.push(`s.payment_method = $${paramIdx++}`);
        params.push(payment_method);
      }
      if (cashier_id) {
        where.push(`s.cashier_id = $${paramIdx++}`);
        params.push(cashier_id);
      }
      if (customer_id) {
        where.push(`s.customer_id = $${paramIdx++}`);
        params.push(customer_id);
      }
      if (search) {
        where.push(`s.id::text ILIKE $${paramIdx++}`);
        params.push(`%${search}%`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: string | number }>(
        `SELECT COUNT(*) as count FROM sales s ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0].count);

      const revenueResult = await db.query<{ total_revenue: string | number }>(
        `SELECT COALESCE(SUM(total), 0) as total_revenue FROM sales s ${whereClause}`,
        params
      );

      const queryParams = [...params, limitNum, offset];
      const limitIdx = paramIdx++;
      const offsetIdx = paramIdx++;

      const result = await db.query(
        `SELECT s.*, u.name as cashier_name, c.name as customer_name,
                COUNT(si.id)::int as items_count,
                s.refund_status, s.refunded_amount
         FROM sales s
         LEFT JOIN users u ON s.cashier_id = u.id
         LEFT JOIN customers c ON s.customer_id = c.id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         ${whereClause}
         GROUP BY s.id, u.name, c.name
         ORDER BY s.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        queryParams
      );

      res.json({
        success: true,
        data: result.rows,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          total_revenue: Number(revenueResult.rows[0].total_revenue),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sales/:id
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saleResult = await db.query(
        `SELECT s.*, u.name as cashier_name
         FROM sales s LEFT JOIN users u ON s.cashier_id = u.id
         WHERE s.id = $1`,
        [req.params.id]
      );

      if (saleResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Sale not found' });
      }

      const items = await db.query(
        `SELECT si.*, p.name as product_name
         FROM sale_items si JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = $1`,
        [req.params.id]
      );

      res.json({ success: true, data: { ...saleResult.rows[0], items: items.rows } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/sales/:id/refund
router.post(
  '/:id/refund',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const saleId = Number(req.params.id);

      const parsed = refundSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      let result;
      try {
        result = await executeRefundTransaction(saleId, parsed.data, authReq.user!.id);
      } catch (err: any) {
        const status = err.message === 'Sale not found' ? 404 : 400;
        return res.status(status).json({ success: false, error: err.message });
      }

      const { refund, refundStatus, newRefundedTotal } = result;

      logAuditFromReq(req, 'refund', 'sale', req.params.id, { refund_amount: refund.amount });
      recordRefundMovement(authReq.user!.id, Number(refund.amount));

      res.status(201).json({
        success: true,
        data: {
          ...refund,
          items: typeof refund.items === 'string' ? JSON.parse(refund.items) : refund.items,
          refund_status: refundStatus,
          refunded_amount: newRefundedTotal,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/sales/:id/refunds
router.get(
  '/:id/refunds',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const saleId = Number(req.params.id);

      const result = await db.query(
        `SELECT r.*, u.name as cashier_name
         FROM refunds r
         LEFT JOIN users u ON r.cashier_id = u.id
         WHERE r.sale_id = $1
         ORDER BY r.created_at DESC`,
        [saleId]
      );

      const refunds = result.rows.map((r: any) => ({
        ...r,
        items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      }));

      res.json({ success: true, data: refunds });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/sales/:id/send-receipt — Send digital receipt
router.post(
  '/:id/send-receipt',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { channel, destination } = req.body;
      if (!channel || !destination) {
        return res.status(400).json({ success: false, error: 'Channel and destination required' });
      }
      if (!['email', 'sms', 'whatsapp'].includes(channel)) {
        return res
          .status(400)
          .json({ success: false, error: 'Channel must be email, sms, or whatsapp' });
      }

      const saleResult = await db.query('SELECT * FROM sales WHERE id = $1', [req.params.id]);
      if (saleResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Sale not found' });
      }

      await db.query('UPDATE sales SET receipt_sent_via = $1 WHERE id = $2', [
        channel,
        req.params.id,
      ]);

      res.json({
        success: true,
        data: {
          message: `Receipt queued via ${channel} to ${destination}`,
          sale_id: Number(req.params.id),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
