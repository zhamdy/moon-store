import { useSettingsStore } from '../../store/settingsStore';
import { useTranslation } from '../../i18n';
import { formatCurrency } from '../../lib/utils';
import { useState } from 'react';

interface HeatmapDataPoint {
  day_of_week: number;
  hour: number;
  order_count: number;
  revenue: number;
}

interface HeatmapChartProps {
  data: HeatmapDataPoint[];
}

export default function HeatmapChart({ data }: HeatmapChartProps) {
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    point: HeatmapDataPoint | null;
  }>({ visible: false, x: 0, y: 0, point: null });

  // Build lookup: day_of_week -> hour -> data
  const lookup = new Map<string, HeatmapDataPoint>();
  let maxRevenue = 0;
  for (const point of data) {
    lookup.set(`${point.day_of_week}-${point.hour}`, point);
    if (point.revenue > maxRevenue) maxRevenue = point.revenue;
  }

  const days = [0, 1, 2, 3, 4, 5, 6]; // Sun-Sat
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getOpacity = (revenue: number): number => {
    if (maxRevenue === 0) return 0;
    return Math.max(0.08, revenue / maxRevenue);
  };

  const goldColor = '#C9A96E';

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>, day: number, hour: number) => {
    const point = lookup.get(`${day}-${hour}`) || {
      day_of_week: day,
      hour,
      order_count: 0,
      revenue: 0,
    };
    const rect = e.currentTarget.getBoundingClientRect();
    const parent = e.currentTarget.closest('.heatmap-container')?.getBoundingClientRect();
    if (parent) {
      setTooltip({
        visible: true,
        x: rect.left - parent.left + rect.width / 2,
        y: rect.top - parent.top - 8,
        point,
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, point: null });
  };

  return (
    <div className="heatmap-container relative w-full overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Hour labels */}
        <div className="flex items-center ms-16">
          {hours.map((h) => (
            <div key={h} className="flex-1 text-center text-[10px] font-data text-muted pb-1">
              {String(h).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {days.map((day) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            {/* Day label */}
            <div className="w-14 text-end text-xs font-data text-muted pe-2 shrink-0">
              {t(`analytics.day.${day}`).slice(0, 3)}
            </div>

            {/* Hour cells */}
            <div className="flex flex-1 gap-[2px]">
              {hours.map((hour) => {
                const point = lookup.get(`${day}-${hour}`);
                const revenue = point?.revenue || 0;
                const opacity = getOpacity(revenue);

                return (
                  <div
                    key={hour}
                    className="flex-1 aspect-square rounded-sm cursor-pointer transition-transform hover:scale-110"
                    style={{
                      backgroundColor:
                        revenue > 0
                          ? `${goldColor}${Math.round(opacity * 255)
                              .toString(16)
                              .padStart(2, '0')}`
                          : isDark
                            ? '#1E1E1E'
                            : '#F0F0F0',
                      minHeight: '20px',
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, day, hour)}
                    onMouseLeave={handleMouseLeave}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip.visible && tooltip.point && (
        <div
          className="absolute z-50 pointer-events-none rounded-md p-2.5 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: isDark ? '#141414' : '#FFFFFF',
            borderColor: isDark ? '#1E1E1E' : '#E5E5E5',
            color: isDark ? '#F5F0E8' : '#1E1E1E',
            borderWidth: 1,
            borderStyle: 'solid',
          }}
        >
          <p className="text-[10px] font-data text-muted">
            {t(`analytics.day.${tooltip.point.day_of_week}`)} —{' '}
            {String(tooltip.point.hour).padStart(2, '0')}:00
          </p>
          <p className="text-xs font-semibold font-data text-gold">
            {formatCurrency(tooltip.point.revenue)}
          </p>
          <p className="text-[10px] font-data text-muted">
            {tooltip.point.order_count} {t('analytics.orderCount')}
          </p>
        </div>
      )}
    </div>
  );
}
