import { DollarSign, ShoppingBag, Truck, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from '../../i18n';
import type { KpiData } from '../../hooks/useDashboardData';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  isLoading: boolean;
  onClick?: () => void;
  variant?: 'default' | 'warning';
}

function KpiCard({
  title,
  value,
  icon: Icon,
  isLoading,
  onClick,
  variant = 'default',
}: KpiCardProps) {
  const isWarning = variant === 'warning' && !isLoading && Number(value) > 0;
  return (
    <Card
      className={
        onClick
          ? `cursor-pointer transition-all hover:border-gold/50 hover:shadow-md ${isWarning ? 'border-amber-500/40' : ''}`
          : isWarning
            ? 'border-amber-500/40'
            : ''
      }
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest font-body">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p
                className={`text-2xl font-semibold font-data mt-1 ${isWarning ? 'text-amber-400' : 'text-foreground'}`}
              >
                {value}
              </p>
            )}
          </div>
          <div
            className={`h-12 w-12 rounded-md flex items-center justify-center ${isWarning ? 'bg-amber-500/10' : 'bg-gold/10'}`}
          >
            <Icon className={`h-6 w-6 ${isWarning ? 'text-amber-400' : 'text-gold'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface KpiCardsProps {
  kpis: KpiData | undefined;
  isLoading: boolean;
  onLowStockClick: () => void;
}

export default function KpiCards({ kpis, isLoading, onLowStockClick }: KpiCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard
        title={t('dashboard.todayRevenue')}
        value={formatCurrency(kpis?.today_revenue || 0)}
        icon={DollarSign}
        isLoading={isLoading}
      />
      <KpiCard
        title={t('dashboard.monthRevenue')}
        value={formatCurrency(kpis?.month_revenue || 0)}
        icon={TrendingUp}
        isLoading={isLoading}
      />
      <KpiCard
        title={t('dashboard.grossProfit')}
        value={formatCurrency(kpis?.month_profit || 0)}
        icon={TrendingUp}
        isLoading={isLoading}
      />
      <KpiCard
        title={t('dashboard.totalSales')}
        value={kpis?.total_sales || 0}
        icon={ShoppingBag}
        isLoading={isLoading}
      />
      <KpiCard
        title={t('dashboard.pendingDeliveries')}
        value={kpis?.pending_deliveries || 0}
        icon={Truck}
        isLoading={isLoading}
      />
      <KpiCard
        title={t('dashboard.lowStockItems')}
        value={kpis?.low_stock_items || 0}
        icon={AlertTriangle}
        isLoading={isLoading}
        onClick={onLowStockClick}
        variant="warning"
      />
    </div>
  );
}
