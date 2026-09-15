/**
 * The future commerce boundary (plan 2026-09-15-002, CO-17). The checkout UI stops here and
 * does not care what sits behind it: API-first order creation, gateway-first, IPN/webhook
 * confirmation, manual confirmation, COD or a mix. That strategy is deliberately undecided.
 *
 * Commerce invariants (owner decision 2026-09-15). Before any order becomes final, the
 * implementation behind this seam MUST, on the server: revalidate products and variants,
 * revalidate stock, reprice every line, determine delivery, and calculate the final payable
 * total. The quote shown on Checkout is authoritative for the current UI state only and is
 * never a transaction guarantee.
 *
 * Seam invariants for any adapter: the submission travels in a request body, never in a URL or
 * query string; a redirect outcome is followed only to an allowlisted origin; submission and
 * form values are never logged or sent to error reporting; credentials are explicit per
 * adapter; a successful outcome clears the checkout draft.
 */

export interface CheckoutSubmission {
  contact: {
    fullName: string;
    /** Normalised: ASCII digits, punctuation removed, optional leading `+`. */
    phone: string;
    email: string | null;
  };
  address: {
    /** Free text in this phase (CO-7). */
    governorate: string;
    area: string;
    street: string;
    apartment: string | null;
    landmark: string | null;
  };
  /** Null while no delivery rules exist (CO-18). */
  deliveryMethod: string | null;
  cart: {
    /**
     * `cartQuoteKey` of the lines the shopper saw. Untrusted client input, derived from the
     * same lines and blind to price and stock: a correlation value only, never proof of what
     * the shopper agreed to.
     */
    quoteKey: string;
    /** Intent only. No price, subtotal, name or image ever travels. */
    lines: readonly {
      slug: string;
      options: Readonly<Record<string, string>>;
      quantity: number;
    }[];
  };
}

/**
 * Phase 1 has one outcome. A real strategy adds its own (a redirect, pending confirmation, a
 * re-priced bag the UI must show before anything is final, a placed order) without the form
 * changing.
 */
export type CheckoutOutcome = { kind: 'unavailable' };

export interface CheckoutCommerce {
  submit(submission: CheckoutSubmission): Promise<CheckoutOutcome>;
}
