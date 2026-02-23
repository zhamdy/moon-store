import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../lib/utils';
import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../i18n';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface PaymentDataPoint {
  payment_method: string;
  count: number;
  revenue: number;
}

const COLORS = ['#C9A96E', '#E8B4C8', '#6B6B6B'];

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
      <p className="text-xs font-data" style={{ color: isDark ? '#F5F0E8' : '#1E1E1E' }}>{payload[0].name}</p>
      <p className="text-sm font-semibold text-gold font-data">{payload[0].value} {t('charts.orders')}</p>
      <p className="text-xs font-data" style={{ color: isDark ? '#6B6B6B' : '#888888' }}>{formatCurrency((payload[0].payload as PaymentDataPoint).revenue)}</p>
    </div>
  );
};

interface PaymentPieChartProps {
  data: PaymentDataPoint[];
}

interface PieLabelProps {
  payment_method: string;
  percent: number;
}

export default function PaymentPieChart({ data }: PaymentPieChartProps) {
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { t } = useTranslation();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={5}
          dataKey="count"
          nameKey="payment_method"
          label={({ payment_method, percent }: PieLabelProps) =>
            `${payment_method} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={{ stroke: isDark ? '#6B6B6B' : '#999999' }}
        >
          {data?.map((_: PaymentDataPoint, index: number) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip isDark={isDark} t={t} />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
