import type { CartLine } from '@/features/cart/utils/cart-lines';
import type { CheckoutSubmission } from '../commerce/checkout-commerce';
import type { CheckoutFormValues } from '../schemas/checkout-form';
import { normalizePhone } from './phone';

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The submission for the commerce seam: trimmed contact and address, the phone normalised, an
 * empty optional as null, and the stored intent lines. It carries no price, subtotal, name or
 * image: the server reprices everything (CO-17).
 */
export function buildSubmission(
  values: CheckoutFormValues,
  lines: readonly CartLine[],
  quoteKey: string,
  deliveryMethod: string | null = null
): CheckoutSubmission {
  return {
    contact: {
      fullName: values.fullName.trim(),
      phone: normalizePhone(values.phone),
      email: optional(values.email),
    },
    address: {
      governorate: values.governorate.trim(),
      area: values.area.trim(),
      street: values.street.trim(),
      apartment: optional(values.apartment),
      landmark: optional(values.landmark),
    },
    deliveryMethod,
    cart: {
      quoteKey,
      lines: lines.map(({ slug, options, quantity }) => ({
        slug,
        options: { ...options },
        quantity,
      })),
    },
  };
}
