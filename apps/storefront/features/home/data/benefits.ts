import type { Messages } from 'next-intl';

export type BenefitKey = Exclude<keyof Messages['home']['benefits'], 'heading'>;

/**
 * Three benefits on a cream band with fine rules and small line icons (the icon map
 * lives in the component, keyed by `BenefitKey`, so adding one here fails to compile
 * until it has an icon). The wording in `home.benefits.*` is generic on purpose: no
 * coverage area, speed, return period, fee or "no questions asked", because no
 * operating policy is confirmed.
 *
 * UNCONFIRMED, launch blockers: `delivery` (B-1) and `payment` (B-3) await the real
 * policy and provider assurances. `returns` (B-2) is NEUTRALISED: its copy talks about
 * fabric quality and promises no service at all, until the business confirms whether
 * returns or exchanges are offered. The key is kept so that copy can be restored.
 */
export const benefits: readonly BenefitKey[] = ['delivery', 'returns', 'payment'];
