import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSettingsStore } from '../../store/settingsStore';
import { formatCurrency } from '../../lib/utils';
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface CategoryDataPoint {
  category_name: string;
  total_sold: number;
  revenue: number;
}

const COLORS = [
  '#C9A96E',
  '#8B7355',
  '#D4AF37',
  '#B8860B',
  '#DAA520',
  '#CD853F',
  '#DEB887',
  '#F5DEB3',
];

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  isDark: boolean;
}

const CustomTooltip = ({ active, payload, isDark }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as CategoryDataPoint;
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
      <p className="text-xs font-semibold font-data">{data.category_name}</p>
      <p className="text-sm font-data text-gold">{formatCurrency(data.revenue)}</p>
      <p className="text-xs font-data" style={{ color: isDark ? '#6B6B6B' : '#888888' }}>
        {data.total_sold} items sold
      </p>
    </div>
  );
};

interface CategorySalesChartProps {
  data: CategoryDataPoint[];
}

export default function CategorySalesChart({ data }: CategorySalesChartProps) {
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={60}
            dataKey="revenue"
            nameKey="category_name"
            label={({ percent }) => {
              const pct = percent * 100;
              if (pct < 5) return '';
              return `${pct.toFixed(0)}%`;
            }}
            labelLine={false}
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip isDark={isDark} />} />
          <Legend
            formatter={(value) => (
              <span style={{ color: isDark ? '#F5F0E8' : '#333333', fontSize: 11 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
