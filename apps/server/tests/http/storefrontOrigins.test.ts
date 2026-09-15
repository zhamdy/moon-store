import { describe, expect, it } from 'vitest';
import { resolveStorefrontOrigins } from '../../src/app';

describe('resolveStorefrontOrigins', () => {
  it('opens no origin in production when unset', () => {
    expect(resolveStorefrontOrigins(undefined, 'production')).toEqual([]);
  });

  it.each(['development', 'test'])('defaults to the dev storefront in %s', (nodeEnv) => {
    expect(resolveStorefrontOrigins(undefined, nodeEnv)).toEqual(['http://localhost:3000']);
  });

  it('trims a comma list and drops blank entries', () => {
    expect(
      resolveStorefrontOrigins(
        ' https://shop.example.com , ,https://www.shop.example.com,  ',
        'production'
      )
    ).toEqual(['https://shop.example.com', 'https://www.shop.example.com']);
  });
});
