import { describe, expect, it } from 'vitest';
import { MIN_TOKEN_BYTES, isAuthorized, parseTokens } from './revalidate-token';

const A = 'a'.repeat(MIN_TOKEN_BYTES);
const B = 'b'.repeat(MIN_TOKEN_BYTES);

describe('parseTokens', () => {
  it('reads a current,next rotation list and trims it', () => {
    expect(parseTokens(`${A}, ${B}`)).toEqual([A, B]);
  });

  it('drops anything shorter than the floor rather than trusting it', () => {
    expect(parseTokens(`short,${A}`)).toEqual([A]);
    expect(parseTokens('short')).toEqual([]);
  });

  it('is empty for an unset or blank value', () => {
    expect(parseTokens(undefined)).toEqual([]);
    expect(parseTokens('')).toEqual([]);
  });
});

describe('isAuthorized', () => {
  it('accepts either side of a rotation', () => {
    expect(isAuthorized(A, `${A},${B}`)).toBe(true);
    expect(isAuthorized(B, `${A},${B}`)).toBe(true);
  });

  it('refuses a wrong token', () => {
    expect(isAuthorized('c'.repeat(MIN_TOKEN_BYTES), `${A},${B}`)).toBe(false);
  });

  /**
   * The load-bearing case: an unconfigured storefront must refuse, not open. An
   * unauthenticated revalidation endpoint would let anyone flush every page's cache.
   */
  it('refuses everything when no token is configured', () => {
    expect(isAuthorized(A, undefined)).toBe(false);
    expect(isAuthorized(A, '')).toBe(false);
    expect(isAuthorized(null, undefined)).toBe(false);
  });

  it('refuses a missing header even when configured', () => {
    expect(isAuthorized(null, A)).toBe(false);
    expect(isAuthorized('', A)).toBe(false);
  });

  it('refuses a token that is a prefix of the real one', () => {
    expect(isAuthorized(A.slice(0, -1), A)).toBe(false);
  });
});
