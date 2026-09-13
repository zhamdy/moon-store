import { describe, it, expect } from 'vitest';
import { readTaxPolicy, readLoyaltyPolicy } from './checkoutSettings';

describe('readTaxPolicy', () => {
  it('is off when the settings row has not loaded yet', () => {
    expect(readTaxPolicy(undefined)).toEqual({ enabled: false, rate: 0, mode: 'exclusive' });
  });

  it('is off when the shop disabled tax, even with a rate still stored', () => {
    expect(readTaxPolicy({ tax_enabled: 'false', tax_rate: '14' }).enabled).toBe(false);
  });

  it('is off when tax is enabled but the rate is zero — no VAT line for a 0% shop', () => {
    expect(readTaxPolicy({ tax_enabled: 'true', tax_rate: '0' }).enabled).toBe(false);
  });

  it('reads an enabled exclusive rate', () => {
    expect(readTaxPolicy({ tax_enabled: 'true', tax_rate: '14' })).toEqual({
      enabled: true,
      rate: 14,
      mode: 'exclusive',
    });
  });

  it('reads inclusive mode, and treats anything else as exclusive', () => {
    expect(readTaxPolicy({ tax_enabled: 'true', tax_rate: '14', tax_mode: 'inclusive' }).mode).toBe(
      'inclusive'
    );
    expect(readTaxPolicy({ tax_enabled: 'true', tax_rate: '14' }).mode).toBe('exclusive');
  });

  it('treats a blank or unparseable rate as zero, which disables tax', () => {
    expect(readTaxPolicy({ tax_enabled: 'true', tax_rate: '' }).enabled).toBe(false);
    expect(readTaxPolicy({ tax_enabled: 'true', tax_rate: 'abc' }).rate).toBeNaN();
    expect(readTaxPolicy({ tax_enabled: 'true', tax_rate: 'abc' }).enabled).toBe(false);
  });
});

describe('readLoyaltyPolicy', () => {
  it('is off, but still carries seed defaults, when settings have not loaded', () => {
    expect(readLoyaltyPolicy(undefined)).toEqual({
      enabled: false,
      pointsPerEgp: 1,
      egpPerPoint: 0.1,
    });
  });

  it('reads the canonical direct-unit settings', () => {
    expect(
      readLoyaltyPolicy({
        loyalty_enabled: 'true',
        loyalty_points_per_egp: '2',
        loyalty_egp_per_point: '0.05',
      })
    ).toEqual({ enabled: true, pointsPerEgp: 2, egpPerPoint: 0.05 });
  });

  it('ignores the deprecated legacy aliases entirely', () => {
    // A shop still carrying the old keys must fall back to the canonical
    // defaults, not silently adopt reciprocal ("per 100") units.
    expect(
      readLoyaltyPolicy({
        loyalty_enabled: 'true',
        loyalty_earn_rate: '100',
        loyalty_redeem_value: '10',
      })
    ).toEqual({ enabled: true, pointsPerEgp: 1, egpPerPoint: 0.1 });
  });

  it('treats any value other than the literal "true" as disabled', () => {
    expect(readLoyaltyPolicy({ loyalty_enabled: 'false' }).enabled).toBe(false);
    expect(readLoyaltyPolicy({}).enabled).toBe(false);
  });
});
