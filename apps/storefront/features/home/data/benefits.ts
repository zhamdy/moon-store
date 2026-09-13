import type { Messages } from 'next-intl';

export type BenefitKey = Exclude<keyof Messages['home']['benefits'], 'heading'>;

/**
 * Three typographic items — no icons, no cards (guideline §12·09). The wording in
 * `home.benefits.*` is generic on purpose: no numbers, timeframes or policy
 * specifics, because no shipping/returns/payment policy exists yet.
 * UNCONFIRMED: the user confirms or removes these before launch.
 */
export const benefits: readonly BenefitKey[] = ['delivery', 'returns', 'payment'];
