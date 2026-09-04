import { DollarSign, ShoppingBag, Truck, AlertTriangle, TrendingUp } from 'lucide-react';
import { StatCard } from '../../../shared';
import { formatCurrency } from '../../../shared/lib/utils';
import { useTranslation } from '../../../shared/i18n/index';
import type { KpiData } from '../hooks/useDashboardData';

interface KpiCardsProps {
  kpis: KpiData | undefined;
  isLoading: boolean;
  onLowStockClick: () => void;
}

export default function KpiCards({ kpis, isLoading, onLowStockClick }: KpiCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy={isLoading}>
      <StatCard
        title={t('dashboard.todayRevenue')}
        value={formatCurrency(kpis?.today_revenue || 0)}
        icon={DollarSign}
        isLoading={isLoading}
      />
      <StatCard
        title={t('dashboard.monthRevenue')}
        value={formatCurrency(kpis?.month_revenue || 0)}
        icon={TrendingUp}
        isLoading={isLoading}
      />
      <StatCard
        title={t('dashboard.grossProfit')}
        value={formatCurrency(kpis?.month_profit || 0)}
        icon={TrendingUp}
        isLoading={isLoading}
      />
      <StatCard
        title={t('dashboard.totalSales')}
        value={kpis?.total_sales || 0}
        icon={ShoppingBag}
        isLoading={isLoading}
      />
      <StatCard
        title={t('dashboard.pendingDeliveries')}
        value={kpis?.pending_deliveries || 0}
        icon={Truck}
        isLoading={isLoading}
      />
      <StatCard
        title={t('dashboard.lowStockItems')}
        value={kpis?.low_stock_items || 0}
        icon={AlertTriangle}
        isLoading={isLoading}
        onClick={onLowStockClick}
        delta={
          kpis?.low_stock_items && kpis.low_stock_items > 0
            ? { type: 'decrease', value: t('dashboard.requiresAttention') }
            : undefined
        }
      />
    </div>
  );
}
