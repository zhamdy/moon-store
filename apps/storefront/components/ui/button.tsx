import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'brand' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonStyleOptions {
  /**
   * - `primary`: the Ink action (Add to Bag, Show results, Try again). On a dark
   *   surface it inverts to Ivory with Ink text through `--surface-action`.
   * - `accent`: the solid Bronze action, kept for the one step forward in a flow
   *   (checkout's Continue). At most one per view.
   * - `secondary`: an outline in the text colour; fills on hover.
   * - `brand`: a Bronze hairline that fills Bronze on hover — the commerce action on an
   *   editorial surface, where a solid block per card would read as a marketplace grid.
   * - `quiet`: text only, uppercase, underlined; for a tertiary action beside a primary.
   */
  variant?: ButtonVariant;
  /** `sm` 44px (the touch floor), `md` 52px, `lg` 60px. */
  size?: ButtonSize;
  /** Full inline size. */
  block?: boolean;
  className?: string;
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-(--size-control-sm) px-5',
  md: 'min-h-(--size-control) px-8',
  lg: 'min-h-(--size-control-lg) px-10',
};

/**
 * The button family's classes, for the places a link has to look like a button (the
 * bag's Checkout entry, a toast action). One source, so a `<Link>` and a `<button>`
 * never drift apart. `type-label` sets the face, size and case: uppercase and tracked
 * in English, 16px and untracked in Arabic.
 */
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: ButtonStyleOptions = {}) {
  return cn(
    'group relative inline-flex items-center justify-center gap-3 rounded-control whitespace-nowrap',
    'type-label transition-[background-color,color,border-color] duration-fast ease-ui',
    'cursor-pointer disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
    variant !== 'quiet' && SIZES[size],
    block && 'w-full',
    variant === 'primary' && [
      'border border-action bg-action text-on-action',
      'hover:border-action-hover hover:bg-action-hover active:border-action-hover active:bg-action-hover',
      'disabled:border-disabled-surface disabled:bg-disabled-surface disabled:text-on-disabled',
      'aria-disabled:border-disabled-surface aria-disabled:bg-disabled-surface aria-disabled:text-on-disabled',
    ],
    variant === 'accent' && [
      'border border-accent bg-accent text-brand-contrast',
      'hover:border-accent-hover hover:bg-accent-hover active:border-accent-hover active:bg-accent-hover',
      'disabled:border-disabled-surface disabled:bg-disabled-surface disabled:text-on-disabled',
      'aria-disabled:border-disabled-surface aria-disabled:bg-disabled-surface aria-disabled:text-on-disabled',
    ],
    variant === 'secondary' && [
      'border border-text bg-transparent text-text',
      'hover:bg-text hover:text-on-action active:bg-text active:text-on-action',
      'disabled:border-disabled disabled:bg-transparent disabled:text-disabled',
      'aria-disabled:border-disabled aria-disabled:bg-transparent aria-disabled:text-disabled',
    ],
    variant === 'brand' && [
      'border border-brand bg-transparent text-brand',
      'hover:bg-brand hover:text-brand-contrast active:bg-brand-dark active:text-brand-contrast',
      'disabled:border-disabled disabled:text-disabled disabled:hover:bg-transparent',
      'aria-disabled:border-disabled aria-disabled:text-disabled',
      'aria-disabled:hover:bg-transparent aria-disabled:hover:text-disabled',
    ],
    variant === 'quiet' && [
      'min-h-(--size-tap) px-1 text-text',
      'bg-[linear-gradient(currentColor,currentColor)] bg-no-repeat bg-[length:100%_1px] bg-[position:0_calc(100%-10px)]',
      'rtl:bg-[position:100%_calc(100%-10px)]',
      'transition-[background-size,color] hover:bg-[length:0%_1px] hover:text-brand',
      'disabled:text-disabled aria-disabled:text-disabled',
    ],
    className
  );
}

// `ComponentPropsWithRef` rather than `ButtonHTMLAttributes`: React 19 passes `ref` as an
// ordinary prop, so it reaches the native button through the spread with no forwardRef.
export interface ButtonProps
  extends Omit<ComponentPropsWithRef<'button'>, 'className'>, ButtonStyleOptions {
  /** A trailing icon that shifts toward the inline end on hover/focus-visible. */
  trailingArrow?: ReactNode;
  /**
   * The busy state: the label stays in the layout (so the button keeps its width) but is
   * hidden, a hairline sweeps across instead, and `aria-busy` is set. The button stays
   * focusable; the caller decides whether a press while busy does anything.
   */
  loading?: boolean;
}

/**
 * Server-compatible: a styled native <button> with no hooks. Event handlers can
 * still be passed down from a client ancestor.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  type = 'button',
  trailingArrow,
  loading = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      // A native <button> defaults to submit, so one dropped inside a form would submit it.
      type={type}
      aria-busy={loading || undefined}
      data-loading={loading ? '' : undefined}
      className={buttonClassName({ variant, size, block, className })}
    >
      <span className={cn('inline-flex items-center gap-3', loading && 'invisible')}>
        {children}
        {trailingArrow && (
          <span
            aria-hidden="true"
            className="inline-flex transition-transform duration-fast ease-ui group-hover:translate-x-1 group-focus-visible:translate-x-1 rtl:group-hover:-translate-x-1 rtl:group-focus-visible:-translate-x-1"
          >
            {trailingArrow}
          </span>
        )}
      </span>
      {loading && <span aria-hidden="true" data-button-progress="" />}
    </button>
  );
}
