/**
 * The pinned settings baseline (D5, D5a).
 *
 * Tax and loyalty are *global* key/value rows, not per-sale inputs — `CartPanel` reads
 * them from `appSettings`, and `PUT /api/v1/settings` writes rows every worker shares. A
 * worker that flipped `tax_enabled` to test inclusive mode would silently change the
 * totals every other worker is asserting on. So the baseline is pinned once here, the
 * parallel project asserts against it and never writes settings, and only the mode
 * variants live in the serial `pos-settings` project.
 *
 * Tax is pinned *disabled* rather than enabled because six of the ten cases in
 * `contracts/checkout-totals.v1.json` specify `tax.enabled: false`. Under a tax-enabled
 * baseline those six could not be entered through the UI and still reach the total the
 * contract records, so the parallel project would have had almost nothing it could
 * assert. Every tax variant moves to the serial project instead, where a settings write
 * is already the point.
 *
 * The loyalty rates match the contract's `loyalty-redemption-and-earning` case:
 * `pointsPerEgp: 2` (points earned per 1 EGP) and `egpPerPointMinor: 10` (10 minor units
 * — 0.10 EGP — redeemed per 1 point). Neither is "per 100 points"; the direction is easy
 * to invert and the contract is the authority.
 */
export const SETTINGS_BASELINE: Readonly<Record<string, string>> = Object.freeze({
  tax_enabled: 'false',
  tax_rate: '0',
  tax_mode: 'exclusive',
  loyalty_enabled: 'true',
  loyalty_points_per_egp: '2',
  loyalty_egp_per_point: '0.1',
});

export const BASELINE_KEYS = Object.keys(SETTINGS_BASELINE);
