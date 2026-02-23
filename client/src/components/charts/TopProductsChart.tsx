import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../i18n';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface TopProductDataPoint {
  name: string;
  total_sold: number;
}

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  isDark: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const CustomTooltip = ({ active, payload, isDark, t }: CustomTooltipProps) => {
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
      <p className="text-xs font-data" style={{ color: isDark ? '#F5F0E8' : '#1E1E1E' }}>
        {(payload[0].payload as TopProductDataPoint).name}
      </p>
      <p className="text-sm font-semibold text-gold font-data">
        {payload[0].value} {t('charts.sold')}
      </p>
    </div>
  );
};

interface TopProductsChartProps {
  data: TopProductDataPoint[];
}

export default function TopProductsChart({ data }: TopProductsChartProps) {
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { t } = useTranslation();

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
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fill: isDark ? '#F5F0E8' : '#333333', fontSize: 11 }}
            stroke={isDark ? '#1E1E1E' : '#E5E5E5'}
            width={90}
          />
          <Tooltip content={<CustomTooltip isDark={isDark} t={t} />} />
          <Bar dataKey="total_sold" fill="#C9A96E" radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
