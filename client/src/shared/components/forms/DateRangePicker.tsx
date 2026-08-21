import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, RotateCcw } from 'lucide-react';
import {
  startOfDay,
  endOfDay,
  startOfYesterday,
  endOfYesterday,
  subDays,
  startOfMonth,
  endOfMonth,
  format,
  isValid,
  parseISO,
} from 'date-fns';
import { FormField } from './FormField';
import type { DateRangePickerProps } from './types';

export interface DatePreset {
  label: string;
  getRange: () => { start: Date; end: Date };
}

export const defaultPresets: DatePreset[] = [
  {
    label: 'Today',
    getRange: () => ({
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
    }),
  },
  {
    label: 'Yesterday',
    getRange: () => ({
      start: startOfYesterday(),
      end: endOfYesterday(),
    }),
  },
  {
    label: 'Last 7 Days',
    getRange: () => ({
      start: startOfDay(subDays(new Date(), 6)),
      end: endOfDay(new Date()),
    }),
  },
  {
    label: 'Last 30 Days',
    getRange: () => ({
      start: startOfDay(subDays(new Date(), 29)),
      end: endOfDay(new Date()),
    }),
  },
  {
    label: 'This Month',
    getRange: () => ({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    }),
  },
];

export function DateRangePicker({
  value,
  onChange,
  label,
  helperText,
  errorMessage,
  isInvalid,
  isDisabled,
  isRequired,
  className = '',
}: DateRangePickerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [startDateStr, setStartDateStr] = useState<string>(
    value?.start && isValid(value.start) ? format(value.start, 'yyyy-MM-dd') : ''
  );
  const [endDateStr, setEndDateStr] = useState<string>(
    value?.end && isValid(value.end) ? format(value.end, 'yyyy-MM-dd') : ''
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value?.start && isValid(value.start)) {
      setStartDateStr(format(value.start, 'yyyy-MM-dd'));
    } else {
      setStartDateStr('');
    }
    if (value?.end && isValid(value.end)) {
      setEndDateStr(format(value.end, 'yyyy-MM-dd'));
    } else {
      setEndDateStr('');
    }
  }, [value?.start, value?.end]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleApplyPreset = (preset: DatePreset) => {
    const range = preset.getRange();
    if (onChange) {
      onChange(range);
    }
    setIsOpen(false);
  };

  const handleManualStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value;
    setStartDateStr(str);
    const parsed = parseISO(str);
    if (isValid(parsed) && onChange) {
      onChange({
        start: startOfDay(parsed),
        end: value?.end || null,
      });
    }
  };

  const handleManualEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value;
    setEndDateStr(str);
    const parsed = parseISO(str);
    if (isValid(parsed) && onChange) {
      onChange({
        start: value?.start || null,
        end: endOfDay(parsed),
      });
    }
  };

  const handleReset = () => {
    if (onChange) {
      onChange({ start: null, end: null });
    }
    setStartDateStr('');
    setEndDateStr('');
    setIsOpen(false);
  };

  const formattedDisplay = () => {
    if (value?.start && value?.end && isValid(value.start) && isValid(value.end)) {
      return `${format(value.start, 'MMM dd, yyyy')} - ${format(value.end, 'MMM dd, yyyy')}`;
    }
    if (value?.start && isValid(value.start)) {
      return `From ${format(value.start, 'MMM dd, yyyy')}`;
    }
    return 'Select date range...';
  };

  const pickerContent = (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`flex items-center justify-between w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground transition-colors hover:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
          isInvalid ? '!border-danger !ring-danger/20' : ''
        } ${isDisabled ? 'opacity-60 cursor-not-allowed bg-muted/30' : ''}`}
      >
        <div className="flex items-center gap-2 text-foreground font-normal truncate">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className={!value?.start ? 'text-muted-foreground' : 'text-foreground'}>
            {formattedDisplay()}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 ms-2" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Date range selector"
          className="absolute start-0 z-50 mt-1 w-72 sm:w-80 rounded-xl border border-border bg-card p-3 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
        >
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Presets
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {defaultPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1.5 text-xs text-start font-medium text-foreground rounded-md bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Custom Range
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDateStr}
                    onChange={handleManualStartChange}
                    className="w-full h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDateStr}
                    onChange={handleManualEndChange}
                    className="w-full h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (label || helperText || errorMessage) {
    return (
      <FormField
        label={label}
        helperText={helperText}
        errorMessage={errorMessage}
        isRequired={isRequired}
        isInvalid={isInvalid}
        isDisabled={isDisabled}
        passPropsToChild={false}
      >
        {pickerContent}
      </FormField>
    );
  }

  return pickerContent;
}

export default DateRangePicker;
