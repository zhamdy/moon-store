import type { Messages } from 'next-intl';

export type BenefitKey = Exclude<keyof Messages['home']['benefits'], 'heading'>;

/**
 * Three benefits, shown as cards with icons (the icon map lives in the component,
 * keyed by `BenefitKey`, so adding one here fails to compile until it has an icon). The wording in
 * `home.benefits.*` is generic on purpose: no coverage area, speed, return period,
 * fees or "no questions asked", because no delivery or returns policy is confirmed.
 * UNCONFIRMED: `delivery` and `returns` need checking against the real Moon Fashion
 * operating policy before launch; do not strengthen them until it exists.
 */
export const benefits: readonly BenefitKey[] = ['delivery', 'returns', 'payment'];
