import { IAiRepository, aiRepository as defaultRepo } from './repository';
import {
  ForecastResult,
  RecommendationsResult,
  PricingSuggestion,
  ChurnRiskResult,
  AnomaliesResult,
  Anomaly,
  AiPagedResult,
} from './types';

export class AiService {
  constructor(private repo: IAiRepository = defaultRepo) {}

  getRepository(): IAiRepository {
    return this.repo;
  }

  async getForecast(): Promise<ForecastResult> {
    const salesHistory = await this.repo.getSalesHistoryForForecast();

    const forecasts = salesHistory.map((row) => {
      const dailyVelocity = parseFloat(String(row.daily_velocity)) || 0;
      const forecast30d = Math.round(dailyVelocity * 30);
      const daysOfStock = dailyVelocity > 0 ? Math.round(row.current_stock / dailyVelocity) : 999;
      const reorderRecommended = row.current_stock <= row.min_stock || daysOfStock < 14;
      const suggestedReorderQty = reorderRecommended
        ? Math.max(0, Math.round(dailyVelocity * 45) - row.current_stock)
        : 0;

      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (Number(row.total_sold_90d) >= 30) confidence = 'high';
      else if (Number(row.total_sold_90d) >= 10) confidence = 'medium';

      return {
        productId: row.product_id,
        productName: row.product_name,
        categoryName: row.category_name,
        currentStock: row.current_stock,
        minStock: row.min_stock,
        price: Number(row.price),
        dailyVelocity,
        forecast30d,
        daysOfStock,
        reorderRecommended,
        suggestedReorderQty,
        confidence,
      };
    });

    // Sort by days of stock ascending (most urgent first)
    forecasts.sort((a, b) => a.daysOfStock - b.daysOfStock);

    return {
      period: '30_days',
      generatedAt: new Date().toISOString(),
      forecasts,
    };
  }

  async getForecastPage(
    page: number,
    pageSize: number
  ): Promise<AiPagedResult<ForecastResult['forecasts'][number]>> {
    const result = await this.repo.getSalesHistoryForecastPage(page, pageSize);
    return { items: result.rows.map((row) => this.toForecast(row)), totalItems: result.totalItems };
  }

  private toForecast(
    row: import('./types').RawSalesHistoryRow
  ): ForecastResult['forecasts'][number] {
    const dailyVelocity = parseFloat(String(row.daily_velocity)) || 0;
    const forecast30d = Math.round(dailyVelocity * 30);
    const daysOfStock = dailyVelocity > 0 ? Math.round(row.current_stock / dailyVelocity) : 999;
    const reorderRecommended = row.current_stock <= row.min_stock || daysOfStock < 14;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (Number(row.total_sold_90d) >= 30) confidence = 'high';
    else if (Number(row.total_sold_90d) >= 10) confidence = 'medium';
    return {
      productId: row.product_id,
      productName: row.product_name,
      categoryName: row.category_name,
      currentStock: row.current_stock,
      minStock: row.min_stock,
      price: Number(row.price),
      dailyVelocity,
      forecast30d,
      daysOfStock,
      reorderRecommended,
      suggestedReorderQty: reorderRecommended
        ? Math.max(0, Math.round(dailyVelocity * 45) - row.current_stock)
        : 0,
      confidence,
    };
  }

  async getRecommendationsPage(productId: number | undefined, page: number, pageSize: number) {
    if (productId) {
      const result = await this.repo.getCoPurchasedProductsPage(productId, page, pageSize);
      return {
        data: {
          sourceProductId: productId,
          recommendations: result.rows.map((row) => ({
            recommended_product_id: row.recommended_product_id,
            product_name: row.product_name,
            price: Number(row.price),
            stock: row.stock,
            image_url: row.image_url,
            category_name: row.category_name,
            co_occurrence_count: Number(row.co_occurrence_count),
          })),
        },
        totalItems: result.totalItems,
      };
    }
    const result = await this.repo.getTopPairsPage(page, pageSize);
    return {
      data: { topPairs: result.rows.map((row) => ({ ...row, frequency: Number(row.frequency) })) },
      totalItems: result.totalItems,
    };
  }

  async getChurnRiskPage(
    page: number,
    pageSize: number
  ): Promise<{ data: ChurnRiskResult; totalItems: number }> {
    const result = await this.repo.getCustomersChurnRiskPage(page, pageSize);
    const customers = result.rows.map((row) => {
      const days = parseFloat(String(row.days_since_last_order)) || 0;
      const high = days >= 90;
      return {
        customerId: row.id,
        customerName: row.name,
        phone: row.phone,
        loyaltyPoints: row.loyalty_points,
        totalOrders: row.total_orders,
        totalSpent: parseFloat(String(row.total_spent)),
        lastOrderDate: row.last_order_date,
        daysSinceLastOrder: Math.round(days),
        churnRisk: high ? ('high' as const) : ('medium' as const),
        recommendedAction: high
          ? 'Send win-back SMS discount (e.g. 20% off)'
          : 'Send new arrivals notification or loyalty bonus',
      };
    });
    return { data: { atRiskCount: result.totalItems, customers }, totalItems: result.totalItems };
  }

  async getRecommendations(productId?: number | string): Promise<RecommendationsResult> {
    if (productId) {
      const numId = Number(productId);
      const coPurchased = await this.repo.getCoPurchasedProducts(numId);
      return {
        sourceProductId: numId,
        recommendations: coPurchased.map((row) => ({
          recommended_product_id: row.recommended_product_id,
          product_name: row.product_name,
          price: Number(row.price),
          stock: row.stock,
          image_url: row.image_url,
          category_name: row.category_name,
          co_occurrence_count: Number(row.co_occurrence_count),
        })),
      };
    }

    const topPairs = await this.repo.getTopPairs();
    return {
      topPairs: topPairs.map((row) => ({
        product_a_id: row.product_a_id,
        product_a_name: row.product_a_name,
        product_b_id: row.product_b_id,
        product_b_name: row.product_b_name,
        frequency: Number(row.frequency),
      })),
    };
  }

  async getPricingSuggestions(): Promise<PricingSuggestion[]> {
    const [deadStock, fastMovers] = await Promise.all([
      this.repo.getDeadStockForPricing(),
      this.repo.getFastMoversForPricing(),
    ]);

    const suggestions: PricingSuggestion[] = [
      ...deadStock.map((row) => {
        const discountPct = 15;
        const costPrice = Number(row.cost_price);
        const price = Number(row.price);
        const suggestedPrice = Math.max(
          costPrice * 1.05,
          Math.round(price * (1 - discountPct / 100))
        );
        return {
          productId: row.id,
          productName: row.name,
          category: row.category_name,
          currentPrice: price,
          costPrice,
          stock: row.stock,
          type: 'markdown' as const,
          reason: 'Zero sales in last 30 days with high stock level',
          suggestedPrice: Math.round(suggestedPrice * 100) / 100,
          potentialImpact: `Clear ${row.stock} stagnant units, free up capital`,
        };
      }),
      ...fastMovers.map((row) => {
        const markupPct = 5;
        const price = Number(row.price);
        const costPrice = Number(row.cost_price);
        const suggestedPrice = Math.round(price * (1 + markupPct / 100));
        return {
          productId: row.id,
          productName: row.name,
          category: row.category_name,
          currentPrice: price,
          costPrice,
          stock: row.stock,
          type: 'markup' as const,
          reason: `High velocity (${row.sales_30d} sold in 30 days)`,
          suggestedPrice,
          potentialImpact: `+${markupPct}% margin with minimal demand impact`,
        };
      }),
    ];

    return suggestions;
  }

  async getPricingSuggestionsPage(
    page: number,
    pageSize: number
  ): Promise<AiPagedResult<PricingSuggestion>> {
    const result = await this.repo.getComputedPage<any>(
      `SELECT * FROM (
         SELECT p.id, p.name, p.price, p.cost_price, p.stock, c.name AS category_name,
                COALESCE(SUM(si.quantity) FILTER (WHERE s.id IS NOT NULL), 0)::int AS sales_30d, 'markdown'::text AS suggestion_type
         FROM products p LEFT JOIN sale_items si ON p.id = si.product_id
         LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= NOW() - INTERVAL '30 days' AND s.status != 'voided'
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.status = 'active' AND p.stock > 5
         GROUP BY p.id, p.name, p.price, p.cost_price, p.stock, c.name
         HAVING COALESCE(SUM(si.quantity) FILTER (WHERE s.id IS NOT NULL), 0) = 0
         UNION ALL
         SELECT p.id, p.name, p.price, p.cost_price, p.stock, c.name AS category_name,
                SUM(si.quantity)::int AS sales_30d, 'markup'::text AS suggestion_type
         FROM products p JOIN sale_items si ON p.id = si.product_id
         JOIN sales s ON si.sale_id = s.id AND s.created_at >= NOW() - INTERVAL '30 days' AND s.status != 'voided'
         LEFT JOIN categories c ON p.category_id = c.id WHERE p.status = 'active'
         GROUP BY p.id, p.name, p.price, p.cost_price, p.stock, c.name HAVING SUM(si.quantity) >= 20
       ) suggestions ORDER BY CASE suggestion_type WHEN 'markdown' THEN 0 ELSE 1 END, sales_30d DESC, id ASC`,
      [],
      page,
      pageSize
    );
    return {
      items: result.rows.map((row) => {
        const price = Number(row.price);
        const costPrice = Number(row.cost_price);
        const markdown = row.suggestion_type === 'markdown';
        const suggestedPrice = markdown
          ? Math.max(costPrice * 1.05, Math.round(price * 0.85))
          : Math.round(price * 1.05);
        return {
          productId: row.id,
          productName: row.name,
          category: row.category_name,
          currentPrice: price,
          costPrice,
          stock: row.stock,
          type: markdown ? ('markdown' as const) : ('markup' as const),
          reason: markdown
            ? 'Zero sales in last 30 days with high stock level'
            : `High velocity (${row.sales_30d} sold in 30 days)`,
          suggestedPrice: Math.round(suggestedPrice * 100) / 100,
          potentialImpact: markdown
            ? `Clear ${row.stock} stagnant units, free up capital`
            : '+5% margin with minimal demand impact',
        };
      }),
      totalItems: result.totalItems,
    };
  }

  async getAnomaliesPage(
    page: number,
    pageSize: number
  ): Promise<{ data: AnomaliesResult; totalItems: number }> {
    const result = await this.repo.getComputedPage<Anomaly & Record<string, unknown>>(
      `SELECT type, severity, description, details, timestamp FROM (
        SELECT 'high_discount'::text AS type,
          CASE WHEN ROUND((s.discount / s.subtotal) * 100) >= 50 THEN 'high' ELSE 'medium' END::text AS severity,
          'Sale ' || s.receipt_number || ' had a ' || ROUND((s.discount / s.subtotal) * 100) || '% discount applied by ' || COALESCE(u.name, 'unknown') AS description,
          jsonb_build_object('saleId', s.id, 'receiptNumber', s.receipt_number, 'subtotal', s.subtotal, 'discount', s.discount, 'cashier', u.name) AS details,
          s.created_at::text AS timestamp, 'sale:' || s.id::text AS sort_key
        FROM sales s LEFT JOIN users u ON s.cashier_id = u.id
        WHERE s.subtotal > 0 AND (s.discount / s.subtotal) >= 0.3 AND s.status != 'voided'
        UNION ALL
        SELECT 'large_damage_writeoff', 'high',
          'Large damaged stock write-off of ' || ABS(sa.delta) || ' units for "' || p.name || '" by ' || COALESCE(u.name, 'unknown'),
          jsonb_build_object('adjustmentId', sa.id, 'product', p.name, 'quantity', ABS(sa.delta), 'user', u.name), sa.created_at::text,
          'adjustment:' || sa.id::text
        FROM stock_adjustments sa JOIN products p ON sa.product_id = p.id LEFT JOIN users u ON sa.user_id = u.id
        WHERE sa.delta < -10 AND sa.reason = 'Damaged'
        UNION ALL
        SELECT 'high_cashier_refund_rate', 'medium',
          'Cashier ' || u.name || ' has a ' || ROUND((SUM(CASE WHEN s.status IN ('refunded', 'partially_refunded') THEN 1 ELSE 0 END) / COUNT(s.id)::float) * 100) || '% refund rate over the last 30 days',
          jsonb_build_object('cashier', u.name, 'totalSales', COUNT(s.id), 'refundCount', SUM(CASE WHEN s.status IN ('refunded', 'partially_refunded') THEN 1 ELSE 0 END), 'totalRefunded', COALESCE(SUM(s.refunded_amount), 0)),
          NOW()::text, 'cashier:' || u.id::text
        FROM sales s JOIN users u ON s.cashier_id = u.id WHERE s.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY u.id, u.name HAVING COUNT(s.id) >= 10 AND (SUM(CASE WHEN s.status IN ('refunded', 'partially_refunded') THEN 1 ELSE 0 END) / COUNT(s.id)::float) >= 0.15
      ) anomalies ORDER BY timestamp DESC, type ASC, sort_key ASC`,
      [],
      page,
      pageSize
    );
    return {
      data: { totalAnomalies: result.totalItems, anomalies: result.rows },
      totalItems: result.totalItems,
    };
  }

  async getChurnRisk(): Promise<ChurnRiskResult> {
    const customers = await this.repo.getCustomersForChurnRisk();

    const analyzed = customers
      .map((row) => {
        const days = parseFloat(String(row.days_since_last_order)) || 0;
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
          totalSpent: parseFloat(String(row.total_spent)),
          lastOrderDate: row.last_order_date,
          daysSinceLastOrder: Math.round(days),
          churnRisk: risk,
          recommendedAction: action,
        };
      })
      .filter((c) => c.churnRisk !== 'low');

    return {
      atRiskCount: analyzed.length,
      customers: analyzed,
    };
  }

  async getAnomalies(): Promise<AnomaliesResult> {
    const anomalies: Anomaly[] = [];

    const [highDiscountSales, largeReturns, cashierStats] = await Promise.all([
      this.repo.getHighDiscountSales(),
      this.repo.getLargeDamageWriteoffs(),
      this.repo.getCashierRefundStats(),
    ]);

    // 1. High-discount sales (>30% discount)
    for (const row of highDiscountSales) {
      const pct = Math.round((Number(row.discount) / Number(row.subtotal)) * 100);
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
    for (const row of largeReturns) {
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
    for (const row of cashierStats) {
      anomalies.push({
        type: 'high_cashier_refund_rate',
        severity: 'medium',
        description: `Cashier ${row.cashier_name} has a ${Math.round((Number(row.refunded_count) / Number(row.total_sales)) * 100)}% refund rate over the last 30 days`,
        details: {
          cashier: row.cashier_name,
          totalSales: row.total_sales,
          refundCount: row.refunded_count,
          totalRefunded: row.total_refunded_amount,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return {
      totalAnomalies: anomalies.length,
      anomalies,
    };
  }
}

export const aiService = new AiService();
