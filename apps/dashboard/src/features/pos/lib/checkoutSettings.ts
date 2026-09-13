/**
 * How the POS reads the global settings row into the two financial policies a
 * checkout depends on: tax and loyalty.
 *
 * Extracted from CartPanel so the parsing rules (which key is canonical, what
 * a missing/blank value defaults to, when tax counts as "off") can be
 * exercised without rendering the POS screen. Behaviour is unchanged from the
 * inline `useMemo`s it replaces.
 */
import type { TaxSettings, TaxMode } from '../../../shared/lib/checkout';
import type { AppSettings } from '../../../shared/types/index';

export interface LoyaltyPolicy {
  /** Gates BOTH earning and redemption, matching the server's single flag. */
  enabled: boolean;
  /** Points earned per 1 EGP of confirmed sale total. */
  pointsPerEgp: number;
  /** EGP value redeemed per ONE point (direct units, never a per-100 reciprocal). */
  egpPerPoint: number;
}

/**
 * Tax policy for this sale. `enabled` folds in the rate check deliberately: a
 * shop with tax switched on but a 0% rate shows no VAT line, which is what the
 * cart has always done.
 */
export function readTaxPolicy(appSettings?: AppSettings): TaxSettings {
  const enabled = appSettings?.tax_enabled === 'true';
  const rate = parseFloat(appSettings?.tax_rate || '0');
  const mode: TaxMode = appSettings?.tax_mode === 'inclusive' ? 'inclusive' : 'exclusive';
  return { enabled: enabled && rate > 0, rate, mode };
}

/**
 * Loyalty policy for this sale. Reads the canonical, direct-unit settings
 * (Unit 1) only -- never the legacy `loyalty_earn_rate`/`loyalty_redeem_value`
 * aliases. Defaults match `server/src/database/seed.ts`.
 */
export function readLoyaltyPolicy(appSettings?: AppSettings): LoyaltyPolicy {
  return {
    enabled: appSettings?.loyalty_enabled === 'true',
    pointsPerEgp: parseFloat(appSettings?.loyalty_points_per_egp || '1'),
    egpPerPoint: parseFloat(appSettings?.loyalty_egp_per_point || '0.1'),
  };
}
