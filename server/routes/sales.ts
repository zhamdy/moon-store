import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { saleSchema } from '../validators/saleSchema';
import { refundSchema } from '../validators/refundSchema';

const router: Router = Router();

// GET /api/sales/stats/summary  (must be before /:id)
router.get(
  '/stats/summary',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const today = await db.query<{ revenue: number; count: number }>(
        `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue, COUNT(*) as count
       FROM sales WHERE date(created_at) = date('now')`
      );
      const month = await db.query<{ revenue: number; count: number }>(
        `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue, COUNT(*) as count
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

      const { items, discount, discount_type, payment_method, customer_id } = parsed.data;

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
        const saleResult = rawDb
          .prepare(
            `INSERT INTO sales (total, discount, discount_type, payment_method, cashier_id, customer_id)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
          )
          .get(
            total,
            discount,
            discount_type,
            payment_method,
            authReq.user!.id,
            customer_id || null
          ) as Record<string, any>;

        for (const item of items) {
          // Snapshot cost_price and current stock from product
          const product = rawDb
            .prepare('SELECT cost_price, stock FROM products WHERE id = ?')
            .get(item.product_id) as { cost_price: number; stock: number } | undefined;
          const costPrice = product?.cost_price || 0;
          const previousStock = product?.stock || 0;

          rawDb
            .prepare(
              'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price) VALUES (?, ?, ?, ?, ?)'
            )
            .run(saleResult.id, item.product_id, item.quantity, item.unit_price, costPrice);

          const updated = rawDb
            .prepare(
              "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND stock >= ?"
            )
            .run(item.quantity, item.product_id, item.quantity);

          if (updated.changes === 0) {
            throw new Error(`Insufficient stock for product ID ${item.product_id}`);
          }

          // Log stock adjustment
          rawDb
            .prepare(
              'INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)'
            )
            .run(
              item.product_id,
              previousStock,
              previousStock - item.quantity,
              -item.quantity,
              'Sale',
              authReq.user!.id
            );
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
      const saleItems = (
        await db.query(
          `SELECT si.*, p.name as product_name
       FROM sale_items si JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`,
          [sale.id]
        )
      ).rows;

      const cashier = (
        await db.query<{ name: string }>('SELECT name FROM users WHERE id = ?', [authReq.user!.id])
      ).rows[0];

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
      if (customer_id) {
        where.push(`s.customer_id = ?`);
        params.push(customer_id);
      }
      if (search) {
        where.push(`CAST(s.id AS TEXT) LIKE ?`);
        params.push(`%${search}%`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM sales s ${whereClause}`,
        params
      );
      const total = countResult.rows[0].count;

      const revenueResult = await db.query<{ total_revenue: number }>(
        `SELECT COALESCE(SUM(total), 0) as total_revenue FROM sales s ${whereClause}`,
        params
      );

      const result = await db.query(
        `SELECT s.*, u.name as cashier_name, c.name as customer_name,
        (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count,
        s.refund_status, s.refunded_amount
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
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

      const { items, reason, restock } = parsed.data;

      // Verify the sale exists
      const saleResult = await db.query<{
        id: number;
        total: number;
        refunded_amount: number | null;
        refund_status: string | null;
      }>('SELECT id, total, refunded_amount, refund_status FROM sales WHERE id = ?', [saleId]);

      if (saleResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Sale not found' });
      }

      const sale = saleResult.rows[0];
      if (sale.refund_status === 'full') {
        return res.status(400).json({ success: false, error: 'Sale already fully refunded' });
      }

      // Get sale items for validation
      const saleItems = await db.query<{
        product_id: number;
        quantity: number;
        unit_price: number;
      }>('SELECT product_id, quantity, unit_price FROM sale_items WHERE sale_id = ?', [saleId]);

      // Validate refund items against sale items
      for (const refundItem of items) {
        const saleItem = saleItems.rows.find((si) => si.product_id === refundItem.product_id);
        if (!saleItem) {
          return res
            .status(400)
            .json({ success: false, error: `Product ${refundItem.product_id} not in this sale` });
        }
        if (refundItem.quantity > saleItem.quantity) {
          return res.status(400).json({
            success: false,
            error: `Refund quantity exceeds sold quantity for product ${refundItem.product_id}`,
          });
        }
      }

      // Calculate refund amount
      let refundAmount = 0;
      for (const item of items) {
        refundAmount += item.unit_price * item.quantity;
      }

      const previouslyRefunded = sale.refunded_amount || 0;
      if (previouslyRefunded + refundAmount > sale.total) {
        return res.status(400).json({ success: false, error: 'Refund amount exceeds sale total' });
      }

      const newRefundedTotal = previouslyRefunded + refundAmount;
      const refundStatus = newRefundedTotal >= sale.total ? 'full' : 'partial';

      // Execute refund in transaction
      const rawDb = db.db;
      const txn = rawDb.transaction(() => {
        // Insert refund record
        const refund = rawDb
          .prepare(
            `INSERT INTO refunds (sale_id, amount, reason, items, restock, cashier_id)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
          )
          .get(
            saleId,
            refundAmount,
            reason,
            JSON.stringify(items),
            restock ? 1 : 0,
            authReq.user!.id
          ) as Record<string, any>;

        // Update sale refund status
        rawDb
          .prepare('UPDATE sales SET refund_status = ?, refunded_amount = ? WHERE id = ?')
          .run(refundStatus, newRefundedTotal, saleId);

        // Restock if requested
        if (restock) {
          for (const item of items) {
            rawDb
              .prepare(
                "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?"
              )
              .run(item.quantity, item.product_id);
          }
        }

        return refund;
      });

      let refund: Record<string, any>;
      try {
        refund = txn();
      } catch (err: any) {
        return res.status(400).json({ success: false, error: err.message });
      }

      res.status(201).json({
        success: true,
        data: {
          ...refund,
          items: JSON.parse(refund.items),
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
         WHERE r.sale_id = ?
         ORDER BY r.created_at DESC`,
        [saleId]
      );

      const refunds = result.rows.map((r: any) => ({
        ...r,
        items: JSON.parse(r.items),
      }));

      res.json({ success: true, data: refunds });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
