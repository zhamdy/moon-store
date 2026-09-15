import {
  CHECKOUT_ERROR_KEYS,
  CHECKOUT_FIELDS,
  type CheckoutErrorKey,
  type CheckoutField,
} from '../schemas/checkout-form';

const KNOWN: ReadonlySet<string> = new Set(CHECKOUT_ERROR_KEYS);

/**
 * A field's first error as a message key. TanStack Form hands errors over as Standard Schema
 * issues (or strings); anything that is not one of our keys reads as `required`, so raw
 * library text can never reach the page.
 */
export function fieldErrorKey(errors: readonly unknown[] | undefined): CheckoutErrorKey | null {
  const first = errors?.find((error) => error !== undefined && error !== null && error !== false);
  if (first === undefined) return null;
  const message =
    typeof first === 'string'
      ? first
      : typeof first === 'object' && first !== null && 'message' in first
        ? (first as { message: unknown }).message
        : null;
  return typeof message === 'string' && KNOWN.has(message)
    ? (message as CheckoutErrorKey)
    : 'required';
}

/** The first field, in DOM order, that has an error; focus goes there after Continue (CO-12). */
export function firstInvalidField(
  errorsByField: Partial<Record<CheckoutField, readonly unknown[] | undefined>>,
  order: readonly CheckoutField[] = CHECKOUT_FIELDS
): CheckoutField | null {
  return order.find((field) => fieldErrorKey(errorsByField[field]) !== null) ?? null;
}

/**
 * How to move focus to the first invalid field: a plain `focus()`, or, when that field already
 * has focus (Enter pressed inside it), blur it and focus it again on the next frame, since
 * `focus()` on the focused element fires nothing and the error would go unannounced. Never a
 * toast (owner decision 2026-09-15).
 */
export function focusPlan(targetIsActive: boolean): 'focus' | 'refocus' {
  return targetIsActive ? 'refocus' : 'focus';
}
