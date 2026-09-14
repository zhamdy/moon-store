import type { Messages } from 'next-intl';

export type BenefitKey = Exclude<keyof Messages['home']['benefits'], 'heading'>;

/**
 * Three benefits, shown as cards with icons (the icon map lives in the component,
 * keyed by `BenefitKey`, so adding one here fails to compile until it has an icon). The wording in
 * `home.benefits.*` is generic on purpose: no numbers, timeframes or policy
 * specifics, because no shipping/returns/payment policy exists yet.
 * UNCONFIRMED: the user confirms or removes these before launch.
 */
export const benefits: readonly BenefitKey[] = ['delivery', 'returns', 'payment'];
