import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../i18n';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface OrdersDataPoint {
  date: string;
  orders: number;
}

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  isDark: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const CustomTooltip = ({ active, payload, label, isDark, t }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
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
      <p className="text-xs font-data" style={{ color: isDark ? '#6B6B6B' : '#888888' }}>{format(new Date(label as string), 'MMM dd, yyyy')}</p>
      <p className="text-sm font-semibold text-blush font-data">{payload[0].value} {t('charts.orders')}</p>
    </div>
  );
};

interface OrdersAreaChartProps {
  data: OrdersDataPoint[];
}

export default function OrdersAreaChart({ data }: OrdersAreaChartProps) {
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { t } = useTranslation();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="blushGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#E8B4C8" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#E8B4C8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E1E1E' : '#E5E5E5'} />
        <XAxis
          dataKey="date"
          tick={{ fill: isDark ? '#6B6B6B' : '#888888', fontSize: 12 }}
          tickFormatter={(val: string) => format(new Date(val), 'MMM dd')}
          stroke={isDark ? '#1E1E1E' : '#E5E5E5'}
        />
        <YAxis tick={{ fill: isDark ? '#6B6B6B' : '#888888', fontSize: 12 }} stroke={isDark ? '#1E1E1E' : '#E5E5E5'} />
        <Tooltip content={<CustomTooltip isDark={isDark} t={t} />} />
        <Area
          type="monotone"
          dataKey="orders"
          stroke="#E8B4C8"
          strokeWidth={2}
          fill="url(#blushGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
