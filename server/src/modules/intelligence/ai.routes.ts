import { Router, Request, Response, NextFunction } from 'express';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';

const router: Router = Router();

// GET /api/ai/forecast — 30-day demand forecast based on 90-day moving averages
router.get(
  '/forecast',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const salesHistory = await db.query(
        `SELECT
          si.product_id,
          p.name as product_name,
          p.stock as current_stock,
          p.min_stock,
          p.price,
          c.name as category_name,
          COALESCE(SUM(si.quantity), 0)::int as total_sold_90d,
          ROUND(COALESCE(SUM(si.quantity), 0) / 90.0, 2) as daily_velocity
         FROM products p
         LEFT JOIN sale_items si ON p.id = si.product_id
         LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= NOW() - INTERVAL '90 days' AND s.status != 'voided'
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.status = 'active'
         GROUP BY p.id, p.name, p.stock, p.min_stock, p.price, c.name`
      );

      const forecasts = salesHistory.rows.map((row: any) => {
        const dailyVelocity = parseFloat(row.daily_velocity) || 0;
        const forecast30d = Math.round(dailyVelocity * 30);
        const daysOfStock = dailyVelocity > 0 ? Math.round(row.current_stock / dailyVelocity) : 999;
        const reorderRecommended = row.current_stock <= row.min_stock || daysOfStock < 14;
        const suggestedReorderQty = reorderRecommended
          ? Math.max(0, Math.round(dailyVelocity * 45) - row.current_stock)
          : 0;

        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (row.total_sold_90d >= 30) confidence = 'high';
        else if (row.total_sold_90d >= 10) confidence = 'medium';

        return {
          productId: row.product_id,
          productName: row.product_name,
          categoryName: row.category_name,
          currentStock: row.current_stock,
          minStock: row.min_stock,
          price: row.price,
          dailyVelocity,
          forecast30d,
          daysOfStock,
          reorderRecommended,
          suggestedReorderQty,
          confidence,
        };
      });

      // Sort by days of stock ascending (most urgent first)
      forecasts.sort((a: any, b: any) => a.daysOfStock - b.daysOfStock);

      res.json({
        success: true,
        data: {
          period: '30_days',
          generatedAt: new Date().toISOString(),
          forecasts,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ai/recommendations — Product affinities / cross-sell rules
router.get(
  '/recommendations',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId } = req.query;

      if (productId) {
        // Recommendations for a specific product
        const coPurchased = await db.query(
          `SELECT
            si2.product_id as recommended_product_id,
            p.name as product_name,
            p.price,
            p.stock,
            p.image_url,
            c.name as category_name,
            COUNT(*)::int as co_occurrence_count
           FROM sale_items si1
           JOIN sale_items si2 ON si1.sale_id = si2.sale_id AND si1.product_id != si2.product_id
           JOIN products p ON si2.product_id = p.id
           LEFT JOIN categories c ON p.category_id = c.id
           JOIN sales s ON si1.sale_id = s.id AND s.status != 'voided'
           WHERE si1.product_id = $1 AND p.status = 'active' AND p.stock > 0
           GROUP BY si2.product_id, p.name, p.price, p.stock, p.image_url, c.name
           ORDER BY co_occurrence_count DESC
           LIMIT 5`,
          [Number(productId)]
        );

        return res.json({
          success: true,
          data: {
            sourceProductId: Number(productId),
            recommendations: coPurchased.rows,
          },
        });
      }

      // Global top affinities (pairs frequently bought together)
      const topPairs = await db.query(
        `SELECT
          si1.product_id as product_a_id,
          p1.name as product_a_name,
          si2.product_id as product_b_id,
          p2.name as product_b_name,
          COUNT(*)::int as frequency
         FROM sale_items si1
         JOIN sale_items si2 ON si1.sale_id = si2.sale_id AND si1.product_id < si2.product_id
         JOIN products p1 ON si1.product_id = p1.id
         JOIN products p2 ON si2.product_id = p2.id
         JOIN sales s ON si1.sale_id = s.id AND s.status != 'voided'
         WHERE p1.status = 'active' AND p2.status = 'active'
         GROUP BY si1.product_id, p1.name, si2.product_id, p2.name
         HAVING COUNT(*) >= 2
         ORDER BY frequency DESC
         LIMIT 20`
      );

      res.json({
        success: true,
        data: {
          topPairs: topPairs.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ai/pricing-suggestions — Slow-moving discounts & high-demand price increase suggestions
router.get(
  '/pricing-suggestions',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // 1. Slow-moving products (high stock, 0 sales in 30 days) -> suggest markdown
      const deadStock = await db.query(
        `SELECT
          p.id,
          p.name,
          p.price,
          p.cost_price,
          p.stock,
          c.name as category_name,
          COALESCE(SUM(si.quantity), 0)::int as sales_30d
         FROM products p
         LEFT JOIN sale_items si ON p.id = si.product_id
         LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= NOW() - INTERVAL '30 days' AND s.status != 'voided'
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.status = 'active' AND p.stock > 5
         GROUP BY p.id, p.name, p.price, p.cost_price, p.stock, c.name
         HAVING COALESCE(SUM(si.quantity), 0) = 0
         ORDER BY p.stock DESC
         LIMIT 10`
      );

      // 2. High-demand products (selling fast, healthy margin) -> suggest minor price increase
      const fastMovers = await db.query(
        `SELECT
          p.id,
          p.name,
          p.price,
          p.cost_price,
          p.stock,
          c.name as category_name,
          SUM(si.quantity)::int as sales_30d
         FROM products p
         JOIN sale_items si ON p.id = si.product_id
         JOIN sales s ON si.sale_id = s.id AND s.created_at >= NOW() - INTERVAL '30 days' AND s.status != 'voided'
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.status = 'active'
         GROUP BY p.id, p.name, p.price, p.cost_price, p.stock, c.name
         HAVING SUM(si.quantity) >= 20
         ORDER BY sales_30d DESC
         LIMIT 10`
      );

      const suggestions = [
        ...deadStock.rows.map((row: any) => {
          const discountPct = 15;
          const suggestedPrice = Math.max(
            row.cost_price * 1.05,
            Math.round(row.price * (1 - discountPct / 100))
          );
          return {
            productId: row.id,
            productName: row.name,
            category: row.category_name,
            currentPrice: row.price,
            costPrice: row.cost_price,
            stock: row.stock,
            type: 'markdown',
            reason: 'Zero sales in last 30 days with high stock level',
            suggestedPrice: Math.round(suggestedPrice * 100) / 100,
            potentialImpact: `Clear ${row.stock} stagnant units, free up capital`,
          };
        }),
        ...fastMovers.rows.map((row: any) => {
          const markupPct = 5;
          const suggestedPrice = Math.round(row.price * (1 + markupPct / 100));
          return {
            productId: row.id,
            productName: row.name,
            category: row.category_name,
            currentPrice: row.price,
            costPrice: row.cost_price,
            stock: row.stock,
            type: 'markup',
            reason: `High velocity (${row.sales_30d} sold in 30 days)`,
            suggestedPrice,
            potentialImpact: `+${markupPct}% margin with minimal demand impact`,
          };
        }),
      ];

      res.json({ success: true, data: suggestions });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ai/churn-risk — Customer churn prediction
router.get(
  '/churn-risk',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const customers = await db.query(
        `SELECT
          c.id,
          c.name,
          c.phone,
          c.loyalty_points,
          COUNT(s.id)::int as total_orders,
          COALESCE(SUM(s.total), 0) as total_spent,
          MAX(s.created_at) as last_order_date,
          ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(s.created_at)::timestamp)) / 86400.0) as days_since_last_order
         FROM customers c
         JOIN sales s ON c.id = s.customer_id AND s.status != 'voided'
         GROUP BY c.id, c.name, c.phone, c.loyalty_points
         HAVING COUNT(s.id) >= 2
         ORDER BY days_since_last_order DESC`
      );

      const analyzed = customers.rows
        .map((row: any) => {
          const days = parseFloat(row.days_since_last_order) || 0;
          let risk: 'high' | 'medium' | 'low' = 'low';
          let action = 'Regular engagement';

          if (days >= 90) {
            risk = 'high';
            action = 'Send win-back SMS discount (e.g. 20% off)';
          } else if (days >= 45) {
            risk = 'medium';
            action = 'Send new arrivals notification or loyalty bonus';
          }

          return {
            customerId: row.id,
            customerName: row.name,
            phone: row.phone,
            loyaltyPoints: row.loyalty_points,
            totalOrders: row.total_orders,
            totalSpent: parseFloat(row.total_spent),
            lastOrderDate: row.last_order_date,
            daysSinceLastOrder: Math.round(days),
            churnRisk: risk,
            recommendedAction: action,
          };
        })
        .filter((c: any) => c.churnRisk !== 'low');

      res.json({
        success: true,
        data: {
          atRiskCount: analyzed.length,
          customers: analyzed,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/ai/anomalies — Fraud & anomaly detection
router.get(
  '/anomalies',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const anomalies: Array<{
        type: string;
        severity: 'high' | 'medium' | 'low';
        description: string;
        details: Record<string, unknown>;
        timestamp: string;
      }> = [];

      // 1. High-discount sales (>30% discount)
      const highDiscountSales = await db.query(
        `SELECT s.id, s.receipt_number, s.total, s.discount, s.subtotal, u.name as cashier_name, s.created_at
         FROM sales s
         LEFT JOIN users u ON s.cashier_id = u.id
         WHERE s.subtotal > 0 AND (s.discount / s.subtotal) >= 0.3 AND s.status != 'voided'
         ORDER BY s.created_at DESC LIMIT 10`
      );

      for (const row of highDiscountSales.rows) {
        const pct = Math.round((row.discount / row.subtotal) * 100);
        anomalies.push({
          type: 'high_discount',
          severity: pct >= 50 ? 'high' : 'medium',
          description: `Sale ${row.receipt_number} had a ${pct}% discount applied by ${row.cashier_name || 'unknown'}`,
          details: {
            saleId: row.id,
            receiptNumber: row.receipt_number,
            subtotal: row.subtotal,
            discount: row.discount,
            cashier: row.cashier_name,
          },
          timestamp: row.created_at,
        });
      }

      // 2. Unusually high quantity returns
      const largeReturns = await db.query(
        `SELECT sa.id, sa.product_id, p.name as product_name, sa.delta, sa.reason, u.name as user_name, sa.created_at
         FROM stock_adjustments sa
         JOIN products p ON sa.product_id = p.id
         LEFT JOIN users u ON sa.user_id = u.id
         WHERE sa.delta < -10 AND sa.reason = 'Damaged'
         ORDER BY sa.created_at DESC LIMIT 5`
      );

      for (const row of largeReturns.rows) {
        anomalies.push({
          type: 'large_damage_writeoff',
          severity: 'high',
          description: `Large damaged stock write-off of ${Math.abs(row.delta)} units for "${row.product_name}" by ${row.user_name || 'unknown'}`,
          details: {
            adjustmentId: row.id,
            product: row.product_name,
            quantity: Math.abs(row.delta),
            user: row.user_name,
          },
          timestamp: row.created_at,
        });
      }

      // 3. Cashiers with unusually high void/refund rates
      const cashierStats = await db.query(
        `SELECT
          u.name as cashier_name,
          COUNT(s.id)::int as total_sales,
          SUM(CASE WHEN s.status IN ('refunded', 'partially_refunded') THEN 1 ELSE 0 END)::int as refunded_count,
          COALESCE(SUM(s.refunded_amount), 0) as total_refunded_amount
         FROM sales s
         JOIN users u ON s.cashier_id = u.id
         WHERE s.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY u.id, u.name
         HAVING COUNT(s.id) >= 10 AND (SUM(CASE WHEN s.status IN ('refunded', 'partially_refunded') THEN 1 ELSE 0 END) / COUNT(s.id)::float) >= 0.15`
      );

      for (const row of cashierStats.rows) {
        anomalies.push({
          type: 'high_cashier_refund_rate',
          severity: 'medium',
          description: `Cashier ${row.cashier_name} has a ${Math.round((row.refunded_count / row.total_sales) * 100)}% refund rate over the last 30 days`,
          details: {
            cashier: row.cashier_name,
            totalSales: row.total_sales,
            refundCount: row.refunded_count,
            totalRefunded: row.total_refunded_amount,
          },
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        data: {
          totalAnomalies: anomalies.length,
          anomalies,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
