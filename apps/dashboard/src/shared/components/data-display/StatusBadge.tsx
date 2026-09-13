import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'secondary'
  | 'outline';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  showDot?: boolean;
  dotClassName?: string;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    'bg-zinc-100 text-zinc-800 border-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
  primary:
    'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  secondary:
    'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  success:
    'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  warning:
    'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  danger:
    'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  info: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  outline: 'bg-transparent text-foreground border-border dark:text-foreground dark:border-border',
};

const dotVariantStyles: Record<BadgeVariant, string> = {
  default: 'bg-zinc-500',
  primary: 'bg-indigo-500',
  secondary: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-blue-500',
  outline: 'bg-foreground',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 h-5 leading-none gap-1.5',
  md: 'text-xs px-2.5 py-1 h-6 leading-none gap-2',
  lg: 'text-sm px-3 py-1.5 h-7 leading-none gap-2',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  showDot = false,
  dotClassName = '',
  className = '',
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center justify-center font-medium rounded-full border transition-colors select-none ${
        variantStyles[variant] || variantStyles.default
      } ${sizeStyles[size] || sizeStyles.sm} ${className}`}
      {...props}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
            dotVariantStyles[variant] || dotVariantStyles.default
          } ${dotClassName}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export type DeliveryStatus =
  | 'Order Received'
  | 'Shipping Contacted'
  | 'In Transit'
  | 'Pending'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export const statusVariants: Record<DeliveryStatus | string, BadgeVariant> = {
  'Order Received': 'warning',
  'Shipping Contacted': 'secondary',
  'In Transit': 'primary',
  Pending: 'warning',
  Preparing: 'secondary',
  'Out for Delivery': 'primary',
  Shipped: 'secondary',
  Delivered: 'success',
  Cancelled: 'danger',
};

export interface StatusBadgeProps {
  status: string;
  showDot?: boolean;
  size?: BadgeSize;
  className?: string;
}

export function StatusBadge({
  status,
  showDot = false,
  size = 'sm',
  className = '',
}: StatusBadgeProps): React.JSX.Element {
  const variant = statusVariants[status as DeliveryStatus] || 'default';
  return (
    <Badge variant={variant} size={size} showDot={showDot} className={className}>
      {status}
    </Badge>
  );
}

export default StatusBadge;
