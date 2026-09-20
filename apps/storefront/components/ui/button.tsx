import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

// `ComponentPropsWithRef` rather than `ButtonHTMLAttributes`: React 19 passes `ref` as an
// ordinary prop, so it reaches the native button through the spread with no forwardRef.
export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /**
   * `primary` ink, `secondary` an ink hairline, `brand` a bronze hairline that fills
   * bronze on hover - the commerce action on an editorial surface (the product card's
   * Add to Bag), where a solid ink block per card would read as a marketplace grid.
   */
  variant?: 'primary' | 'secondary' | 'brand';
  /** A trailing icon that shifts toward the inline end on hover/focus-visible. */
  trailingArrow?: ReactNode;
}

/**
 * Server-compatible: a styled native <button> with no hooks. Event handlers can
 * still be passed down from a client ancestor.
 */
export function Button({
  variant = 'primary',
  type = 'button',
  trailingArrow,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      // A native <button> defaults to submit, so one dropped inside a form would submit it.
      type={type}
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
        variant === 'brand' && [
          'border border-brand bg-transparent text-brand',
          'hover:bg-brand hover:text-brand-contrast active:bg-brand-dark active:text-brand-contrast',
          'disabled:border-disabled disabled:text-disabled disabled:hover:bg-transparent',
          'aria-disabled:cursor-not-allowed aria-disabled:border-disabled aria-disabled:text-disabled',
          'aria-disabled:hover:bg-transparent aria-disabled:hover:text-disabled',
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
