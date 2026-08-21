import { Router, Request, Response, NextFunction } from 'express';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';

const router: Router = Router();

// GET /api/reports/sales — Detailed sales report with grouping
router.get(
  '/sales',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        from,
        to,
        groupBy = 'day',
        cashierId,
        paymentMethod,
        page = '1',
        limit = '50',
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      const where: string[] = ["s.status != 'voided'"];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (from) {
        where.push(`s.created_at >= $${paramIdx++}`);
        params.push(from);
      }
      if (to) {
        where.push(`s.created_at <= $${paramIdx++}`);
        params.push(to);
      }
      if (cashierId) {
        where.push(`s.cashier_id = $${paramIdx++}`);
        params.push(Number(cashierId));
      }
      if (paymentMethod) {
        where.push(`s.payment_method = $${paramIdx++}`);
        params.push(String(paymentMethod));
      }

      const whereClause = `WHERE ${where.join(' AND ')}`;

      // Aggregate summary
      const summaryResult = await db.query<{
        total_sales: string | number;
        total_discount: string | number;
        total_tax: string | number;
        total_orders: number;
        avg_order_value: string | number;
      }>(
        `SELECT
          COALESCE(SUM(s.total), 0) as total_sales,
          COALESCE(SUM(s.discount), 0) as total_discount,
          COALESCE(SUM(s.tax), 0) as total_tax,
          COUNT(*)::int as total_orders,
          COALESCE(AVG(s.total), 0) as avg_order_value
         FROM sales s ${whereClause}`,
        params
      );

      // Time-grouped data
      let dateFormat = 'YYYY-MM-DD';
      if (groupBy === 'month') dateFormat = 'YYYY-MM';
      if (groupBy === 'hour') dateFormat = 'YYYY-MM-DD HH24:00';

      const groupedResult = await db.query(
        `SELECT
          TO_CHAR(s.created_at, '${dateFormat}') as period,
          COUNT(*)::int as orders,
          COALESCE(SUM(s.subtotal), 0) as subtotal,
          COALESCE(SUM(s.discount), 0) as discount,
          COALESCE(SUM(s.tax), 0) as tax,
          COALESCE(SUM(s.total), 0) as total
         FROM sales s ${whereClause}
         GROUP BY TO_CHAR(s.created_at, '${dateFormat}')
         ORDER BY period DESC`,
        params
      );

      // Paginated transaction list
      const queryParams = [...params, Number(limit), offset];
      const limitIdx = paramIdx++;
      const offsetIdx = paramIdx++;

      const transactions = await db.query(
        `SELECT s.*, u.name as cashier_name, c.name as customer_name,
          (SELECT COUNT(*)::int FROM sale_items WHERE sale_id = s.id) as item_count
         FROM sales s
         LEFT JOIN users u ON s.cashier_id = u.id
         LEFT JOIN customers c ON s.customer_id = c.id
         ${whereClause}
         ORDER BY s.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        queryParams
      );

      const countResult = await db.query<{ count: string | number }>(
        `SELECT COUNT(*) as count FROM sales s ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.count || 0);

      res.json({
        success: true,
        data: {
          summary: summaryResult.rows[0],
          grouped: groupedResult.rows,
          transactions: transactions.rows,
        },
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports/inventory — Current inventory valuation and status report
router.get(
  '/inventory',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { categoryId, distributorId, lowStockOnly } = req.query;
      const where: string[] = ["p.status = 'active'"];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (categoryId) {
        where.push(`p.category_id = $${paramIdx++}`);
        params.push(Number(categoryId));
      }
      if (distributorId) {
        where.push(`p.distributor_id = $${paramIdx++}`);
        params.push(Number(distributorId));
      }
      if (lowStockOnly === 'true') {
        where.push('p.stock <= p.min_stock');
      }

      const whereClause = `WHERE ${where.join(' AND ')}`;

      // Summary
      const summaryResult = await db.query<{
        total_products: number;
        total_units: string | number;
        total_retail_value: string | number;
        total_cost_value: string | number;
        potential_profit: string | number;
        low_stock_count: number;
        out_of_stock_count: number;
      }>(
        `SELECT
          COUNT(*)::int as total_products,
          COALESCE(SUM(stock), 0) as total_units,
          COALESCE(SUM(stock * price), 0) as total_retail_value,
          COALESCE(SUM(stock * cost_price), 0) as total_cost_value,
          COALESCE(SUM(stock * (price - cost_price)), 0) as potential_profit,
          SUM(CASE WHEN stock <= min_stock AND stock > 0 THEN 1 ELSE 0 END)::int as low_stock_count,
          SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END)::int as out_of_stock_count
         FROM products p ${whereClause}`,
        params
      );

      // By category breakdown
      const byCategory = await db.query(
        `SELECT
          c.name as category_name,
          COUNT(p.id)::int as product_count,
          COALESCE(SUM(p.stock), 0) as total_units,
          COALESCE(SUM(p.stock * p.price), 0) as retail_value,
          COALESCE(SUM(p.stock * p.cost_price), 0) as cost_value
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${whereClause}
         GROUP BY c.id, c.name
         ORDER BY retail_value DESC`,
        params
      );

      res.json({
        success: true,
        data: {
          summary: summaryResult.rows[0],
          byCategory: byCategory.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports/profit-loss — Profit & Loss statement
router.get(
  '/profit-loss',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const params: unknown[] = [];
      let dateFilterSales = '';
      let dateFilterExpenses = '';

      if (from && to) {
        dateFilterSales = 'AND s.created_at >= $1 AND s.created_at <= $2';
        dateFilterExpenses = 'WHERE created_at >= $1 AND created_at <= $2';
        params.push(from, to);
      } else if (from) {
        dateFilterSales = 'AND s.created_at >= $1';
        dateFilterExpenses = 'WHERE created_at >= $1';
        params.push(from);
      } else if (to) {
        dateFilterSales = 'AND s.created_at <= $1';
        dateFilterExpenses = 'WHERE created_at <= $1';
        params.push(to);
      }

      // Revenue & COGS from sales
      const salesResult = await db.query<{
        gross_revenue: string | number;
        total_discount: string | number;
        net_revenue: string | number;
        total_tax: string | number;
        cogs: string | number;
        gross_profit: string | number;
      }>(
        `SELECT
          COALESCE(SUM(si.quantity * si.price), 0) as gross_revenue,
          COALESCE(SUM(si.discount), 0) + COALESCE((SELECT SUM(discount) FROM sales s WHERE s.status != 'voided' ${dateFilterSales}), 0) as total_discount,
          COALESCE((SELECT SUM(total) FROM sales s WHERE s.status != 'voided' ${dateFilterSales}), 0) as net_revenue,
          COALESCE((SELECT SUM(tax) FROM sales s WHERE s.status != 'voided' ${dateFilterSales}), 0) as total_tax,
          COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs,
          COALESCE(SUM(si.quantity * (si.price - si.cost_price)), 0) as gross_profit
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.status != 'voided' ${dateFilterSales}`,
        params
      );

      // Operating Expenses
      const expenseSummary = await db.query<{ total: string | number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${dateFilterExpenses}`,
        params
      );

      const expenseByCategory = await db.query(
        `SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*)::int as count
         FROM expenses ${dateFilterExpenses}
         GROUP BY category ORDER BY total DESC`,
        params
      );

      const sales = salesResult.rows[0];
      const grossProfit = Number(sales?.gross_profit || 0);
      const totalExpenses = Number(expenseSummary.rows[0]?.total || 0);
      const netProfit = grossProfit - totalExpenses;
      const netMargin =
        Number(sales?.net_revenue || 0) > 0
          ? Math.round((netProfit / Number(sales.net_revenue)) * 10000) / 100
          : 0;

      res.json({
        success: true,
        data: {
          revenue: {
            gross: Number(sales?.gross_revenue || 0),
            discount: Number(sales?.total_discount || 0),
            net: Number(sales?.net_revenue || 0),
            tax: Number(sales?.total_tax || 0),
          },
          costOfGoodsSold: Number(sales?.cogs || 0),
          grossProfit,
          grossMargin:
            Number(sales?.net_revenue || 0) > 0
              ? Math.round((grossProfit / Number(sales.net_revenue)) * 10000) / 100
              : 0,
          operatingExpenses: {
            total: totalExpenses,
            breakdown: expenseByCategory.rows,
          },
          netProfit,
          netMargin,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
