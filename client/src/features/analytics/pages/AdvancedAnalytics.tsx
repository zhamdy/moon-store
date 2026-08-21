import { useState } from 'react';
import { useTranslation } from '../../../shared/i18n/index';
import { formatCurrency, formatDate } from '../../../shared/lib/utils';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { Card, CardBody, Button } from '@heroui/react';
import { Badge } from '../../../shared/components/StatusBadge';
import PageHeader from '../../../shared/components/PageHeader';
import AbcChart from '../components/charts/AbcChart';
import HeatmapChart from '../components/charts/HeatmapChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSettingsStore } from '../../../shared/store/settingsStore';

// --- Server payloads ---

/** GET analytics/abc-classification */
interface AbcResponse {
  products: Array<{
    id: number;
    name: string;
    sku: string;
    stock: number;
    price: number;
    abc_class: string;
    revenue: number;
    units_sold: number;
    revenue_pct: number;
    cumulative_pct: number;
  }>;
  summary: {
    total_revenue: number;
    a_count: number;
    b_count: number;
    c_count: number;
  };
}

/** GET analytics/dead-stock */
interface DeadStockResponse {
  products: Array<{
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
  }>;
  summary: { total_products: number; total_tied_up_capital: number };
}

/** GET analytics/customer-ltv */
interface CustomerLtvResponse {
  customers: Array<{
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
  }>;
  summary: { total_customers: number; avg_ltv: number; top10_revenue_share: number };
}

/** GET analytics/hourly-heatmap */
type HourlyHeatmapResponse = Array<{
  day_of_week: number;
  hour: number;
  order_count: number;
  revenue: number;
}>;

// --- Summary Card ---

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardBody className="p-4">
        <p className="text-xs text-muted-foreground font-data tracking-wider uppercase">{label}</p>
        <p className="text-xl font-semibold font-data mt-1" style={color ? { color } : {}}>
          {value}
        </p>
      </CardBody>
    </Card>
  );
}

// --- Days Selector ---

function DaysSelector({
  value,
  onChange,
  options,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  options: number[];
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-data">{label}:</span>
      {options.map((d) => (
        <Button
          key={d}
          size="sm"
          variant={value === d ? 'flat' : 'light'}
          color={value === d ? 'primary' : 'default'}
          className="h-7 min-w-8 text-xs font-data px-2"
          onClick={() => onChange(d)}
        >
          {d}
        </Button>
      ))}
    </div>
  );
}

// --- ABC Tab ---

function AbcTab() {
  const { t } = useTranslation();

  const { data, isLoading } = useApiQuery<AbcResponse>(
    ['analytics', 'abc-classification'],
    'analytics/abc-classification'
  );

  if (isLoading)
    return <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('analytics.abcDesc')}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label={t('analytics.classA')} value={data.summary.a_count} color="#C9A96E" />
        <SummaryCard label={t('analytics.classB')} value={data.summary.b_count} color="#6B8ECF" />
        <SummaryCard label={t('analytics.classC')} value={data.summary.c_count} color="#888888" />
        <SummaryCard
          label={t('dashboard.revenue')}
          value={formatCurrency(data.summary.total_revenue)}
        />
      </div>

      {/* Chart */}
      <Card className="border border-border bg-card shadow-sm">
        <CardBody className="p-4">
          <AbcChart data={data.products} />
        </CardBody>
      </Card>

      {/* Table */}
      <Card className="border border-border bg-card shadow-sm">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs font-data tracking-wider uppercase">
                  <th className="text-start p-3">{t('analytics.products')}</th>
                  <th className="text-start p-3">SKU</th>
                  <th className="text-end p-3">{t('dashboard.revenue')}</th>
                  <th className="text-end p-3">{t('analytics.revenueShare')}</th>
                  <th className="text-end p-3">{t('analytics.cumulativeRevenue')}</th>
                  <th className="text-center p-3">ABC</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3 font-data">{p.name}</td>
                    <td className="p-3 font-data text-muted-foreground">{p.sku}</td>
                    <td className="p-3 font-data text-end">{formatCurrency(p.revenue)}</td>
                    <td className="p-3 font-data text-end">{p.revenue_pct}%</td>
                    <td className="p-3 font-data text-end">{p.cumulative_pct}%</td>
                    <td className="p-3 text-center">
                      <Badge
                        size="sm"
                        variant={
                          p.abc_class === 'A'
                            ? 'warning'
                            : p.abc_class === 'B'
                              ? 'secondary'
                              : 'default'
                        }
                      >
                        {p.abc_class}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// --- Dead Stock Tab ---

function DeadStockTab() {
  const { t } = useTranslation();
  const [days, setDays] = useState(90);

  const { data, isLoading } = useApiQuery<DeadStockResponse>(
    ['analytics', 'dead-stock', days],
    'analytics/dead-stock',
    { days }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t('analytics.deadStockDesc')}</p>
        <DaysSelector
          value={days}
          onChange={setDays}
          options={[30, 60, 90, 180]}
          label={t('analytics.daysThreshold')}
        />
      </div>

      {isLoading && (
        <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard label={t('analytics.products')} value={data.summary.total_products} />
            <SummaryCard
              label={t('analytics.tiedUpCapital')}
              value={formatCurrency(data.summary.total_tied_up_capital)}
              color="#E74C3C"
            />
          </div>

          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs font-data tracking-wider uppercase">
                      <th className="text-start p-3">{t('analytics.products')}</th>
                      <th className="text-start p-3">SKU</th>
                      <th className="text-start p-3">{t('inventory.categoryCol')}</th>
                      <th className="text-end p-3">{t('inventory.stock')}</th>
                      <th className="text-end p-3">{t('analytics.tiedUpCapital')}</th>
                      <th className="text-end p-3">{t('analytics.daysInactive')}</th>
                      <th className="text-end p-3">{t('analytics.lastSold')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 font-data">{p.name}</td>
                        <td className="p-3 font-data text-muted-foreground">{p.sku}</td>
                        <td className="p-3 font-data text-muted-foreground">{p.category}</td>
                        <td className="p-3 font-data text-end">{p.stock}</td>
                        <td className="p-3 font-data text-end text-danger">
                          {formatCurrency(p.tied_up_capital)}
                        </td>
                        <td className="p-3 font-data text-end">
                          {t('analytics.days', { count: p.days_inactive })}
                        </td>
                        <td className="p-3 font-data text-end text-muted-foreground">
                          {p.last_sold_date ? formatDate(p.last_sold_date) : t('analytics.never')}
                        </td>
                      </tr>
                    ))}
                    {data.products.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          {t('common.noResults')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

// --- CLV Tab ---

function ClvTab() {
  const { t, isRtl } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';

  const { data, isLoading } = useApiQuery<CustomerLtvResponse>(
    ['analytics', 'customer-ltv'],
    'analytics/customer-ltv'
  );

  if (isLoading)
    return <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  if (!data) return null;

  const top20 = data.customers.slice(0, 20);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('analytics.clvDesc')}</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryCard label={t('analytics.totalCustomers')} value={data.summary.total_customers} />
        <SummaryCard
          label={t('analytics.avgLtv')}
          value={formatCurrency(data.summary.avg_ltv)}
          color="#C9A96E"
        />
        <SummaryCard
          label={t('analytics.top10Share')}
          value={`${data.summary.top10_revenue_share}%`}
        />
      </div>

      {/* Top 20 bar chart */}
      {top20.length > 0 && (
        <Card className="border border-border bg-card shadow-sm">
          <CardBody className="p-4">
            <h3 className="text-sm font-data text-muted-foreground tracking-wider uppercase mb-4">
              {t('analytics.topCustomers')}
            </h3>
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={top20}
                  layout="vertical"
                  margin={
                    isRtl
                      ? { top: 5, right: 20, left: 20, bottom: 5 }
                      : { top: 5, right: 20, left: 100, bottom: 5 }
                  }
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? '#1E1E1E' : '#E5E5E5'}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: isDark ? '#6B6B6B' : '#888888', fontSize: 12 }}
                    stroke={isDark ? '#1E1E1E' : '#E5E5E5'}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fill: isDark ? '#F5F0E8' : '#333333', fontSize: 11 }}
                    stroke={isDark ? '#1E1E1E' : '#E5E5E5'}
                    width={isRtl ? 100 : 90}
                    orientation={isRtl ? 'right' : 'left'}
                    tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 14) + '...' : v)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as (typeof top20)[0];
                      return (
                        <div
                          style={{
                            backgroundColor: isDark ? '#141414' : '#FFFFFF',
                            borderColor: isDark ? '#1E1E1E' : '#E5E5E5',
                            color: isDark ? '#F5F0E8' : '#1E1E1E',
                            borderWidth: 1,
                            borderStyle: 'solid',
                          }}
                          className="rounded-md p-3 shadow-lg"
                        >
                          <p className="text-xs font-data">{d.name}</p>
                          <p className="text-sm font-semibold text-primary font-data">
                            {formatCurrency(d.lifetime_revenue)}
                          </p>
                          <p className="text-xs font-data text-muted-foreground">
                            {d.order_count} {t('analytics.orderCount')}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="lifetime_revenue"
                    fill="#C9A96E"
                    radius={isRtl ? [4, 0, 0, 4] : [0, 4, 4, 0]}
                    barSize={16}
                    animationDuration={800}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Full table */}
      <Card className="border border-border bg-card shadow-sm">
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs font-data tracking-wider uppercase">
                  <th className="text-start p-3">{t('common.name')}</th>
                  <th className="text-end p-3">{t('analytics.lifetimeRevenue')}</th>
                  <th className="text-end p-3">{t('analytics.orderCount')}</th>
                  <th className="text-end p-3">{t('analytics.avgOrder')}</th>
                  <th className="text-end p-3">{t('analytics.tenure')}</th>
                  <th className="text-end p-3">{t('analytics.recency')}</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3 font-data">
                      <div>{c.name}</div>
                      {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                    </td>
                    <td className="p-3 font-data text-end text-primary font-medium">
                      {formatCurrency(c.lifetime_revenue)}
                    </td>
                    <td className="p-3 font-data text-end">{c.order_count}</td>
                    <td className="p-3 font-data text-end">{formatCurrency(c.avg_order_value)}</td>
                    <td className="p-3 font-data text-end text-muted-foreground">
                      {t('analytics.days', { count: c.tenure_days })}
                    </td>
                    <td className="p-3 font-data text-end text-muted-foreground">
                      {t('analytics.days', { count: c.recency_days })}
                    </td>
                  </tr>
                ))}
                {data.customers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {t('common.noResults')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// --- Heatmap Tab ---

function HeatmapTab() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);

  const { data, isLoading } = useApiQuery<HourlyHeatmapResponse>(
    ['analytics', 'hourly-heatmap', days],
    'analytics/hourly-heatmap',
    { days }
  );

  const peakHour = data?.reduce((best, cur) => (cur.revenue > best.revenue ? cur : best), {
    day_of_week: 0,
    hour: 0,
    order_count: 0,
    revenue: 0,
  });

  const dayTotals = new Map<number, number>();
  data?.forEach((d) => {
    dayTotals.set(d.day_of_week, (dayTotals.get(d.day_of_week) || 0) + d.revenue);
  });
  let peakDayNum = 0;
  let peakDayRev = 0;
  dayTotals.forEach((rev, day) => {
    if (rev > peakDayRev) {
      peakDayNum = day;
      peakDayRev = rev;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t('analytics.heatmapDesc')}</p>
        <DaysSelector
          value={days}
          onChange={setDays}
          options={[7, 14, 30, 90]}
          label={t('analytics.period')}
        />
      </div>

      {isLoading && (
        <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard
              label={t('analytics.peakHour')}
              value={
                peakHour && peakHour.revenue > 0
                  ? `${t(`analytics.day.${peakHour.day_of_week}`)} ${String(peakHour.hour).padStart(2, '0')}:00`
                  : '-'
              }
              color="#C9A96E"
            />
            <SummaryCard
              label={t('analytics.peakDay')}
              value={peakDayRev > 0 ? t(`analytics.day.${peakDayNum}`) : '-'}
              color="#C9A96E"
            />
          </div>

          <Card className="border border-border bg-card shadow-sm">
            <CardBody className="p-4">
              <HeatmapChart data={data} />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

// --- Main Page ---

type TabId = 'abc' | 'dead-stock' | 'clv' | 'heatmap';

export default function AdvancedAnalytics() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('abc');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'abc', label: t('analytics.abc') },
    { id: 'dead-stock', label: t('analytics.deadStock') },
    { id: 'clv', label: t('analytics.clv') },
    { id: 'heatmap', label: t('analytics.heatmap') },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('analytics.title')} />

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? 'flat' : 'light'}
            color={activeTab === tab.id ? 'primary' : 'default'}
            onClick={() => setActiveTab(tab.id)}
            className="font-medium"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'abc' && <AbcTab />}
      {activeTab === 'dead-stock' && <DeadStockTab />}
      {activeTab === 'clv' && <ClvTab />}
      {activeTab === 'heatmap' && <HeatmapTab />}
    </div>
  );
}
