import { unavailableCommerce } from './unavailable-commerce';

export type { CheckoutCommerce, CheckoutOutcome, CheckoutSubmission } from './checkout-commerce';

/** The active commerce strategy: the one line a future strategy replaces. */
export const checkoutCommerce = unavailableCommerce;
