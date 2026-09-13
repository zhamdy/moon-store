import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  /** A trailing icon that shifts toward the inline end on hover/focus-visible. */
  trailingArrow?: ReactNode;
}

/**
 * Server-compatible: a styled native <button> with no hooks. Event handlers can
 * still be passed down from a client ancestor.
 */
export function Button({
  variant = 'primary',
  trailingArrow,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      data-surface={variant === 'primary' ? 'ink' : undefined}
      className={cn(
        'group inline-flex min-h-12 items-center justify-center gap-2 rounded-sm px-7',
        'font-body font-medium transition-colors duration-fast ease-ui',
        'disabled:cursor-not-allowed',
        variant === 'primary' && [
          'bg-action text-on-action',
          'hover:bg-action-hover active:bg-action-hover',
          'disabled:bg-disabled disabled:text-on-action disabled:hover:bg-disabled',
        ],
        variant === 'secondary' && [
          'border border-text bg-transparent text-text',
          'hover:bg-surface-soft',
          'disabled:border-disabled disabled:text-disabled disabled:hover:bg-transparent',
        ],
        className
      )}
    >
      {children}
      {trailingArrow && (
        <span
          aria-hidden="true"
          className="inline-flex transition-transform duration-fast ease-ui group-hover:translate-x-1 group-focus-visible:translate-x-1 rtl:group-hover:-translate-x-1 rtl:group-focus-visible:-translate-x-1"
        >
          {trailingArrow}
        </span>
      )}
    </button>
  );
}
