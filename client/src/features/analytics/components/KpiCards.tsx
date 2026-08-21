import { DollarSign, ShoppingBag, Truck, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardBody, Skeleton } from '@heroui/react';
import { formatCurrency } from '../../../shared/lib/utils';
import { useTranslation } from '../../../shared/i18n/index';
import type { KpiData } from '../hooks/useDashboardData';
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

  const handleKeyDown = onClick
    ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }
    : undefined;

  return (
    <Card
      isPressable={!!onClick}
      className={`border border-border bg-card shadow-sm transition-all ${
        onClick ? 'hover:border-border/80 hover:shadow-md' : ''
      } ${isWarning ? 'border-warning/50' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <CardBody className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {title}
            </p>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-2 rounded-md" />
            ) : (
              <p
                className={`text-2xl font-bold font-data mt-1.5 ${isWarning ? 'text-warning' : 'text-foreground'}`}
              >
                {value}
              </p>
            )}
          </div>
          <div
            className={`h-11 w-11 rounded-lg flex items-center justify-center ${
              isWarning ? 'bg-warning/10 text-warning' : 'bg-accent text-foreground'
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardBody>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy={isLoading}>
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
