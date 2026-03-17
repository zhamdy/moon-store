import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../i18n';
import { formatCurrency } from '../../lib/utils';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface AbcDataPoint {
  name: string;
  revenue: number;
  cumulative_pct: number;
  abc_class: string;
}

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  isDark: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const CLASS_COLORS: Record<string, string> = {
  A: '#C9A96E',
  B: '#6B8ECF',
  C: '#888888',
};

const CustomTooltip = ({ active, payload, isDark, t }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as AbcDataPoint;
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
        {point.name}
      </p>
      <p
        className="text-sm font-semibold font-data"
        style={{ color: CLASS_COLORS[point.abc_class] }}
      >
        {formatCurrency(point.revenue)}
      </p>
      <p className="text-xs font-data text-muted">
        {t('analytics.cumulativeRevenue')}: {point.cumulative_pct}%
      </p>
    </div>
  );
};

interface AbcChartProps {
  data: AbcDataPoint[];
}

export default function AbcChart({ data }: AbcChartProps) {
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { t, isRtl } = useTranslation();

  // Take top 30 products for display
  const chartData = data.slice(0, 30);

  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart
          data={chartData}
          margin={
            isRtl
              ? { top: 20, right: 20, left: 20, bottom: 20 }
              : { top: 20, right: 30, left: 20, bottom: 20 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1E1E1E' : '#E5E5E5'} />
          <XAxis
            dataKey="name"
            tick={{ fill: isDark ? '#6B6B6B' : '#888888', fontSize: 10 }}
            stroke={isDark ? '#1E1E1E' : '#E5E5E5'}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
            tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + '...' : v)}
          />
          <YAxis
            yAxisId="revenue"
            tick={{ fill: isDark ? '#6B6B6B' : '#888888', fontSize: 12 }}
            stroke={isDark ? '#1E1E1E' : '#E5E5E5'}
            orientation={isRtl ? 'right' : 'left'}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <YAxis
            yAxisId="pct"
            tick={{ fill: isDark ? '#6B6B6B' : '#888888', fontSize: 12 }}
            stroke={isDark ? '#1E1E1E' : '#E5E5E5'}
            orientation={isRtl ? 'left' : 'right'}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip isDark={isDark} t={t} />} />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Inter' }} />
          <Bar
            yAxisId="revenue"
            dataKey="revenue"
            name={t('analytics.revenueShare')}
            radius={[4, 4, 0, 0]}
            barSize={16}
            animationDuration={800}
            fill="#C9A96E"
            shape={
              ((props: unknown) => {
                const { x, y, width, height, payload } = props as {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                  payload: AbcDataPoint;
                };
                return (
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx={4}
                    fill={CLASS_COLORS[payload.abc_class] || '#888888'}
                  />
                );
              }) as unknown as undefined
            }
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="cumulative_pct"
            name={t('analytics.cumulativeRevenue')}
            stroke="#E74C3C"
            strokeWidth={2}
            dot={false}
            animationDuration={1000}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
