import React from 'react';

export interface BaseSkeletonProps {
  className?: string;
  'aria-label'?: string;
}

export function Skeleton({
  className = '',
  'aria-label': ariaLabel = 'Loading...',
}: BaseSkeletonProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      className={`animate-pulse rounded-md bg-muted/70 dark:bg-zinc-800 ${className}`}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}

export interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export function CardSkeleton({ count = 1, className = '' }: CardSkeletonProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading cards"
      className={`grid gap-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  hasHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  hasHeader = true,
  className = '',
}: TableSkeletonProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading table data"
      className={`w-full rounded-xl border border-border bg-card overflow-hidden shadow-sm ${className}`}
    >
      {hasHeader && (
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 gap-4">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      )}
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-4 py-2 border-b border-border/40 last:border-0"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={`h-5 ${
                  colIndex === 0 ? 'w-1/4' : colIndex === columns - 1 ? 'w-1/6 ms-auto' : 'flex-1'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

export function FormSkeleton({ fields = 4, className = '' }: FormSkeletonProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading form"
      className={`rounded-xl border border-border bg-card p-6 space-y-5 ${className}`}
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
    </div>
  );
}

export interface ContentSkeletonProps {
  lines?: number;
  className?: string;
}

export function ContentSkeleton({
  lines = 3,
  className = '',
}: ContentSkeletonProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading content"
      className={`space-y-2.5 ${className}`}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export default Skeleton;
