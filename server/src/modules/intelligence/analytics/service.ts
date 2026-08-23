import { withTransaction } from '../../../database/transaction';
import { IAnalyticsRepository, analyticsRepository as defaultRepo } from './repository';
import {
  DashboardKpis,
  RevenueByDate,
  TopProduct,
  PaymentMethodRow,
  OrdersPerDay,
  CashierPerformanceRow,
  SalesByCategoryRow,
  SalesByDistributorRow,
  AbcClassificationResult,
  ReorderSuggestion,
  InventorySnapshot,
  DeadStockResult,
  CustomerLtvResult,
  HourlyHeatmapRow,
  DashboardAllData,
  AnalyticsPagedResult,
} from './types';

function buildDateFilter(
  from: unknown,
  to: unknown,
  dateColumn: string,
  startIdx: number = 1
): { dateFilter: string; params: unknown[]; nextIdx: number } {
  if (from && to) {
    return {
      dateFilter: `${dateColumn} >= $${startIdx} AND ${dateColumn} <= $${startIdx + 1}`,
      params: [from, to + ' 23:59:59'],
      nextIdx: startIdx + 2,
    };
  }
  return {
    dateFilter: `${dateColumn} >= CURRENT_DATE - INTERVAL '30 days'`,
    params: [],
    nextIdx: startIdx,
  };
}

export class AnalyticsService {
  constructor(private repo: IAnalyticsRepository = defaultRepo) {}

  getRepository(): IAnalyticsRepository {
    return this.repo;
  }

  async getDashboardKpis(): Promise<DashboardKpis> {
    return this.repo.getDashboardKpis();
  }

  async getRevenueByDate(from?: unknown, to?: unknown): Promise<RevenueByDate[]> {
    const { dateFilter, params } = buildDateFilter(from, to, 'created_at');
    const rows = await this.repo.getRevenueByDateRaw(dateFilter, params);
    return rows.map((r) => ({ date: r.date, revenue: Number(r.revenue) }));
  }

  async getTopProducts(from?: unknown, to?: unknown): Promise<TopProduct[]> {
    const { dateFilter, params } = buildDateFilter(from, to, 's.created_at');
    const rows = await this.repo.getTopProductsRaw(dateFilter, params);
    return rows.map((r) => ({
      name: r.name,
      total_sold: Number(r.total_sold),
      total_revenue: Number(r.total_revenue),
    }));
  }

  async getTopProductsPage(
    page: number,
    pageSize: number,
    from?: unknown,
    to?: unknown
  ): Promise<AnalyticsPagedResult<TopProduct>> {
    const { dateFilter, params } = buildDateFilter(from, to, 's.created_at');
    const result = await this.repo.getAggregatePage<{
      name: string;
      total_sold: string | number;
      total_revenue: string | number;
    }>(
      `SELECT p.name, SUM(si.quantity) AS total_sold, SUM(si.quantity * si.unit_price) AS total_revenue
       FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id
       WHERE ${dateFilter} GROUP BY p.id, p.name ORDER BY total_sold DESC, p.id ASC`,
      params,
      page,
      pageSize
    );
    return {
      items: result.rows.map((r) => ({
        name: r.name,
        total_sold: Number(r.total_sold),
        total_revenue: Number(r.total_revenue),
      })),
      totalItems: result.totalItems,
    };
  }

  async getSalesByCategoryPage(
    page: number,
    pageSize: number,
    from?: unknown,
    to?: unknown
  ): Promise<AnalyticsPagedResult<SalesByCategoryRow>> {
    const { dateFilter, params } = buildDateFilter(from, to, 's.created_at');
    const result = await this.repo.getAggregatePage<{
      category_name: string;
      total_sold: string | number;
      revenue: string | number;
    }>(
      `SELECT COALESCE(c.name, p.category, 'Uncategorized') AS category_name, SUM(si.quantity) AS total_sold,
              COALESCE(SUM(si.quantity * si.unit_price), 0) AS revenue
       FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id WHERE ${dateFilter}
       GROUP BY COALESCE(c.name, p.category, 'Uncategorized') ORDER BY revenue DESC, category_name ASC`,
      params,
      page,
      pageSize
    );
    return {
      items: result.rows.map((r) => ({
        category_name: r.category_name,
        total_sold: Number(r.total_sold),
        revenue: Number(r.revenue),
      })),
      totalItems: result.totalItems,
    };
  }

  async getSalesByDistributorPage(
    page: number,
    pageSize: number,
    from?: unknown,
    to?: unknown
  ): Promise<AnalyticsPagedResult<SalesByDistributorRow>> {
    const { dateFilter, params } = buildDateFilter(from, to, 's.created_at');
    const result = await this.repo.getAggregatePage<{
      distributor_name: string;
      total_sold: string | number;
      revenue: string | number;
    }>(
      `SELECT COALESCE(d.name, 'No Distributor') AS distributor_name, SUM(si.quantity) AS total_sold,
              COALESCE(SUM(si.quantity * si.unit_price), 0) AS revenue
       FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN products p ON si.product_id = p.id
       LEFT JOIN distributors d ON p.distributor_id = d.id WHERE ${dateFilter}
       GROUP BY COALESCE(d.name, 'No Distributor') ORDER BY revenue DESC, distributor_name ASC`,
      params,
      page,
      pageSize
    );
    return {
      items: result.rows.map((r) => ({
        distributor_name: r.distributor_name,
        total_sold: Number(r.total_sold),
        revenue: Number(r.revenue),
      })),
      totalItems: result.totalItems,
    };
  }

  async getInventorySnapshotsPage(
    page: number,
    pageSize: number
  ): Promise<AnalyticsPagedResult<Omit<InventorySnapshot, 'snapshot_data'>>> {
    const result = await this.repo.getAggregatePage<
      Omit<InventorySnapshot, 'snapshot_data'> & Record<string, unknown>
    >(
      `SELECT id, total_products, total_units, total_cost_value, total_retail_value, created_at
       FROM inventory_snapshots ORDER BY created_at DESC, id DESC`,
      [],
      page,
      pageSize
    );
    return { items: result.rows, totalItems: result.totalItems };
  }

  async getPaymentMethodBreakdown(from?: unknown, to?: unknown): Promise<PaymentMethodRow[]> {
    const { dateFilter, params } = buildDateFilter(from, to, 'created_at');
    const rows = await this.repo.getPaymentMethodBreakdownRaw(dateFilter, params);
    return rows.map((r) => ({
      payment_method: r.payment_method,
      count: Number(r.count),
      revenue: Number(r.revenue),
    }));
  }

  async getOrdersPerDay(from?: unknown, to?: unknown): Promise<OrdersPerDay[]> {
    const { dateFilter, params } = buildDateFilter(from, to, 'created_at');
    const rows = await this.repo.getOrdersPerDayRaw(dateFilter, params);
    return rows.map((r) => ({ date: r.date, orders: Number(r.orders) }));
  }

  async getCashierPerformance(from?: unknown, to?: unknown): Promise<CashierPerformanceRow[]> {
    const {
      dateFilter: saleDateFilter,
      params: saleParams,
      nextIdx,
    } = buildDateFilter(from, to, 'created_at', 1);
    const { dateFilter: siDateFilter, params: siParams } = buildDateFilter(
      from,
      to,
      's2.created_at',
      nextIdx
    );

    const rows = await this.repo.getCashierPerformanceRaw(saleDateFilter, siDateFilter, [
      ...saleParams,
      ...siParams,
    ]);

    return rows.map((r) => ({
      cashier_id: r.cashier_id,
      cashier_name: r.cashier_name,
      total_sales: Number(r.total_sales),
      total_revenue: Number(r.total_revenue),
      avg_order_value: Number(r.avg_order_value),
      total_items: Number(r.total_items),
    }));
  }

  async getSalesByCategory(from?: unknown, to?: unknown): Promise<SalesByCategoryRow[]> {
    const { dateFilter, params } = buildDateFilter(from, to, 's.created_at');
    const rows = await this.repo.getSalesByCategoryRaw(dateFilter, params);
    return rows.map((r) => ({
      category_name: r.category_name,
      total_sold: Number(r.total_sold),
      revenue: Number(r.revenue),
    }));
  }

  async getSalesByDistributor(from?: unknown, to?: unknown): Promise<SalesByDistributorRow[]> {
    const { dateFilter, params } = buildDateFilter(from, to, 's.created_at');
    const rows = await this.repo.getSalesByDistributorRaw(dateFilter, params);
    return rows.map((r) => ({
      distributor_name: r.distributor_name,
      total_sold: Number(r.total_sold),
      revenue: Number(r.revenue),
    }));
  }

  async getDashboardAll(from?: unknown, to?: unknown): Promise<DashboardAllData> {
    const [
      kpis,
      revenue,
      topProducts,
      paymentMethods,
      ordersPerDay,
      cashierPerformance,
      categorySales,
      distributorSales,
    ] = await Promise.all([
      this.getDashboardKpis(),
      this.getRevenueByDate(from, to),
      this.getTopProducts(from, to),
      this.getPaymentMethodBreakdown(from, to),
      this.getOrdersPerDay(from, to),
      this.getCashierPerformance(from, to),
      this.getSalesByCategory(from, to),
      this.getSalesByDistributor(from, to),
    ]);

    return {
      kpis,
      revenue,
      topProducts,
      paymentMethods,
      ordersPerDay,
      cashierPerformance,
      categorySales,
      distributorSales,
    };
  }

  async getAbcClassification(): Promise<AbcClassificationResult> {
    const rawProducts = await this.repo.getAbcRawProducts();

    const products = rawProducts.map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      stock: r.stock,
      price: Number(r.price),
      abc_class: r.abc_class,
      revenue: Number(r.revenue),
      units_sold: Number(r.units_sold),
      revenue_pct: 0,
      cumulative_pct: 0,
    }));
    const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);

    let cumulative = 0;
    for (const product of products) {
      cumulative += product.revenue;
      const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 100;
      let newClass = 'C';
      if (pct <= 80) newClass = 'A';
      else if (pct <= 95) newClass = 'B';

      product.abc_class = newClass;
      product.revenue_pct =
        totalRevenue > 0 ? Math.round((product.revenue / totalRevenue) * 10000) / 100 : 0;
      product.cumulative_pct = Math.round(pct * 100) / 100;
    }

    await withTransaction(async (client) => {
      for (const product of products) {
        await this.repo.updateProductAbcClass(product.id, product.abc_class, client);
      }
    });

    return {
      products,
      summary: {
        total_revenue: totalRevenue,
        a_count: products.filter((p) => p.abc_class === 'A').length,
        b_count: products.filter((p) => p.abc_class === 'B').length,
        c_count: products.filter((p) => p.abc_class === 'C').length,
      },
    };
  }

  async getReorderSuggestions(): Promise<ReorderSuggestion[]> {
    const rawProducts = await this.repo.getReorderRawProducts();

    const suggestions = rawProducts.map((p) => {
      const soldLast30d = Number(p.sold_last_30d);
      const costPrice = Number(p.cost_price || 0);
      const dailyVelocity = soldLast30d / 30;
      const daysOfStock = dailyVelocity > 0 ? Math.round(p.stock / dailyVelocity) : 999;
      const suggestedQty =
        p.reorder_qty > 0
          ? p.reorder_qty
          : Math.max(Math.ceil(dailyVelocity * (p.lead_time_days + 14)), p.min_stock * 2);

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        min_stock: p.min_stock,
        price: Number(p.price),
        cost_price: costPrice,
        lead_time_days: p.lead_time_days,
        reorder_qty: p.reorder_qty,
        sold_last_30d: soldLast30d,
        daily_velocity: Math.round(dailyVelocity * 100) / 100,
        days_of_stock: daysOfStock,
        suggested_qty: suggestedQty,
        estimated_cost: suggestedQty * costPrice,
      };
    });

    return suggestions;
  }

  async getAbcClassificationPage(
    page: number,
    pageSize: number
  ): Promise<{ data: AbcClassificationResult; totalItems: number }> {
    const base = `WITH revenue AS (
        SELECT p.id, p.name, p.sku, p.stock, p.price,
               COALESCE(SUM(si.quantity * si.unit_price) FILTER (WHERE s.id IS NOT NULL), 0) AS revenue,
               COALESCE(SUM(si.quantity) FILTER (WHERE s.id IS NOT NULL), 0) AS units_sold
        FROM products p LEFT JOIN sale_items si ON si.product_id = p.id
        LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= CURRENT_DATE - INTERVAL '90 days'
        WHERE p.status = 'active' GROUP BY p.id
      ), ranked AS (
        SELECT *, SUM(revenue) OVER () AS total_revenue,
          CASE WHEN SUM(revenue) OVER () = 0 THEN 100
               ELSE SUM(revenue) OVER (ORDER BY revenue DESC, id ASC) / SUM(revenue) OVER () * 100 END AS cumulative_pct
        FROM revenue
      ) SELECT id, name, sku, stock, price, revenue, units_sold,
          CASE WHEN cumulative_pct <= 80 THEN 'A' WHEN cumulative_pct <= 95 THEN 'B' ELSE 'C' END AS abc_class,
          CASE WHEN total_revenue = 0 THEN 0 ELSE ROUND(revenue / total_revenue * 100, 2) END AS revenue_pct,
          ROUND(cumulative_pct, 2) AS cumulative_pct FROM ranked`;
    await this.repo.refreshAbcClasses();
    const [result, summary] = await Promise.all([
      this.repo.getAggregatePage<any>(`${base} ORDER BY revenue DESC, id ASC`, [], page, pageSize),
      this.repo.getAggregate<{
        total_revenue: string | number;
        a_count: string | number;
        b_count: string | number;
        c_count: string | number;
      }>(
        `SELECT COALESCE(SUM(revenue), 0) AS total_revenue,
          COUNT(*) FILTER (WHERE abc_class = 'A') AS a_count,
          COUNT(*) FILTER (WHERE abc_class = 'B') AS b_count,
          COUNT(*) FILTER (WHERE abc_class = 'C') AS c_count FROM (${base}) abc`,
        []
      ),
    ]);
    const products = result.rows.map((r) => ({
      ...r,
      price: Number(r.price),
      revenue: Number(r.revenue),
      units_sold: Number(r.units_sold),
      revenue_pct: Number(r.revenue_pct),
      cumulative_pct: Number(r.cumulative_pct),
    }));
    return {
      data: {
        products,
        summary: {
          total_revenue: Number(summary?.total_revenue ?? 0),
          a_count: Number(summary?.a_count ?? 0),
          b_count: Number(summary?.b_count ?? 0),
          c_count: Number(summary?.c_count ?? 0),
        },
      },
      totalItems: result.totalItems,
    };
  }

  async getCashierPerformancePage(
    page: number,
    pageSize: number,
    from?: unknown,
    to?: unknown
  ): Promise<AnalyticsPagedResult<CashierPerformanceRow>> {
    const sale = buildDateFilter(from, to, 'created_at', 1);
    const items = buildDateFilter(from, to, 's2.created_at', sale.nextIdx);
    const result = await this.repo.getAggregatePage<any>(
      `SELECT u.id AS cashier_id, u.name AS cashier_name, s_agg.total_sales, s_agg.total_revenue,
              s_agg.avg_order_value, COALESCE(si_agg.total_items, 0) AS total_items
       FROM (SELECT cashier_id, COUNT(*) AS total_sales,
                    COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) AS total_revenue,
                    ROUND(COALESCE(AVG(total), 0)::numeric, 2) AS avg_order_value
             FROM sales WHERE ${sale.dateFilter} GROUP BY cashier_id) s_agg
       JOIN users u ON s_agg.cashier_id = u.id
       LEFT JOIN (SELECT s2.cashier_id, SUM(si.quantity) AS total_items FROM sale_items si
                  JOIN sales s2 ON si.sale_id = s2.id WHERE ${items.dateFilter} GROUP BY s2.cashier_id) si_agg
         ON si_agg.cashier_id = u.id ORDER BY s_agg.total_revenue DESC, u.id ASC`,
      [...sale.params, ...items.params],
      page,
      pageSize
    );
    return {
      items: result.rows.map((r) => ({
        ...r,
        total_sales: Number(r.total_sales),
        total_revenue: Number(r.total_revenue),
        avg_order_value: Number(r.avg_order_value),
        total_items: Number(r.total_items),
      })),
      totalItems: result.totalItems,
    };
  }

  async getReorderSuggestionsPage(
    page: number,
    pageSize: number
  ): Promise<AnalyticsPagedResult<ReorderSuggestion>> {
    const result = await this.repo.getAggregatePage<
      {
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
      } & Record<string, unknown>
    >(
      `SELECT p.id, p.name, p.sku, p.stock, p.min_stock, p.price, p.cost_price,
              p.lead_time_days, p.reorder_qty,
              COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id
                        WHERE si.product_id = p.id AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'), 0) AS sold_last_30d
       FROM products p WHERE p.status = 'active' AND p.stock <= p.min_stock
       ORDER BY p.stock ASC, p.id ASC`,
      [],
      page,
      pageSize
    );
    return {
      items: result.rows.map((p) => {
        const soldLast30d = Number(p.sold_last_30d);
        const costPrice = Number(p.cost_price || 0);
        const dailyVelocity = soldLast30d / 30;
        const daysOfStock = dailyVelocity > 0 ? Math.round(p.stock / dailyVelocity) : 999;
        const suggestedQty =
          p.reorder_qty > 0
            ? p.reorder_qty
            : Math.max(Math.ceil(dailyVelocity * (p.lead_time_days + 14)), p.min_stock * 2);
        return {
          ...p,
          price: Number(p.price),
          cost_price: costPrice,
          sold_last_30d: soldLast30d,
          daily_velocity: Math.round(dailyVelocity * 100) / 100,
          days_of_stock: daysOfStock,
          suggested_qty: suggestedQty,
          estimated_cost: suggestedQty * costPrice,
        };
      }),
      totalItems: result.totalItems,
    };
  }

  async createInventorySnapshot(): Promise<Record<string, unknown>> {
    const products = await this.repo.getActiveProductsForSnapshot();

    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const totalCostValue = products.reduce(
      (sum, p) => sum + p.stock * Number(p.cost_price || 0),
      0
    );
    const totalRetailValue = products.reduce((sum, p) => sum + p.stock * Number(p.price), 0);

    const snapshotData = JSON.stringify(
      products.map((p) => ({
        id: p.id,
        stock: p.stock,
        cost: Number(p.cost_price || 0),
        price: Number(p.price),
      }))
    );

    return this.repo.insertInventorySnapshot(
      products.length,
      totalUnits,
      Math.round(totalCostValue * 100) / 100,
      Math.round(totalRetailValue * 100) / 100,
      snapshotData
    );
  }

  async getDeadStock(days: number = 90): Promise<DeadStockResult> {
    const rawRows = await this.repo.getDeadStockRaw(days);

    const products = rawRows.map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      category: r.category,
      stock: r.stock,
      price: Number(r.price),
      cost_price: Number(r.cost_price),
      tied_up_capital: Number(r.tied_up_capital),
      last_sold_date: r.last_sold_date,
      days_inactive: Number(r.days_inactive),
    }));

    const totalTiedUp = products.reduce((sum, p) => sum + p.tied_up_capital, 0);

    return {
      products,
      summary: {
        total_products: products.length,
        total_tied_up_capital: Math.round(totalTiedUp * 100) / 100,
      },
    };
  }

  async getDeadStockPage(
    days: number,
    page: number,
    pageSize: number
  ): Promise<{ data: DeadStockResult; totalItems: number }> {
    const base = `SELECT p.id, p.name, p.sku, COALESCE(c.name, p.category, 'Uncategorized') AS category,
                         p.stock, p.price, COALESCE(p.cost_price, 0) AS cost_price,
                         (p.stock * COALESCE(p.cost_price, 0)) AS tied_up_capital,
                         MAX(s.created_at)::text AS last_sold_date,
                         FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(MAX(s.created_at), p.created_at))) / 86400.0)::int AS days_inactive
                  FROM products p LEFT JOIN categories c ON p.category_id = c.id
                  LEFT JOIN sale_items si ON si.product_id = p.id LEFT JOIN sales s ON si.sale_id = s.id
                  WHERE p.status = 'active' AND p.stock > 0 GROUP BY p.id, c.name, p.category, p.created_at
                  HAVING FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(MAX(s.created_at), p.created_at))) / 86400.0) >= $1`;
    const [result, summary] = await Promise.all([
      this.repo.getAggregatePage<any>(
        `${base} ORDER BY tied_up_capital DESC, p.id ASC`,
        [days],
        page,
        pageSize
      ),
      this.repo.getAggregate<{
        total_products: string | number;
        total_tied_up_capital: string | number;
      }>(
        `SELECT COUNT(*) AS total_products, COALESCE(SUM(tied_up_capital), 0) AS total_tied_up_capital FROM (${base}) dead_stock`,
        [days]
      ),
    ]);
    const products = result.rows.map((r) => ({
      ...r,
      price: Number(r.price),
      cost_price: Number(r.cost_price),
      tied_up_capital: Number(r.tied_up_capital),
      days_inactive: Number(r.days_inactive),
    }));
    return {
      data: {
        products,
        summary: {
          total_products: Number(summary?.total_products ?? 0),
          total_tied_up_capital:
            Math.round(Number(summary?.total_tied_up_capital ?? 0) * 100) / 100,
        },
      },
      totalItems: result.totalItems,
    };
  }

  async getCustomerLtv(from?: unknown, to?: unknown): Promise<CustomerLtvResult> {
    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (from && to) {
      where.push(`s.created_at >= $${paramIdx++} AND s.created_at <= $${paramIdx++}`);
      params.push(from, to + ' 23:59:59');
    }

    const whereClause = where.length > 0 ? `AND ${where.join(' AND ')}` : '';
    const rawRows = await this.repo.getCustomerLtvRaw(whereClause, params);

    const customers = rawRows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone || '',
      order_count: Number(r.order_count),
      lifetime_revenue: Number(r.lifetime_revenue),
      avg_order_value: Number(r.avg_order_value),
      first_purchase: r.first_purchase,
      last_purchase: r.last_purchase,
      tenure_days: Number(r.tenure_days),
      recency_days: Number(r.recency_days),
    }));

    const totalRevenue = customers.reduce((sum, c) => sum + c.lifetime_revenue, 0);
    const top10Revenue = customers.slice(0, 10).reduce((sum, c) => sum + c.lifetime_revenue, 0);

    return {
      customers,
      summary: {
        total_customers: customers.length,
        avg_ltv:
          customers.length > 0 ? Math.round((totalRevenue / customers.length) * 100) / 100 : 0,
        top10_revenue_share:
          totalRevenue > 0 ? Math.round((top10Revenue / totalRevenue) * 10000) / 100 : 0,
      },
    };
  }

  async getCustomerLtvPage(
    page: number,
    pageSize: number,
    from?: unknown,
    to?: unknown
  ): Promise<{ data: CustomerLtvResult; totalItems: number }> {
    const params: unknown[] = [];
    let whereClause = '';
    if (from && to) {
      params.push(from, to + ' 23:59:59');
      whereClause = 'AND s.created_at >= $1 AND s.created_at <= $2';
    }
    const base = `SELECT c.id, c.name, COALESCE(c.phone, '') AS phone, COUNT(DISTINCT s.id)::int AS order_count,
                         COALESCE(SUM(s.total - COALESCE(s.refunded_amount, 0)), 0) AS lifetime_revenue,
                         ROUND(COALESCE(AVG(s.total), 0)::numeric, 2) AS avg_order_value,
                         MIN(s.created_at)::text AS first_purchase, MAX(s.created_at)::text AS last_purchase,
                         FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MIN(s.created_at))) / 86400.0)::int AS tenure_days,
                         FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(s.created_at))) / 86400.0)::int AS recency_days
                  FROM customers c INNER JOIN sales s ON c.id = s.customer_id WHERE 1=1 ${whereClause} GROUP BY c.id`;
    const [result, summary] = await Promise.all([
      this.repo.getAggregatePage<any>(
        `${base} ORDER BY lifetime_revenue DESC, c.id ASC`,
        params,
        page,
        pageSize
      ),
      this.repo.getAggregate<{
        total_customers: string | number;
        total_revenue: string | number;
        top10_revenue: string | number;
      }>(
        `WITH customers_ltv AS (${base}) SELECT COUNT(*) AS total_customers,
          COALESCE(SUM(lifetime_revenue), 0) AS total_revenue,
          COALESCE((SELECT SUM(lifetime_revenue) FROM (SELECT lifetime_revenue FROM customers_ltv ORDER BY lifetime_revenue DESC LIMIT 10) top10), 0) AS top10_revenue
         FROM customers_ltv`,
        params
      ),
    ]);
    const customers = result.rows.map((r) => ({
      ...r,
      order_count: Number(r.order_count),
      lifetime_revenue: Number(r.lifetime_revenue),
      avg_order_value: Number(r.avg_order_value),
      tenure_days: Number(r.tenure_days),
      recency_days: Number(r.recency_days),
    }));
    const totalCustomers = Number(summary?.total_customers ?? 0);
    const totalRevenue = Number(summary?.total_revenue ?? 0);
    return {
      data: {
        customers,
        summary: {
          total_customers: totalCustomers,
          avg_ltv: totalCustomers ? Math.round((totalRevenue / totalCustomers) * 100) / 100 : 0,
          top10_revenue_share: totalRevenue
            ? Math.round((Number(summary?.top10_revenue ?? 0) / totalRevenue) * 10000) / 100
            : 0,
        },
      },
      totalItems: result.totalItems,
    };
  }

  async getHourlyHeatmap(days: number = 30): Promise<HourlyHeatmapRow[]> {
    const rawRows = await this.repo.getHourlyHeatmapRaw(days);
    return rawRows.map((r) => ({
      day_of_week: r.day_of_week,
      hour: r.hour,
      order_count: Number(r.order_count),
      revenue: Number(r.revenue),
    }));
  }

  async getInventorySnapshots(): Promise<Omit<InventorySnapshot, 'snapshot_data'>[]> {
    return this.repo.getInventorySnapshots();
  }
}

export const analyticsService = new AnalyticsService();

// Export standalone helper functions for backwards compatibility
export const getDashboardKpis = () => analyticsService.getDashboardKpis();
export const getRevenueByDate = (from?: unknown, to?: unknown) =>
  analyticsService.getRevenueByDate(from, to);
export const getTopProducts = (from?: unknown, to?: unknown) =>
  analyticsService.getTopProducts(from, to);
export const getPaymentMethodBreakdown = (from?: unknown, to?: unknown) =>
  analyticsService.getPaymentMethodBreakdown(from, to);
export const getOrdersPerDay = (from?: unknown, to?: unknown) =>
  analyticsService.getOrdersPerDay(from, to);
export const getCashierPerformance = (from?: unknown, to?: unknown) =>
  analyticsService.getCashierPerformance(from, to);
export const getSalesByCategory = (from?: unknown, to?: unknown) =>
  analyticsService.getSalesByCategory(from, to);
export const getSalesByDistributor = (from?: unknown, to?: unknown) =>
  analyticsService.getSalesByDistributor(from, to);
export const getAbcClassification = () => analyticsService.getAbcClassification();
export const getReorderSuggestions = () => analyticsService.getReorderSuggestions();
export const createInventorySnapshot = () => analyticsService.createInventorySnapshot();
export const getInventorySnapshots = () => analyticsService.getInventorySnapshots();
export const getDeadStock = (days?: number) => analyticsService.getDeadStock(days);
export const getCustomerLtv = (from?: unknown, to?: unknown) =>
  analyticsService.getCustomerLtv(from, to);
export const getHourlyHeatmap = (days?: number) => analyticsService.getHourlyHeatmap(days);
