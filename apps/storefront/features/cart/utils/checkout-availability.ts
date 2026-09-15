/**
 * Whether Checkout exists in this build (plan 2026-09-15-002, CO-22; owner decision
 * 2026-09-15): on in development and preview so it can be built and QA'd, off in production
 * until a commerce/order strategy exists. Off means no Bag entry and a real 404 on `/checkout`.
 *
 * An explicit `NEXT_PUBLIC_CHECKOUT_ENABLED` of `true` or `false` wins; anything else falls back
 * to "on unless this is a production build". Preview deployments are production builds, so
 * they set the flag to `true`; production leaves it unset.
 */
export function resolveCheckoutEnabled(
  nodeEnv: string | undefined,
  flag: string | undefined
): boolean {
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return nodeEnv !== 'production';
}

// Spelled out in full so Next inlines both at `next build`.
export const CHECKOUT_ENABLED = resolveCheckoutEnabled(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_CHECKOUT_ENABLED
);
