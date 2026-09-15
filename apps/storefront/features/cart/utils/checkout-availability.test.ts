import { describe, expect, it } from 'vitest';
import { resolveCheckoutEnabled } from './checkout-availability';

describe('resolveCheckoutEnabled', () => {
  it('defaults to on outside production builds and off in them', () => {
    expect(resolveCheckoutEnabled('development', undefined)).toBe(true);
    expect(resolveCheckoutEnabled('test', undefined)).toBe(true);
    expect(resolveCheckoutEnabled('production', undefined)).toBe(false);
  });

  it('an explicit true or false wins (preview sets true)', () => {
    expect(resolveCheckoutEnabled('production', 'true')).toBe(true);
    expect(resolveCheckoutEnabled('development', 'false')).toBe(false);
  });

  it('any other flag value falls back to the NODE_ENV default', () => {
    expect(resolveCheckoutEnabled('production', '1')).toBe(false);
    expect(resolveCheckoutEnabled('production', 'yes')).toBe(false);
    expect(resolveCheckoutEnabled('development', '')).toBe(true);
  });
});
