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
