import React, { isValidElement, type ReactNode, type ComponentType } from 'react';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { Skeleton } from './SkeletonLoader';

export type DeltaType = 'increase' | 'decrease' | 'neutral';

export interface StatCardDelta {
  value: string | number;
  type?: DeltaType;
  label?: string;
}

export interface StatCardProps {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon?:
    | LucideIcon
    | ComponentType<{ className?: string; 'aria-hidden'?: string | boolean }>
    | ReactNode;
  delta?: StatCardDelta;
  isLoading?: boolean;
  sparklineData?: number[];
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: IconOrElement,
  delta,
  isLoading = false,
  sparklineData,
  className = '',
  onClick,
}: StatCardProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={`Loading ${title}`}
        className={`rounded-xl border border-border bg-card p-5 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  const deltaType: DeltaType =
    delta?.type ||
    (typeof delta?.value === 'string' && delta.value.startsWith('-')
      ? 'decrease'
      : typeof delta?.value === 'string' && delta.value.startsWith('+')
        ? 'increase'
        : 'neutral');

  const deltaColorClasses: Record<DeltaType, string> = {
    increase: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    decrease: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
    neutral: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800',
  };

  const deltaAriaLabel =
    delta?.label ||
    (delta
      ? deltaType === 'increase'
        ? `Increased by ${delta.value}`
        : deltaType === 'decrease'
          ? `Decreased by ${delta.value}`
          : `Changed by ${delta.value}`
      : undefined);

  // Sparkline SVG generator
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null;
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;
    const height = 28;
    const width = 64;
    const step = width / (sparklineData.length - 1);

    const points = sparklineData
      .map((val, idx) => {
        const x = idx * step;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
      })
      .join(' ');

    const strokeColor =
      deltaType === 'increase' ? '#10b981' : deltaType === 'decrease' ? '#f43f5e' : 'currentColor';

    return (
      <svg
        width={width}
        height={height}
        className="text-primary overflow-visible flex-shrink-0"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  const isClickable = Boolean(onClick);

  return (
    <div
      role={isClickable ? 'button' : 'region'}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={`${title}: ${typeof value === 'string' || typeof value === 'number' ? value : ''}`}
      className={`rounded-xl border border-border bg-card p-5 shadow-sm transition-all ${
        isClickable
          ? 'hover:border-foreground/40 hover:shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
          : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {title}
        </h3>
        {IconOrElement && (
          <div className="p-2 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
            {isValidElement(IconOrElement)
              ? IconOrElement
              : typeof IconOrElement === 'function' || typeof IconOrElement === 'object'
                ? React.createElement(
                    IconOrElement as ComponentType<{
                      className?: string;
                      'aria-hidden'?: string | boolean;
                    }>,
                    {
                      className: 'h-4 w-4',
                      'aria-hidden': 'true',
                    }
                  )
                : null}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-foreground font-data truncate">
          {value}
        </div>
        {renderSparkline()}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
        {delta && (
          <span
            aria-label={deltaAriaLabel}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium text-[11px] ${deltaColorClasses[deltaType]}`}
          >
            {deltaType === 'increase' && <TrendingUp className="h-3 w-3" aria-hidden="true" />}
            {deltaType === 'decrease' && <TrendingDown className="h-3 w-3" aria-hidden="true" />}
            {deltaType === 'neutral' && <Minus className="h-3 w-3" aria-hidden="true" />}
            <span>{delta.value}</span>
          </span>
        )}
        {subtitle && <span className="text-muted-foreground truncate">{subtitle}</span>}
      </div>
    </div>
  );
}

export default StatCard;
