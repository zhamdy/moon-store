export type SettingsMap = Record<string, string>;
export type UpdateSettingsDTO = Record<string, string>;

// ─── Canonical loyalty settings (issue #31 / checkout financial contract) ───
//
// Loyalty is configured in direct units, never reciprocal ("currency per 100
// points") ones:
//   - `loyalty_points_per_egp`: points EARNED per 1 EGP of confirmed sale total.
//   - `loyalty_egp_per_point`:  EGP value REDEEMED per 1 point spent.
// Client and server must read these same keys and units so a redemption or
// earn calculation can never silently disagree between runtimes.
//
// Legacy alias keys `loyalty_earn_rate` / `loyalty_redeem_value` predate this
// naming but use the exact same direct units (see
// `server/src/modules/pos/sales/service.ts`'s existing formulas), so no
// reciprocal conversion is required when migrating a configured value from an
// alias to its canonical key.
//
// Precedence when both a canonical key and its alias are present: the
// canonical key always wins. This is a PRESENCE-based rule (does the
// canonical key exist at all?), not a validity-based one, so the SQL
// migration (`002_checkout_financial_contract.sql`, which only ever inserts a
// canonical key when it is entirely absent) and this parsing boundary agree
// on one deterministic outcome.

export const LOYALTY_ENABLED_KEY = 'loyalty_enabled';
export const LOYALTY_POINTS_PER_EGP_KEY = 'loyalty_points_per_egp';
export const LOYALTY_EGP_PER_POINT_KEY = 'loyalty_egp_per_point';

/** Pre-canonicalization alias key names. Same direct units; read-only compatibility. */
export const LOYALTY_EARN_RATE_ALIAS_KEY = 'loyalty_earn_rate';
export const LOYALTY_REDEEM_VALUE_ALIAS_KEY = 'loyalty_redeem_value';

export interface CanonicalLoyaltySettings {
  enabled: boolean;
  /** Points earned per 1 EGP of confirmed sale total. */
  pointsPerEgp: number;
  /** EGP value redeemed per 1 point spent. */
  egpPerPoint: number;
}

/**
 * Documented safe defaults. Used whenever a rate is absent, non-numeric,
 * zero, or negative, so a boundary failure degrades to a known-safe value
 * instead of an unvalidated or reciprocal-looking number. Loyalty defaults to
 * disabled so a settings problem can never silently start discounting or
 * awarding points.
 */
export const LOYALTY_SETTINGS_DEFAULTS: Readonly<CanonicalLoyaltySettings> = Object.freeze({
  enabled: false,
  pointsPerEgp: 1,
  egpPerPoint: 0.1,
});

/**
 * A configured rate must be a finite, strictly positive number. Zero,
 * negative, `NaN`, and non-numeric strings are all invalid and never used as
 * a business value.
 */
function isValidRate(raw: string | undefined): boolean {
  if (raw == null || raw.trim() === '') return false;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0;
}

function resolveRate(
  settings: SettingsMap,
  canonicalKey: string,
  aliasKey: string,
  fallback: number
): number {
  if (canonicalKey in settings) {
    return isValidRate(settings[canonicalKey]) ? Number(settings[canonicalKey]) : fallback;
  }
  if (aliasKey in settings) {
    return isValidRate(settings[aliasKey]) ? Number(settings[aliasKey]) : fallback;
  }
  return fallback;
}

/**
 * Parse the canonical loyalty configuration out of a raw settings map,
 * applying the canonical-wins precedence and safe-default boundary
 * validation documented above. Never throws: an invalid or missing value
 * always resolves to `LOYALTY_SETTINGS_DEFAULTS`, not an exception.
 */
export function parseLoyaltySettings(settings: SettingsMap): CanonicalLoyaltySettings {
  return {
    enabled: settings[LOYALTY_ENABLED_KEY] === 'true',
    pointsPerEgp: resolveRate(
      settings,
      LOYALTY_POINTS_PER_EGP_KEY,
      LOYALTY_EARN_RATE_ALIAS_KEY,
      LOYALTY_SETTINGS_DEFAULTS.pointsPerEgp
    ),
    egpPerPoint: resolveRate(
      settings,
      LOYALTY_EGP_PER_POINT_KEY,
      LOYALTY_REDEEM_VALUE_ALIAS_KEY,
      LOYALTY_SETTINGS_DEFAULTS.egpPerPoint
    ),
  };
}
