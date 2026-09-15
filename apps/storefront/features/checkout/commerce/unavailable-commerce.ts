import type { CheckoutCommerce } from './checkout-commerce';

/**
 * This phase's commerce: ordering is not open, so every submission resolves `unavailable`.
 * No network call, no order, no reservation, no stock change, no transaction.
 */
export const unavailableCommerce: CheckoutCommerce = {
  async submit() {
    return { kind: 'unavailable' };
  },
};
