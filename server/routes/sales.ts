import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { saleSchema } from '../validators/saleSchema';
import { refundSchema } from '../validators/refundSchema';
import { logAuditFromReq } from '../middleware/auditLogger';
import { notifySale } from '../services/notifications';
import { recordSaleMovement, recordRefundMovement } from './register';

const router: Router = Router();

// GET /api/sales/stats/summary  (must be before /:id)
router.get(
  '/stats/summary',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (_req: Request, res: Response, next: NextFunction) => {
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

      const {
        items,
        discount,
        discount_type,
        payment_method,
        payments,
        customer_id,
        points_redeemed,
        notes,
        tip,
        coupon_code,
      } = parsed.data;

      // Calculate total
      let subtotal = 0;
      for (const item of items) {
        subtotal += item.unit_price * item.quantity;
      }

      let discountAmount = discount;
      if (discount_type === 'percentage') {
        discountAmount = (subtotal * discount) / 100;
      }
      const afterDiscount = Math.max(0, subtotal - discountAmount);

      // Load tax settings
      const rawDb = db.db;
      const taxEnabledRow = rawDb
        .prepare("SELECT value FROM settings WHERE key = 'tax_enabled'")
        .get() as { value: string } | undefined;
      const taxRateRow = rawDb
        .prepare("SELECT value FROM settings WHERE key = 'tax_rate'")
        .get() as { value: string } | undefined;
      const taxModeRow = rawDb
        .prepare("SELECT value FROM settings WHERE key = 'tax_mode'")
        .get() as { value: string } | undefined;

      const taxEnabled = taxEnabledRow?.value === 'true';
      const taxRate = parseFloat(taxRateRow?.value || '0');
      const taxMode = taxModeRow?.value || 'exclusive';

      let taxAmount = 0;
      let total = afterDiscount;

      if (taxEnabled && taxRate > 0) {
        if (taxMode === 'exclusive') {
          // Tax added on top
          taxAmount = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
          total = afterDiscount + taxAmount;
        } else {
          // Tax inclusive - extract tax from total
          taxAmount = Math.round((afterDiscount - afterDiscount / (1 + taxRate / 100)) * 100) / 100;
          total = afterDiscount; // price already includes tax
        }
      }

      // Load loyalty settings
      const loyaltyEnabledRow = rawDb
        .prepare("SELECT value FROM settings WHERE key = 'loyalty_enabled'")
        .get() as { value: string } | undefined;
      const loyaltyEarnRateRow = rawDb
        .prepare("SELECT value FROM settings WHERE key = 'loyalty_earn_rate'")
        .get() as { value: string } | undefined;
      const loyaltyRedeemValueRow = rawDb
        .prepare("SELECT value FROM settings WHERE key = 'loyalty_redeem_value'")
        .get() as { value: string } | undefined;

      const loyaltyEnabled = loyaltyEnabledRow?.value === 'true';
      const loyaltyEarnRate = parseFloat(loyaltyEarnRateRow?.value || '1');
      const loyaltyRedeemValue = parseFloat(loyaltyRedeemValueRow?.value || '5');

      // Calculate points redemption discount
      let pointsDiscount = 0;
      if (loyaltyEnabled && points_redeemed > 0 && customer_id) {
        pointsDiscount = Math.round((points_redeemed / 100) * loyaltyRedeemValue * 100) / 100;
        pointsDiscount = Math.min(pointsDiscount, total); // cannot exceed total
        total = Math.round((total - pointsDiscount) * 100) / 100;
      }

      // Coupon validation
      let couponId: number | null = null;
      let couponDiscount = 0;
      if (coupon_code) {
        const coupon = rawDb
          .prepare("SELECT * FROM coupons WHERE code = ? AND status = 'active'")
          .get(coupon_code) as Record<string, any> | undefined;
        if (coupon) {
          const now = new Date().toISOString();
          if (
            (!coupon.starts_at || coupon.starts_at <= now) &&
            (!coupon.expires_at || coupon.expires_at >= now)
          ) {
            if (
              !coupon.max_uses ||
              (
                rawDb
                  .prepare('SELECT COUNT(*) as c FROM coupon_usage WHERE coupon_id = ?')
                  .get(coupon.id) as { c: number }
              ).c < coupon.max_uses
            ) {
              if (total >= (coupon.min_purchase || 0)) {
                couponDiscount =
                  coupon.type === 'percentage'
                    ? Math.round(total * (coupon.value / 100) * 100) / 100
                    : coupon.value;
                if (coupon.max_discount && couponDiscount > coupon.max_discount)
                  couponDiscount = coupon.max_discount;
                couponDiscount = Math.min(couponDiscount, total);
                total = Math.round((total - couponDiscount) * 100) / 100;
                couponId = coupon.id;
              }
            }
          }
        }
      }

      // Add tip (not included in sale total, stored separately)
      const tipAmount = tip || 0;

      // Use raw db for transaction
      const txn = rawDb.transaction(() => {
        // Validate customer has enough points for redemption
        if (loyaltyEnabled && points_redeemed > 0 && customer_id) {
          const cust = rawDb
            .prepare('SELECT loyalty_points FROM customers WHERE id = ?')
            .get(customer_id) as { loyalty_points: number } | undefined;
          if (!cust || cust.loyalty_points < points_redeemed) {
            throw new Error('Insufficient loyalty points');
          }
        }

        const saleResult = rawDb
          .prepare(
            `INSERT INTO sales (total, discount, discount_type, payment_method, cashier_id, customer_id, tax_amount, points_redeemed, notes, tip_amount, coupon_id, coupon_discount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
          )
          .get(
            total,
            discount,
            discount_type,
            payments && payments.length > 1 ? 'Split' : payment_method,
            authReq.user!.id,
            customer_id || null,
            taxAmount,
            points_redeemed || 0,
            notes || null,
            tipAmount,
            couponId,
            couponDiscount
          ) as Record<string, any>;

        // Record split payments
        if (payments && payments.length > 0) {
          const insertPayment = rawDb.prepare(
            'INSERT INTO sale_payments (sale_id, method, amount) VALUES (?, ?, ?)'
          );
          for (const p of payments) {
            insertPayment.run(saleResult.id, p.method, p.amount);
          }
        }

        // Record coupon usage
        if (couponId && couponDiscount > 0) {
          rawDb
            .prepare(
              'INSERT INTO coupon_usage (coupon_id, sale_id, customer_id, discount_applied) VALUES (?, ?, ?, ?)'
            )
            .run(couponId, saleResult.id, customer_id || null, couponDiscount);
        }

        for (const item of items) {
          const variantId = item.variant_id || null;
          const itemMemo = item.memo || null;

          if (variantId) {
            // Variant sale: deduct stock from variant
            const variant = rawDb
              .prepare(
                'SELECT cost_price, stock FROM product_variants WHERE id = ? AND product_id = ?'
              )
              .get(variantId, item.product_id) as { cost_price: number; stock: number } | undefined;
            const costPrice = variant?.cost_price || 0;
            const previousStock = variant?.stock || 0;

            rawDb
              .prepare(
                'INSERT INTO sale_items (sale_id, product_id, variant_id, quantity, unit_price, cost_price, memo) VALUES (?, ?, ?, ?, ?, ?, ?)'
              )
              .run(
                saleResult.id,
                item.product_id,
                variantId,
                item.quantity,
                item.unit_price,
                costPrice,
                itemMemo
              );

            const updated = rawDb
              .prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
              .run(item.quantity, variantId, item.quantity);

            if (updated.changes === 0) {
              throw new Error(`Insufficient stock for variant ID ${variantId}`);
            }

            // Log stock adjustment against parent product
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
          } else {
            // Regular product sale
            const product = rawDb
              .prepare('SELECT cost_price, stock FROM products WHERE id = ?')
              .get(item.product_id) as { cost_price: number; stock: number } | undefined;
            const costPrice = product?.cost_price || 0;
            const previousStock = product?.stock || 0;

            rawDb
              .prepare(
                'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price, memo) VALUES (?, ?, ?, ?, ?, ?)'
              )
              .run(
                saleResult.id,
                item.product_id,
                item.quantity,
                item.unit_price,
                costPrice,
                itemMemo
              );

            const updated = rawDb
              .prepare(
                "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND stock >= ?"
              )
              .run(item.quantity, item.product_id, item.quantity);

            if (updated.changes === 0) {
              throw new Error(`Insufficient stock for product ID ${item.product_id}`);
            }

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
        }

        // Loyalty: deduct redeemed points and earn new points
        if (loyaltyEnabled && customer_id) {
          // Deduct redeemed points
          if (points_redeemed > 0) {
            rawDb
              .prepare(
                "UPDATE customers SET loyalty_points = loyalty_points - ?, updated_at = datetime('now') WHERE id = ?"
              )
              .run(points_redeemed, customer_id);
            rawDb
              .prepare(
                'INSERT INTO loyalty_transactions (customer_id, sale_id, points, type, note) VALUES (?, ?, ?, ?, ?)'
              )
              .run(
                customer_id,
                saleResult.id,
                -points_redeemed,
                'redeemed',
                `Redeemed on sale #${saleResult.id}`
              );
          }

          // Earn points based on total spent (after all discounts)
          const earnedPoints = Math.floor(total * loyaltyEarnRate);
          if (earnedPoints > 0) {
            rawDb
              .prepare(
                "UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = datetime('now') WHERE id = ?"
              )
              .run(earnedPoints, customer_id);
            rawDb
              .prepare(
                'INSERT INTO loyalty_transactions (customer_id, sale_id, points, type, note) VALUES (?, ?, ?, ?, ?)'
              )
              .run(
                customer_id,
                saleResult.id,
                earnedPoints,
                'earned',
                `Earned from sale #${saleResult.id}`
              );
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

      logAuditFromReq(req, 'create', 'sale', sale.id, {
        total: sale.total,
        items: parsed.data.items.length,
      });

      notifySale(sale.total, sale.id, cashier?.name || 'Unknown');

      // Record cash register movement for cash payments
      const cashPayments = (parsed.data.payments || []).filter(
        (p: { method: string }) => p.method === 'Cash'
      );
      const cashAmount = cashPayments.reduce(
        (sum: number, p: { amount: number }) => sum + p.amount,
        0
      );
      const singleCashPayment = parsed.data.payment_method === 'Cash' ? sale.total : 0;
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

      logAuditFromReq(req, 'refund', 'sale', req.params.id, { refund_amount: refund.total_refund });

      // Record cash register refund movement
      recordRefundMovement((req as AuthRequest).user!.id, refund.total_refund);

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

      // Verify sale exists
      const saleResult = await db.query('SELECT * FROM sales WHERE id = ?', [req.params.id]);
      if (saleResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Sale not found' });
      }

      // Update receipt_sent_via
      await db.query('UPDATE sales SET receipt_sent_via = ? WHERE id = ?', [
        channel,
        req.params.id,
      ]);

      // In production, integrate with email/SMS/WhatsApp service here
      // For now, just record the intent

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
