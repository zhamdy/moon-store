import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrency } from '../../lib/utils';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface CashierDataPoint {
  cashier_name: string;
  total_sales: number;
  total_revenue: number;
  avg_order_value: number;
  total_items: number;
}

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  isDark: boolean;
}

const CustomTooltip = ({ active, payload, isDark }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as CashierDataPoint;
  return (
    <div
      style={{
        backgroundColor: isDark ? '#141414' : '#FFFFFF',
        borderColor: isDark ? '#1E1E1E' : '#E5E5E5',
        color: isDark ? '#F5F0E8' : '#1E1E1E',
        borderWidth: 1,
        borderStyle: 'solid',
      }}
      className="rounded-md p-3 shadow-lg space-y-1"
    >
      <p
        className="text-xs font-semibold font-data"
        style={{ color: isDark ? '#F5F0E8' : '#1E1E1E' }}
      >
        {data.cashier_name}
      </p>
      <p className="text-sm font-data text-gold">{formatCurrency(data.total_revenue)}</p>
      <p className="text-xs font-data" style={{ color: isDark ? '#6B6B6B' : '#888888' }}>
        {data.total_sales} sales &middot; avg {formatCurrency(data.avg_order_value)}
      </p>
    </div>
  );
};

interface CashierPerformanceChartProps {
  data: CashierDataPoint[];
}

export default function CashierPerformanceChart({ data }: CashierPerformanceChartProps) {
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 100, bottom: 5 }}
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
            tickFormatter={(v) => formatCurrency(v)}
          />
          <YAxis
            dataKey="cashier_name"
            type="category"
            tick={{ fill: isDark ? '#F5F0E8' : '#333333', fontSize: 11 }}
            stroke={isDark ? '#1E1E1E' : '#E5E5E5'}
            width={90}
          />
          <Tooltip content={<CustomTooltip isDark={isDark} />} />
          <Bar dataKey="total_revenue" fill="#C9A96E" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
