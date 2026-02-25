import { useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isToday,
  isBefore,
  isAfter,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface MonthGridProps {
  month: Date;
  selected?: DateRange;
  onDayClick: (day: Date) => void;
  showOutsideDays: boolean;
}

function MonthGrid({ month, selected, onDayClick, showOutsideDays }: MonthGridProps) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const isInRange = (day: Date): boolean => {
    if (!selected?.from || !selected?.to) return false;
    const rangeStart = isBefore(selected.from, selected.to) ? selected.from : selected.to;
    const rangeEnd = isAfter(selected.from, selected.to) ? selected.from : selected.to;
    return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
  };

  const isRangeStart = (day: Date): boolean => !!selected?.from && isSameDay(day, selected.from);
  const isRangeEnd = (day: Date): boolean => !!selected?.to && isSameDay(day, selected.to);
  const isSelected = (day: Date): boolean => isRangeStart(day) || isRangeEnd(day);

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-7 gap-0">
        {DAYS.map((d) => (
          <div
            key={d}
            className="h-9 w-9 flex items-center justify-center text-muted text-[0.8rem] font-data"
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-0">
          {week.map((day) => {
            const outside = !isSameMonth(day, month);
            if (outside && !showOutsideDays) {
              return <div key={day.toISOString()} className="h-9 w-9" />;
            }
            const today = isToday(day);
            const sel = isSelected(day);
            const inRange = isInRange(day);
            const rangeStart = isRangeStart(day);
            const rangeEnd = isRangeEnd(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'relative h-9 w-9 flex items-center justify-center',
                  inRange && !sel && 'bg-gold/20',
                  rangeStart && selected?.to && 'rounded-l-md bg-gold/20',
                  rangeEnd && selected?.from && 'rounded-r-md bg-gold/20'
                )}
              >
                <button
                  type="button"
                  onClick={() => onDayClick(day)}
                  className={cn(
                    'h-8 w-8 rounded-md text-sm font-data transition-colors',
                    'hover:bg-surface hover:text-gold',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                    outside && 'text-muted opacity-50',
                    today && !sel && 'bg-surface text-gold',
                    sel &&
                      'bg-gold text-primary-foreground hover:bg-gold hover:text-primary-foreground',
                    !sel && !outside && !today && 'text-foreground'
                  )}
                >
                  {format(day, 'd')}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface CalendarProps {
  className?: string;
  mode?: 'range';
  selected?: DateRange;
  onSelect?: (range: DateRange) => void;
  numberOfMonths?: number;
  showOutsideDays?: boolean;
}

function Calendar({
  className,
  mode = 'range',
  selected,
  onSelect,
  numberOfMonths = 1,
  showOutsideDays = true,
}: CalendarProps) {
  const [baseMonth, setBaseMonth] = useState<Date>(() => selected?.from || new Date());

  const months = Array.from({ length: numberOfMonths }, (_, i) => addMonths(baseMonth, i));

  const handleDayClick = (day: Date) => {
    if (mode === 'range') {
      if (!selected?.from || (selected.from && selected.to)) {
        onSelect?.({ from: day, to: null });
      } else {
        const from = selected.from;
        if (isBefore(day, from)) {
          onSelect?.({ from: day, to: from });
        } else {
          onSelect?.({ from, to: day });
        }
      }
    }
  };

  return (
    <div dir="ltr" className={cn('p-3', className)}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setBaseMonth((m) => subMonths(m, 1))}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-transparent text-gold opacity-60 hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-8">
          {months.map((m) => (
            <span
              key={m.toISOString()}
              className="text-sm font-medium font-display tracking-wider text-foreground"
            >
              {format(m, 'MMMM yyyy')}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setBaseMonth((m) => addMonths(m, 1))}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-transparent text-gold opacity-60 hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className={cn('flex gap-6', numberOfMonths === 1 && 'justify-center')}>
        {months.map((m) => (
          <MonthGrid
            key={m.toISOString()}
            month={m}
            selected={selected}
            onDayClick={handleDayClick}
            showOutsideDays={showOutsideDays}
          />
        ))}
      </div>
    </div>
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };
export type { CalendarProps, DateRange };
