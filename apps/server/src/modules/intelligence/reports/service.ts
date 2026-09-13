import { IReportsRepository, reportsRepository as defaultRepo } from './repository';
import {
  SalesReportFilters,
  SalesReportData,
  InventoryReportFilters,
  InventoryReportData,
  ProfitLossFilters,
  ProfitLossData,
} from './types';

export class ReportsService {
  constructor(private repo: IReportsRepository = defaultRepo) {}

  getRepository(): IReportsRepository {
    return this.repo;
  }

  async getSalesReport(filters: SalesReportFilters): Promise<{
    data: SalesReportData;
    total: number;
  }> {
    const { from, to, groupBy = 'day', cashierId, paymentMethod, page, pageSize } = filters;

    const offset = (page - 1) * pageSize;
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

    let dateFormat = 'YYYY-MM-DD';
    if (groupBy === 'month') dateFormat = 'YYYY-MM';
    if (groupBy === 'hour') dateFormat = 'YYYY-MM-DD HH24:00';

    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const [summary, grouped, transactions, total] = await Promise.all([
      this.repo.getSalesReportSummary(whereClause, params),
      this.repo.getSalesReportGrouped(dateFormat, whereClause, params),
      this.repo.getSalesReportTransactions(
        whereClause,
        params,
        limitIdx,
        offsetIdx,
        pageSize,
        offset
      ),
      this.repo.getSalesReportCount(whereClause, params),
    ]);

    return {
      data: {
        summary: summary || {
          total_sales: 0,
          total_discount: 0,
          total_tax: 0,
          total_orders: 0,
          avg_order_value: 0,
        },
        grouped,
        transactions,
      },
      total,
    };
  }

  async getInventoryReport(filters: InventoryReportFilters): Promise<InventoryReportData> {
    const { categoryId, distributorId, lowStockOnly } = filters;
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
    if (lowStockOnly === 'true' || lowStockOnly === true) {
      where.push('p.stock <= p.min_stock');
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const [summary, byCategory] = await Promise.all([
      this.repo.getInventoryReportSummary(whereClause, params),
      this.repo.getInventoryReportByCategory(whereClause, params),
    ]);

    return {
      summary: summary || {
        total_products: 0,
        total_units: 0,
        total_retail_value: 0,
        total_cost_value: 0,
        potential_profit: 0,
        low_stock_count: 0,
        out_of_stock_count: 0,
      },
      byCategory,
    };
  }

  async getProfitLossReport(filters: ProfitLossFilters): Promise<ProfitLossData> {
    const { from, to } = filters;
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

    const [sales, expenseSummary, expenseByCategory] = await Promise.all([
      this.repo.getProfitLossSales(dateFilterSales, params),
      this.repo.getProfitLossExpenseSummary(dateFilterExpenses, params),
      this.repo.getProfitLossExpenseByCategory(dateFilterExpenses, params),
    ]);

    const grossProfit = Number(sales?.gross_profit || 0);
    const totalExpenses = Number(expenseSummary?.total || 0);
    const netProfit = grossProfit - totalExpenses;
    const netRevenue = Number(sales?.net_revenue || 0);
    const netMargin = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 10000) / 100 : 0;
    const grossMargin = netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 10000) / 100 : 0;

    return {
      revenue: {
        gross: Number(sales?.gross_revenue || 0),
        discount: Number(sales?.total_discount || 0),
        net: netRevenue,
        tax: Number(sales?.total_tax || 0),
      },
      costOfGoodsSold: Number(sales?.cogs || 0),
      grossProfit,
      grossMargin,
      operatingExpenses: {
        total: totalExpenses,
        breakdown: expenseByCategory,
      },
      netProfit,
      netMargin,
    };
  }
}

export const reportsService = new ReportsService();
