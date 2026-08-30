import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  SalesReportSummary,
  SalesReportGroupedItem,
  InventoryReportSummary,
  InventoryReportCategoryItem,
} from './types';

export interface IReportsRepository {
  getSalesReportSummary(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<SalesReportSummary | null>;
  getSalesReportGrouped(
    dateFormat: string,
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<SalesReportGroupedItem[]>;
  getSalesReportTransactions(
    whereClause: string,
    params: unknown[],
    limitIdx: number,
    offsetIdx: number,
    limit: number,
    offset: number,
    queryable?: Queryable
  ): Promise<Record<string, unknown>[]>;
  getSalesReportCount(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<number>;
  getInventoryReportSummary(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<InventoryReportSummary | null>;
  getInventoryReportByCategory(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<InventoryReportCategoryItem[]>;
  getProfitLossSales(
    dateFilterSales: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Record<string, unknown> | null>;
  getProfitLossExpenseSummary(
    dateFilterExpenses: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<{ total: string | number } | null>;
  getProfitLossExpenseByCategory(
    dateFilterExpenses: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ category: string; total: string | number; count: number }>>;
}

export class ReportsRepository implements IReportsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async getSalesReportSummary(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<SalesReportSummary | null> {
    const result = await this.q(queryable).query<SalesReportSummary>(
      `SELECT
        COALESCE(SUM(s.total), 0) as total_sales,
        COALESCE(SUM(s.discount), 0) as total_discount,
        COALESCE(SUM(s.tax), 0) as total_tax,
        COUNT(*)::int as total_orders,
        COALESCE(AVG(s.total), 0) as avg_order_value
       FROM sales s ${whereClause}`,
      params
    );
    return result.rows[0] || null;
  }

  async getSalesReportGrouped(
    dateFormat: string,
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<SalesReportGroupedItem[]> {
    const result = await this.q(queryable).query<SalesReportGroupedItem>(
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
    return result.rows;
  }

  async getSalesReportTransactions(
    whereClause: string,
    params: unknown[],
    limitIdx: number,
    offsetIdx: number,
    limit: number,
    offset: number,
    queryable?: Queryable
  ): Promise<Record<string, unknown>[]> {
    const queryParams = [...params, limit, offset];
    const result = await this.q(queryable).query<Record<string, unknown>>(
      `SELECT s.id, s.receipt_number, s.subtotal, s.tax, s.tax_amount, s.total, s.discount, s.discount_type,
              s.payment_method, s.status, s.cashier_id, s.customer_id, s.notes, s.created_at, s.updated_at,
              u.name as cashier_name, c.name as customer_name,
              COUNT(si.id)::int as item_count
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN sale_items si ON si.sale_id = s.id
       ${whereClause}
       GROUP BY s.id, s.receipt_number, s.subtotal, s.tax, s.tax_amount, s.total, s.discount, s.discount_type,
                s.payment_method, s.status, s.cashier_id, s.customer_id, s.notes, s.created_at, s.updated_at,
                u.name, c.name
       ORDER BY s.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );
    return result.rows;
  }

  async getSalesReportCount(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<number> {
    const countResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM sales s ${whereClause}`,
      params
    );
    return Number(countResult.rows[0]?.count || 0);
  }

  async getInventoryReportSummary(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<InventoryReportSummary | null> {
    const result = await this.q(queryable).query<InventoryReportSummary>(
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
    return result.rows[0] || null;
  }

  async getInventoryReportByCategory(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<InventoryReportCategoryItem[]> {
    const result = await this.q(queryable).query<InventoryReportCategoryItem>(
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
    return result.rows;
  }

  async getProfitLossSales(
    dateFilterSales: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Record<string, unknown> | null> {
    const result = await this.q(queryable).query<Record<string, unknown>>(
      `SELECT
        COALESCE(SUM(si.quantity * si.unit_price), 0) as gross_revenue,
        COALESCE(SUM(si.discount), 0) + COALESCE((SELECT SUM(discount) FROM sales s WHERE s.status != 'voided' ${dateFilterSales}), 0) as total_discount,
        COALESCE((SELECT SUM(total) FROM sales s WHERE s.status != 'voided' ${dateFilterSales}), 0) as net_revenue,
        COALESCE((SELECT SUM(tax) FROM sales s WHERE s.status != 'voided' ${dateFilterSales}), 0) as total_tax,
        COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs,
        COALESCE(SUM(si.quantity * (si.unit_price - si.cost_price)), 0) as gross_profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.status != 'voided' ${dateFilterSales}`,
      params
    );
    return result.rows[0] || null;
  }

  async getProfitLossExpenseSummary(
    dateFilterExpenses: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<{ total: string | number } | null> {
    const result = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${dateFilterExpenses}`,
      params
    );
    return result.rows[0] || null;
  }

  async getProfitLossExpenseByCategory(
    dateFilterExpenses: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ category: string; total: string | number; count: number }>> {
    const result = await this.q(queryable).query<{
      category: string;
      total: string | number;
      count: number;
    }>(
      `SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*)::int as count
       FROM expenses ${dateFilterExpenses}
       GROUP BY category ORDER BY total DESC`,
      params
    );
    return result.rows;
  }
}

export const reportsRepository = new ReportsRepository();
