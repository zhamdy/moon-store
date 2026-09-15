import * as z from 'zod/v4/mini';
import { isPlausiblePhone } from '../utils/phone';

/**
 * The checkout form contract (plan 2026-09-15-002, *Field Specification*). The only module in
 * the storefront that imports Zod, and only the checkout route loads it (CO-10), so no other
 * page pays for it. Every rule lives in the pure `checkoutFieldError`; the schema wraps it so
 * TanStack Form consumes it as a Standard Schema.
 */

/** Field keys in DOM order: the one source for focus-first-invalid. */
export const CHECKOUT_FIELDS = [
  'fullName',
  'phone',
  'email',
  'governorate',
  'area',
  'street',
  'apartment',
  'landmark',
] as const;

export type CheckoutField = (typeof CHECKOUT_FIELDS)[number];
export type CheckoutFormValues = Record<CheckoutField, string>;

export const EMPTY_CHECKOUT_VALUES: CheckoutFormValues = {
  fullName: '',
  phone: '',
  email: '',
  governorate: '',
  area: '',
  street: '',
  apartment: '',
  landmark: '',
};

/**
 * Lengths fit the existing `online_orders` model (CO-8): street 150 + ", " + apartment 50 stays
 * under `shipping_address` 255, area under `city` 50, landmark under `notes` 500. Phone is
 * measured as typed.
 */
export const CHECKOUT_LIMITS: Readonly<Record<CheckoutField, number>> = {
  fullName: 100,
  phone: 30,
  email: 254,
  governorate: 50,
  area: 50,
  street: 150,
  apartment: 50,
  landmark: 200,
};

export const REQUIRED_CHECKOUT_FIELDS: ReadonlySet<CheckoutField> = new Set<CheckoutField>([
  'fullName',
  'phone',
  'governorate',
  'area',
  'street',
]);

/** Error messages are keys, resolved to EN/AR by the island; library text never renders. */
export const CHECKOUT_ERROR_KEYS = ['required', 'phoneInvalid', 'emailInvalid', 'tooLong'] as const;
export type CheckoutErrorKey = (typeof CHECKOUT_ERROR_KEYS)[number];

// Permissive on purpose: something@something.tld, no spaces. The server validates for real.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The first rule a field's value breaks, or null. Governorate is free text (CO-7). */
export function checkoutFieldError(field: CheckoutField, value: string): CheckoutErrorKey | null {
  const trimmed = value.trim();
  if (trimmed === '') return REQUIRED_CHECKOUT_FIELDS.has(field) ? 'required' : null;
  if (value.length > CHECKOUT_LIMITS[field]) return 'tooLong';
  if (field === 'phone' && !isPlausiblePhone(value)) return 'phoneInvalid';
  if (field === 'email' && !EMAIL_SHAPE.test(trimmed)) return 'emailInvalid';
  return null;
}

function fieldSchema(field: CheckoutField) {
  return z.string().check((ctx) => {
    const key = checkoutFieldError(field, ctx.value);
    if (key !== null) ctx.issues.push({ code: 'custom', message: key, input: ctx.value });
  });
}

export const checkoutFormSchema = z.object({
  fullName: fieldSchema('fullName'),
  phone: fieldSchema('phone'),
  email: fieldSchema('email'),
  governorate: fieldSchema('governorate'),
  area: fieldSchema('area'),
  street: fieldSchema('street'),
  apartment: fieldSchema('apartment'),
  landmark: fieldSchema('landmark'),
});
