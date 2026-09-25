import type { InputHTMLAttributes } from 'react';
import { FieldError, FieldHint, FieldLabel } from '@/components/ui/field';
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
 * sheet's vocabulary: label above, a 52px bordered frame that carries the focus ring, and a
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
      <FieldLabel htmlFor={id} optional={optionalLabel}>
        {label}
      </FieldLabel>
      {hint && (
        <FieldHint id={hintId} className="mt-0.5">
          {hint}
        </FieldHint>
      )}
      {/* `.field-frame` (app/globals.css): the 52px box that carries hover, the focus ring
          and the invalid edge, so the input inside never draws its own. */}
      <div className="field-frame mt-2" data-invalid={error ? '' : undefined}>
        <input
          {...input}
          id={id}
          dir={ltr ? 'ltr' : undefined}
          aria-required={optionalLabel ? undefined : true}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'field-input scroll-mt-[calc(var(--header-h)+1.5rem)]',
            ltr && 'rtl:text-right'
          )}
        />
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
