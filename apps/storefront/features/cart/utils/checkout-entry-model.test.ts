import { describe, expect, it } from 'vitest';
import {
  checkoutEntryModel,
  checkoutEntryReasonText,
  type CheckoutEntryStrings,
} from './checkout-entry-model';
import type { CheckoutReadiness } from './checkout-readiness';

const READY: CheckoutReadiness = {
  kind: 'ready',
  quoteKey: 'q',
  pieces: 2,
  subtotal: 5700,
  priceUpdated: 0,
};

function family(one: string, other: string) {
  return { zero: other, one, two: other, few: other, many: other, other };
}

const STRINGS: CheckoutEntryStrings = {
  action: 'Checkout',
  checking: 'Checking your bag',
  failed: 'Your bag could not be checked',
  blockedUnavailable: family(
    'Remove {count} unavailable piece to continue',
    'Remove {count} unavailable pieces to continue'
  ),
  blockedLimited: family(
    'Update the quantity of {count} piece to continue',
    'Update the quantities of {count} pieces to continue'
  ),
};

describe('checkoutEntryModel', () => {
  it('a ready bag gets the link', () => {
    expect(checkoutEntryModel(READY, true)).toEqual({ kind: 'link' });
  });

  it('renders nothing for an empty or unknown bag, or when Checkout is off', () => {
    expect(checkoutEntryModel({ kind: 'empty' }, true)).toEqual({ kind: 'none' });
    expect(checkoutEntryModel({ kind: 'hydrating' }, true)).toEqual({ kind: 'none' });
    expect(checkoutEntryModel(READY, false)).toEqual({ kind: 'none' });
    expect(checkoutEntryModel({ kind: 'checking' }, false)).toEqual({ kind: 'none' });
  });

  it('checking and failed are unavailable with their reason', () => {
    expect(checkoutEntryModel({ kind: 'checking' }, true)).toEqual({
      kind: 'unavailable',
      reason: { kind: 'checking' },
    });
    expect(checkoutEntryModel({ kind: 'failed', rejected: false }, true)).toEqual({
      kind: 'unavailable',
      reason: { kind: 'failed' },
    });
  });

  it('blocked: unavailable lines win over limited ones', () => {
    expect(
      checkoutEntryModel(
        { kind: 'blocked', unavailable: 2, limited: 1, blockedKeys: ['a', 'b', 'c'] },
        true
      )
    ).toEqual({ kind: 'unavailable', reason: { kind: 'unavailable', count: 2 } });
    expect(
      checkoutEntryModel({ kind: 'blocked', unavailable: 0, limited: 1, blockedKeys: ['a'] }, true)
    ).toEqual({ kind: 'unavailable', reason: { kind: 'limited', count: 1 } });
  });
});

describe('checkoutEntryReasonText', () => {
  it('pluralises the blocked reasons', () => {
    expect(checkoutEntryReasonText({ kind: 'unavailable', count: 1 }, STRINGS, 'en')).toBe(
      'Remove 1 unavailable piece to continue'
    );
    expect(checkoutEntryReasonText({ kind: 'limited', count: 3 }, STRINGS, 'en')).toBe(
      'Update the quantities of 3 pieces to continue'
    );
    expect(checkoutEntryReasonText({ kind: 'checking' }, STRINGS, 'en')).toBe('Checking your bag');
  });
});
