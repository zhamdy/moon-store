import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';

// --- Types ---

interface DashboardKpis {
  today_revenue: number;
  month_revenue: number;
  month_profit: number;
  total_sales: number;
  pending_deliveries: number;
  low_stock_items: number;
}

interface RevenueByDate {
  date: string;
  revenue: number;
}

interface TopProduct {
  name: string;
  total_sold: number;
  total_revenue: number;
}

interface PaymentMethodRow {
  payment_method: string;
  count: number;
  revenue: number;
}

interface OrdersPerDay {
  date: string;
  orders: number;
}

interface CashierPerformanceRow {
  cashier_id: number;
  cashier_name: string;
  total_sales: number;
  total_revenue: number;
  avg_order_value: number;
  total_items: number;
}

interface SalesByCategoryRow {
  category_name: string;
  total_sold: number;
  revenue: number;
}

interface SalesByDistributorRow {
  distributor_name: string;
  total_sold: number;
  revenue: number;
}

interface AbcProduct {
  id: number;
  name: string;
  sku: string;
  stock: number;
  price: number;
  abc_class: string;
  revenue: number;
  units_sold: number;
  revenue_pct?: number;
  cumulative_pct?: number;
}

interface AbcClassificationResult {
  products: AbcProduct[];
  summary: {
    total_revenue: number;
    a_count: number;
    b_count: number;
    c_count: number;
  };
}

interface ReorderProduct {
  id: number;
  name: string;
  sku: string;
  stock: number;
  min_stock: number;
  price: number;
  cost_price: number;
  lead_time_days: number;
  reorder_qty: number;
  sold_last_30d: number;
}

interface ReorderSuggestion extends ReorderProduct {
  daily_velocity: number;
  days_of_stock: number;
  suggested_qty: number;
  estimated_cost: number;
}

interface InventorySnapshot {
  id: number;
  total_products: number;
  total_units: number;
  total_cost_value: number;
  total_retail_value: number;
  snapshot_data?: string;
  created_at: string;
}

// --- Helpers ---

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

// --- Public API ---

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const todayRevenue = await db.query<{ revenue: string | number }>(
    `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue
     FROM sales WHERE created_at::date = CURRENT_DATE`
  );
  const monthRevenue = await db.query<{ revenue: string | number }>(
    `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue
     FROM sales WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)`
  );
  const totalSales = await db.query<{ count: string | number }>(
    'SELECT COUNT(*) as count FROM sales'
  );
  const pendingDeliveries = await db.query<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM delivery_orders WHERE status IN ('Pending', 'Preparing', 'Out for Delivery')`
  );
  const lowStock = await db.query<{ count: string | number }>(
    "SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND status = 'active'"
  );

  const monthProfit = await db.query<{ profit: string | number }>(
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

export async function getRevenueByDate(from: unknown, to: unknown): Promise<RevenueByDate[]> {
  const { dateFilter, params } = buildDateFilter(from, to, 'created_at');

  const result = await db.query<{ date: string; revenue: string | number }>(
    `SELECT created_at::date::text as date, COALESCE(SUM(total), 0) as revenue
     FROM sales
     WHERE ${dateFilter}
     GROUP BY created_at::date
     ORDER BY date`,
    params
  );

  return result.rows.map((r) => ({ date: r.date, revenue: Number(r.revenue) }));
}

export async function getTopProducts(from: unknown, to: unknown): Promise<TopProduct[]> {
  const { dateFilter, params } = buildDateFilter(from, to, 's.created_at');

  const result = await db.query<{
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

  return result.rows.map((r) => ({
    name: r.name,
    total_sold: Number(r.total_sold),
    total_revenue: Number(r.total_revenue),
  }));
}

export async function getPaymentMethodBreakdown(
  from: unknown,
  to: unknown
): Promise<PaymentMethodRow[]> {
  const { dateFilter, params } = buildDateFilter(from, to, 'created_at');

  const result = await db.query<{
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

  return result.rows.map((r) => ({
    payment_method: r.payment_method,
    count: Number(r.count),
    revenue: Number(r.revenue),
  }));
}

export async function getOrdersPerDay(from: unknown, to: unknown): Promise<OrdersPerDay[]> {
  const { dateFilter, params } = buildDateFilter(from, to, 'created_at');

  const result = await db.query<{ date: string; orders: string | number }>(
    `SELECT created_at::date::text as date, COUNT(*) as orders
     FROM sales
     WHERE ${dateFilter}
     GROUP BY created_at::date
     ORDER BY date`,
    params
  );

  return result.rows.map((r) => ({ date: r.date, orders: Number(r.orders) }));
}

export async function getCashierPerformance(
  from: unknown,
  to: unknown
): Promise<CashierPerformanceRow[]> {
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

  const result = await db.query<{
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
    [...saleParams, ...siParams]
  );

  return result.rows.map((r) => ({
    cashier_id: r.cashier_id,
    cashier_name: r.cashier_name,
    total_sales: Number(r.total_sales),
    total_revenue: Number(r.total_revenue),
    avg_order_value: Number(r.avg_order_value),
    total_items: Number(r.total_items),
  }));
}

export async function getSalesByCategory(
  from: unknown,
  to: unknown
): Promise<SalesByCategoryRow[]> {
  const { dateFilter, params } = buildDateFilter(from, to, 's.created_at');

  const result = await db.query<{
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

  return result.rows.map((r) => ({
    category_name: r.category_name,
    total_sold: Number(r.total_sold),
    revenue: Number(r.revenue),
  }));
}

export async function getSalesByDistributor(
  from: unknown,
  to: unknown
): Promise<SalesByDistributorRow[]> {
  const { dateFilter, params } = buildDateFilter(from, to, 's.created_at');

  const result = await db.query<{
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

  return result.rows.map((r) => ({
    distributor_name: r.distributor_name,
    total_sold: Number(r.total_sold),
    revenue: Number(r.revenue),
  }));
}

export async function getAbcClassification(): Promise<AbcClassificationResult> {
  const result = await db.query<{
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

  const products = result.rows.map((r) => ({
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
      await client.query('UPDATE products SET abc_class = $1 WHERE id = $2', [
        product.abc_class,
        product.id,
      ]);
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

export async function getReorderSuggestions(): Promise<ReorderSuggestion[]> {
  const result = await db.query<{
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

  const suggestions = result.rows.map((p) => {
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

export async function createInventorySnapshot(): Promise<Record<string, unknown>> {
  const result = await db.query<{
    id: number;
    stock: number;
    cost_price: string | number;
    price: string | number;
  }>(`SELECT id, stock, cost_price, price FROM products WHERE status = 'active'`);
  const products = result.rows;

  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const totalCostValue = products.reduce((sum, p) => sum + p.stock * Number(p.cost_price || 0), 0);
  const totalRetailValue = products.reduce((sum, p) => sum + p.stock * Number(p.price), 0);

  const snapshotRes = await db.query<Record<string, unknown>>(
    `INSERT INTO inventory_snapshots (total_products, total_units, total_cost_value, total_retail_value, snapshot_data)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      products.length,
      totalUnits,
      Math.round(totalCostValue * 100) / 100,
      Math.round(totalRetailValue * 100) / 100,
      JSON.stringify(
        products.map((p) => ({
          id: p.id,
          stock: p.stock,
          cost: Number(p.cost_price || 0),
          price: Number(p.price),
        }))
      ),
    ]
  );

  return snapshotRes.rows[0];
}

// --- Dead Stock ---

interface DeadStockProduct {
  id: number;
  name: string;
  sku: string;
  category: string;
  stock: number;
  price: number;
  cost_price: number;
  tied_up_capital: number;
  last_sold_date: string | null;
  days_inactive: number;
}

interface DeadStockResult {
  products: DeadStockProduct[];
  summary: {
    total_products: number;
    total_tied_up_capital: number;
  };
}

export async function getDeadStock(days: number = 90): Promise<DeadStockResult> {
  const result = await db.query<{
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

  const products: DeadStockProduct[] = result.rows.map((r) => ({
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

// --- Customer Lifetime Value ---

interface CustomerLtvRow {
  id: number;
  name: string;
  phone: string;
  order_count: number;
  lifetime_revenue: number;
  avg_order_value: number;
  first_purchase: string;
  last_purchase: string;
  tenure_days: number;
  recency_days: number;
}

interface CustomerLtvResult {
  customers: CustomerLtvRow[];
  summary: {
    total_customers: number;
    avg_ltv: number;
    top10_revenue_share: number;
  };
}

export async function getCustomerLtv(from?: unknown, to?: unknown): Promise<CustomerLtvResult> {
  const where: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (from && to) {
    where.push(`s.created_at >= $${paramIdx++} AND s.created_at <= $${paramIdx++}`);
    params.push(from, to + ' 23:59:59');
  }

  const whereClause = where.length > 0 ? `AND ${where.join(' AND ')}` : '';

  const result = await db.query<{
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

  const customers: CustomerLtvRow[] = result.rows.map((r) => ({
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
      avg_ltv: customers.length > 0 ? Math.round((totalRevenue / customers.length) * 100) / 100 : 0,
      top10_revenue_share:
        totalRevenue > 0 ? Math.round((top10Revenue / totalRevenue) * 10000) / 100 : 0,
    },
  };
}

// --- Hourly Heatmap ---

interface HourlyHeatmapRow {
  day_of_week: number;
  hour: number;
  order_count: number;
  revenue: number;
}

export async function getHourlyHeatmap(days: number = 30): Promise<HourlyHeatmapRow[]> {
  const result = await db.query<{
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

  return result.rows.map((r) => ({
    day_of_week: r.day_of_week,
    hour: r.hour,
    order_count: Number(r.order_count),
    revenue: Number(r.revenue),
  }));
}

export async function getInventorySnapshots(): Promise<Omit<InventorySnapshot, 'snapshot_data'>[]> {
  const result = await db.query<Omit<InventorySnapshot, 'snapshot_data'>>(
    `SELECT id, total_products, total_units, total_cost_value, total_retail_value, created_at
     FROM inventory_snapshots ORDER BY created_at DESC LIMIT 30`
  );
  return result.rows;
}
