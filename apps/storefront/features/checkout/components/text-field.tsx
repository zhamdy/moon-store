import { CircleAlert } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'id' | 'aria-describedby'
> {
  id: string;
  label: string;
  /** The visible "Optional" marker; omitted for required fields, which carry `aria-required`. */
  optionalLabel?: string;
  hint?: string;
  /** The resolved error, or null while none is shown. */
  error: string | null;
  className?: string;
  /** Text typed in another direction than the page (phone, email): aligned to the page's start. */
  ltr?: boolean;
}

/**
 * A labelled checkout input (plan 2026-09-15-002, *Field Specification*), in the filter
 * sheet's vocabulary: label above, a 48px bordered frame that carries the focus ring, and a
 * reserved error row with icon and text, so an error never moves the fields below it and colour
 * never carries it alone. The error is linked with `aria-describedby`, never a live region:
 * focus is the announcement (CO-12). Client-bundled: only the checkout island renders it.
 */
export function TextField({
  id,
  label,
  optionalLabel,
  hint,
  error,
  className,
  ltr = false,
  ...input
}: TextFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <label htmlFor={id} className="type-small text-text">
        {label}
        {optionalLabel && <span className="text-text-secondary"> ({optionalLabel})</span>}
      </label>
      {hint && (
        <p id={hintId} className="type-small text-text-secondary">
          {hint}
        </p>
      )}
      <div
        className={cn(
          'mt-2 flex min-h-12 items-center rounded-sm border bg-bg transition-colors duration-fast ease-ui',
          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--focus-ring-color)',
          error ? 'border-text' : 'border-border'
        )}
      >
        <input
          {...input}
          id={id}
          dir={ltr ? 'ltr' : undefined}
          aria-required={optionalLabel ? undefined : true}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'type-body min-w-0 flex-1 scroll-mt-[calc(var(--header-h)+1.5rem)] bg-transparent px-3 py-2 focus:outline-none',
            ltr && 'rtl:text-right'
          )}
        />
      </div>
      <div className="min-h-6 pt-2">
        {error && (
          <p id={errorId} className="type-small flex items-start gap-2 text-error">
            <CircleAlert
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
