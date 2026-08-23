import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { DashboardKpis, InventorySnapshot } from './types';

export interface IAnalyticsRepository {
  getAggregatePage<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[],
    page: number,
    pageSize: number,
    queryable?: Queryable
  ): Promise<{ rows: T[]; totalItems: number }>;
  getAggregate<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<T | undefined>;
  refreshAbcClasses(queryable?: Queryable): Promise<void>;
  getDashboardKpis(queryable?: Queryable): Promise<DashboardKpis>;
  getRevenueByDateRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ date: string; revenue: string | number }>>;
  getTopProductsRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ name: string; total_sold: string | number; total_revenue: string | number }>>;
  getPaymentMethodBreakdownRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ payment_method: string; count: string | number; revenue: string | number }>>;
  getOrdersPerDayRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ date: string; orders: string | number }>>;
  getCashierPerformanceRaw(
    saleDateFilter: string,
    siDateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<
    Array<{
      cashier_id: number;
      cashier_name: string;
      total_sales: string | number;
      total_revenue: string | number;
      avg_order_value: string | number;
      total_items: string | number;
    }>
  >;
  getSalesByCategoryRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<
    Array<{ category_name: string; total_sold: string | number; revenue: string | number }>
  >;
  getSalesByDistributorRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<
    Array<{ distributor_name: string; total_sold: string | number; revenue: string | number }>
  >;
  getAbcRawProducts(queryable?: Queryable): Promise<
    Array<{
      id: number;
      name: string;
      sku: string;
      stock: number;
      price: string | number;
      abc_class: string;
      revenue: string | number;
      units_sold: string | number;
    }>
  >;
  updateProductAbcClass(id: number, abcClass: string, queryable?: Queryable): Promise<void>;
  getReorderRawProducts(queryable?: Queryable): Promise<
    Array<{
      id: number;
      name: string;
      sku: string;
      stock: number;
      min_stock: number;
      price: string | number;
      cost_price: string | number;
      lead_time_days: number;
      reorder_qty: number;
      sold_last_30d: string | number;
    }>
  >;
  getActiveProductsForSnapshot(
    queryable?: Queryable
  ): Promise<
    Array<{ id: number; stock: number; cost_price: string | number; price: string | number }>
  >;
  insertInventorySnapshot(
    totalProducts: number,
    totalUnits: number,
    totalCostValue: number,
    totalRetailValue: number,
    snapshotData: string,
    queryable?: Queryable
  ): Promise<Record<string, unknown>>;
  getDeadStockRaw(
    days: number,
    queryable?: Queryable
  ): Promise<
    Array<{
      id: number;
      name: string;
      sku: string;
      category: string;
      stock: number;
      price: string | number;
      cost_price: string | number;
      tied_up_capital: string | number;
      last_sold_date: string | null;
      days_inactive: string | number;
    }>
  >;
  getCustomerLtvRaw(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<
    Array<{
      id: number;
      name: string;
      phone: string | null;
      order_count: string | number;
      lifetime_revenue: string | number;
      avg_order_value: string | number;
      first_purchase: string;
      last_purchase: string;
      tenure_days: string | number;
      recency_days: string | number;
    }>
  >;
  getHourlyHeatmapRaw(
    days: number,
    queryable?: Queryable
  ): Promise<
    Array<{
      day_of_week: number;
      hour: number;
      order_count: string | number;
      revenue: string | number;
    }>
  >;
  getInventorySnapshots(queryable?: Queryable): Promise<Omit<InventorySnapshot, 'snapshot_data'>[]>;
}

export class AnalyticsRepository implements IAnalyticsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async getAggregatePage<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[],
    page: number,
    pageSize: number,
    queryable?: Queryable
  ): Promise<{ rows: T[]; totalItems: number }> {
    const count = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM (${sql}) intelligence_rows`,
      params
    );
    const rows = await this.q(queryable).query<T>(
      `${sql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { rows: rows.rows, totalItems: Number(count.rows[0]?.count ?? 0) };
  }

  async getAggregate<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<T | undefined> {
    const result = await this.q(queryable).query<T>(sql, params);
    return result.rows[0];
  }

  async refreshAbcClasses(queryable?: Queryable): Promise<void> {
    await this.q(queryable).query(
      `WITH revenue AS (
         SELECT p.id, COALESCE(SUM(si.quantity * si.unit_price) FILTER (WHERE s.id IS NOT NULL), 0) AS revenue
         FROM products p LEFT JOIN sale_items si ON si.product_id = p.id
         LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= CURRENT_DATE - INTERVAL '90 days'
         WHERE p.status = 'active' GROUP BY p.id
       ), ranked AS (
         SELECT id, CASE WHEN SUM(revenue) OVER () = 0 THEN 100
                    ELSE SUM(revenue) OVER (ORDER BY revenue DESC, id ASC) / SUM(revenue) OVER () * 100 END AS cumulative_pct
         FROM revenue
       )
       UPDATE products p SET abc_class = CASE WHEN ranked.cumulative_pct <= 80 THEN 'A'
                                              WHEN ranked.cumulative_pct <= 95 THEN 'B' ELSE 'C' END
       FROM ranked WHERE p.id = ranked.id`
    );
  }

  async getDashboardKpis(queryable?: Queryable): Promise<DashboardKpis> {
    const todayRevenue = await this.q(queryable).query<{ revenue: string | number }>(
      `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue
       FROM sales WHERE created_at::date = CURRENT_DATE`
    );
    const monthRevenue = await this.q(queryable).query<{ revenue: string | number }>(
      `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue
       FROM sales WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)`
    );
    const totalSales = await this.q(queryable).query<{ count: string | number }>(
      'SELECT COUNT(*) as count FROM sales'
    );
    const pendingDeliveries = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM delivery_orders WHERE status IN ('Pending', 'Preparing', 'Out for Delivery')`
    );
    const lowStock = await this.q(queryable).query<{ count: string | number }>(
      "SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND status = 'active'"
    );

    const monthProfit = await this.q(queryable).query<{ profit: string | number }>(
      `SELECT COALESCE(SUM((si.unit_price - si.cost_price) * si.quantity), 0) as profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.created_at >= DATE_TRUNC('month', CURRENT_DATE)`
    );

    return {
      today_revenue: Number(todayRevenue.rows[0]?.revenue || 0),
      month_revenue: Number(monthRevenue.rows[0]?.revenue || 0),
      month_profit: Number(monthProfit.rows[0]?.profit || 0),
      total_sales: Number(totalSales.rows[0]?.count || 0),
      pending_deliveries: Number(pendingDeliveries.rows[0]?.count || 0),
      low_stock_items: Number(lowStock.rows[0]?.count || 0),
    };
  }

  async getRevenueByDateRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ date: string; revenue: string | number }>> {
    const result = await this.q(queryable).query<{ date: string; revenue: string | number }>(
      `SELECT created_at::date::text as date, COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE ${dateFilter}
       GROUP BY created_at::date
       ORDER BY date`,
      params
    );
    return result.rows;
  }

  async getTopProductsRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ name: string; total_sold: string | number; total_revenue: string | number }>> {
    const result = await this.q(queryable).query<{
      name: string;
      total_sold: string | number;
      total_revenue: string | number;
    }>(
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
    return result.rows;
  }

  async getPaymentMethodBreakdownRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ payment_method: string; count: string | number; revenue: string | number }>> {
    const result = await this.q(queryable).query<{
      payment_method: string;
      count: string | number;
      revenue: string | number;
    }>(
      `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE ${dateFilter}
       GROUP BY payment_method
       ORDER BY count DESC`,
      params
    );
    return result.rows;
  }

  async getOrdersPerDayRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Array<{ date: string; orders: string | number }>> {
    const result = await this.q(queryable).query<{ date: string; orders: string | number }>(
      `SELECT created_at::date::text as date, COUNT(*) as orders
       FROM sales
       WHERE ${dateFilter}
       GROUP BY created_at::date
       ORDER BY date`,
      params
    );
    return result.rows;
  }

  async getCashierPerformanceRaw(
    saleDateFilter: string,
    siDateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<
    Array<{
      cashier_id: number;
      cashier_name: string;
      total_sales: string | number;
      total_revenue: string | number;
      avg_order_value: string | number;
      total_items: string | number;
    }>
  > {
    const result = await this.q(queryable).query<{
      cashier_id: number;
      cashier_name: string;
      total_sales: string | number;
      total_revenue: string | number;
      avg_order_value: string | number;
      total_items: string | number;
    }>(
      `SELECT u.id as cashier_id, u.name as cashier_name,
              s_agg.total_sales, s_agg.total_revenue, s_agg.avg_order_value,
              COALESCE(si_agg.total_items, 0) as total_items
       FROM (
         SELECT cashier_id,
                COUNT(*) as total_sales,
                COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as total_revenue,
                ROUND(COALESCE(AVG(total), 0)::numeric, 2) as avg_order_value
         FROM sales
         WHERE ${saleDateFilter}
         GROUP BY cashier_id
       ) s_agg
       JOIN users u ON s_agg.cashier_id = u.id
       LEFT JOIN (
         SELECT s2.cashier_id, SUM(si.quantity) as total_items
         FROM sale_items si
         JOIN sales s2 ON si.sale_id = s2.id
         WHERE ${siDateFilter}
         GROUP BY s2.cashier_id
       ) si_agg ON si_agg.cashier_id = u.id
       ORDER BY s_agg.total_revenue DESC`,
      params
    );
    return result.rows;
  }

  async getSalesByCategoryRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<
    Array<{ category_name: string; total_sold: string | number; revenue: string | number }>
  > {
    const result = await this.q(queryable).query<{
      category_name: string;
      total_sold: string | number;
      revenue: string | number;
    }>(
      `SELECT COALESCE(c.name, p.category, 'Uncategorized') as category_name,
              SUM(si.quantity) as total_sold,
              COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE ${dateFilter}
       GROUP BY COALESCE(c.name, p.category, 'Uncategorized')
       ORDER BY revenue DESC`,
      params
    );
    return result.rows;
  }

  async getSalesByDistributorRaw(
    dateFilter: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<
    Array<{ distributor_name: string; total_sold: string | number; revenue: string | number }>
  > {
    const result = await this.q(queryable).query<{
      distributor_name: string;
      total_sold: string | number;
      revenue: string | number;
    }>(
      `SELECT COALESCE(d.name, 'No Distributor') as distributor_name,
              SUM(si.quantity) as total_sold,
              COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON si.product_id = p.id
       LEFT JOIN distributors d ON p.distributor_id = d.id
       WHERE ${dateFilter}
       GROUP BY COALESCE(d.name, 'No Distributor')
       ORDER BY revenue DESC`,
      params
    );
    return result.rows;
  }

  async getAbcRawProducts(queryable?: Queryable): Promise<
    Array<{
      id: number;
      name: string;
      sku: string;
      stock: number;
      price: string | number;
      abc_class: string;
      revenue: string | number;
      units_sold: string | number;
    }>
  > {
    const result = await this.q(queryable).query<{
      id: number;
      name: string;
      sku: string;
      stock: number;
      price: string | number;
      abc_class: string;
      revenue: string | number;
      units_sold: string | number;
    }>(
      `SELECT p.id, p.name, p.sku, p.stock, p.price, p.abc_class,
              COALESCE(SUM(si.quantity * si.unit_price), 0) as revenue,
              COALESCE(SUM(si.quantity), 0) as units_sold
       FROM products p
       LEFT JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= CURRENT_DATE - INTERVAL '90 days'
       WHERE p.status = 'active'
       GROUP BY p.id
       ORDER BY revenue DESC`
    );
    return result.rows;
  }

  async updateProductAbcClass(id: number, abcClass: string, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query('UPDATE products SET abc_class = $1 WHERE id = $2', [
      abcClass,
      id,
    ]);
  }

  async getReorderRawProducts(queryable?: Queryable): Promise<
    Array<{
      id: number;
      name: string;
      sku: string;
      stock: number;
      min_stock: number;
      price: string | number;
      cost_price: string | number;
      lead_time_days: number;
      reorder_qty: number;
      sold_last_30d: string | number;
    }>
  > {
    const result = await this.q(queryable).query<{
      id: number;
      name: string;
      sku: string;
      stock: number;
      min_stock: number;
      price: string | number;
      cost_price: string | number;
      lead_time_days: number;
      reorder_qty: number;
      sold_last_30d: string | number;
    }>(
      `SELECT p.id, p.name, p.sku, p.stock, p.min_stock, p.price, p.cost_price,
              p.lead_time_days, p.reorder_qty,
              COALESCE(
                (SELECT SUM(si.quantity) FROM sale_items si
                 JOIN sales s ON si.sale_id = s.id
                 WHERE si.product_id = p.id AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'),
                0
              ) as sold_last_30d
       FROM products p
       WHERE p.status = 'active' AND p.stock <= p.min_stock
       ORDER BY p.stock ASC`
    );
    return result.rows;
  }

  async getActiveProductsForSnapshot(
    queryable?: Queryable
  ): Promise<
    Array<{ id: number; stock: number; cost_price: string | number; price: string | number }>
  > {
    const result = await this.q(queryable).query<{
      id: number;
      stock: number;
      cost_price: string | number;
      price: string | number;
    }>(`SELECT id, stock, cost_price, price FROM products WHERE status = 'active'`);
    return result.rows;
  }

  async insertInventorySnapshot(
    totalProducts: number,
    totalUnits: number,
    totalCostValue: number,
    totalRetailValue: number,
    snapshotData: string,
    queryable?: Queryable
  ): Promise<Record<string, unknown>> {
    const result = await this.q(queryable).query<Record<string, unknown>>(
      `INSERT INTO inventory_snapshots (total_products, total_units, total_cost_value, total_retail_value, snapshot_data)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [totalProducts, totalUnits, totalCostValue, totalRetailValue, snapshotData]
    );
    return result.rows[0];
  }

  async getDeadStockRaw(
    days: number,
    queryable?: Queryable
  ): Promise<
    Array<{
      id: number;
      name: string;
      sku: string;
      category: string;
      stock: number;
      price: string | number;
      cost_price: string | number;
      tied_up_capital: string | number;
      last_sold_date: string | null;
      days_inactive: string | number;
    }>
  > {
    const result = await this.q(queryable).query<{
      id: number;
      name: string;
      sku: string;
      category: string;
      stock: number;
      price: string | number;
      cost_price: string | number;
      tied_up_capital: string | number;
      last_sold_date: string | null;
      days_inactive: string | number;
    }>(
      `SELECT p.id, p.name, p.sku,
              COALESCE(c.name, p.category, 'Uncategorized') as category,
              p.stock, p.price, COALESCE(p.cost_price, 0) as cost_price,
              (p.stock * COALESCE(p.cost_price, 0)) as tied_up_capital,
              MAX(s.created_at)::text as last_sold_date,
              FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(MAX(s.created_at), p.created_at))) / 86400.0)::int as days_inactive
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN sale_items si ON si.product_id = p.id
       LEFT JOIN sales s ON si.sale_id = s.id
       WHERE p.status = 'active' AND p.stock > 0
       GROUP BY p.id, c.name, p.category, p.created_at
       HAVING FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(MAX(s.created_at), p.created_at))) / 86400.0) >= $1
       ORDER BY tied_up_capital DESC`,
      [days]
    );
    return result.rows;
  }

  async getCustomerLtvRaw(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<
    Array<{
      id: number;
      name: string;
      phone: string | null;
      order_count: string | number;
      lifetime_revenue: string | number;
      avg_order_value: string | number;
      first_purchase: string;
      last_purchase: string;
      tenure_days: string | number;
      recency_days: string | number;
    }>
  > {
    const result = await this.q(queryable).query<{
      id: number;
      name: string;
      phone: string | null;
      order_count: string | number;
      lifetime_revenue: string | number;
      avg_order_value: string | number;
      first_purchase: string;
      last_purchase: string;
      tenure_days: string | number;
      recency_days: string | number;
    }>(
      `SELECT c.id, c.name, COALESCE(c.phone, '') as phone,
              COUNT(DISTINCT s.id)::int as order_count,
              COALESCE(SUM(s.total - COALESCE(s.refunded_amount, 0)), 0) as lifetime_revenue,
              ROUND(COALESCE(AVG(s.total), 0)::numeric, 2) as avg_order_value,
              MIN(s.created_at)::text as first_purchase,
              MAX(s.created_at)::text as last_purchase,
              FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MIN(s.created_at))) / 86400.0)::int as tenure_days,
              FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(s.created_at))) / 86400.0)::int as recency_days
       FROM customers c
       INNER JOIN sales s ON c.id = s.customer_id
       WHERE 1=1 ${whereClause}
       GROUP BY c.id
       ORDER BY lifetime_revenue DESC`,
      params
    );
    return result.rows;
  }

  async getHourlyHeatmapRaw(
    days: number,
    queryable?: Queryable
  ): Promise<
    Array<{
      day_of_week: number;
      hour: number;
      order_count: string | number;
      revenue: string | number;
    }>
  > {
    const result = await this.q(queryable).query<{
      day_of_week: number;
      hour: number;
      order_count: string | number;
      revenue: string | number;
    }>(
      `SELECT
         EXTRACT(DOW FROM created_at)::int as day_of_week,
         EXTRACT(HOUR FROM created_at)::int as hour,
         COUNT(*)::int as order_count,
         COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE created_at >= CURRENT_DATE - ($1 || ' days')::interval
       GROUP BY EXTRACT(DOW FROM created_at), EXTRACT(HOUR FROM created_at)
       ORDER BY day_of_week, hour`,
      [days]
    );
    return result.rows;
  }

  async getInventorySnapshots(
    queryable?: Queryable
  ): Promise<Omit<InventorySnapshot, 'snapshot_data'>[]> {
    const result = await this.q(queryable).query<Omit<InventorySnapshot, 'snapshot_data'>>(
      `SELECT id, total_products, total_units, total_cost_value, total_retail_value, created_at
       FROM inventory_snapshots ORDER BY created_at DESC LIMIT 30`
    );
    return result.rows;
  }
}

export const analyticsRepository = new AnalyticsRepository();
