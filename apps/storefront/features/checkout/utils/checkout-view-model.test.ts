import { describe, expect, it } from 'vitest';
import type { BagLineStrings } from '@/features/cart/utils/bag-strings';
import type { CheckoutReadiness } from '@/features/cart/utils/checkout-readiness';
import type { BagNotice, BagRow, BagRowStatus, BagSummary } from '@/features/cart/utils/reconcile';
import {
  checkoutNotice,
  checkoutNoticeText,
  fieldErrorText,
  outcomeToast,
  shouldShowFieldError,
  summaryLineModel,
  summaryOpen,
  summaryToggleLabel,
} from './checkout-view-model';

function family(one: string, other: string) {
  return { zero: other, one, two: other, few: other, many: other, other };
}

const LINE: BagLineStrings = {
  quantity: 'Quantity, {name}',
  increase: 'Increase quantity, {name}',
  decrease: 'Decrease quantity, {name}',
  remove: 'Remove',
  removeLabel: 'Remove {name}',
  optionValue: '{label}: {value}',
  optionLabels: { size: 'Size', color: 'Colour' },
  unitPrice: 'Price',
  lineTotal: 'Total',
  unavailablePiece: 'A piece that is no longer available',
  pendingPiece: 'This piece',
  updating: 'Updating',
  currency: 'EGP',
  notice: {
    soldOut: 'Sold out',
    variantUnavailable: 'This option is no longer available',
    productUnavailable: 'This piece is no longer available',
    quantityLimited: 'Only {count} available',
    priceUpdated: 'Price updated',
    capped: 'You can add up to {max} of this piece',
  },
};

const NOTICE = {
  checking: 'Checking your bag',
  blockedBody: 'Update your bag to continue: {names}',
  priceUpdatedBody: 'The prices shown are the current prices.',
  failed: "We couldn't check your bag",
  rejected: 'Your bag needs updating before you continue',
  returnToBag: 'Return to bag',
  tryAgain: 'Try again',
};

const ANNOUNCEMENTS = {
  updated: 'Your bag was updated',
  issues: {
    unavailable: family(
      '{count} piece is no longer available',
      '{count} pieces are no longer available'
    ),
    limited: family('{count} quantity limited', '{count} quantities limited'),
    priceUpdated: family('{count} price updated', '{count} prices updated'),
  },
};

function row(
  key: string,
  status: BagRowStatus,
  over: Partial<BagRow> = {},
  notices: BagNotice[] = []
): BagRow {
  return {
    key,
    line: { slug: key, options: { size: 'M' }, quantity: 5 },
    status,
    product: {
      slug: key,
      name: `ar:${key}`,
      nameEn: `Name ${key}`,
      image: { url: `https://m/${key}.jpg` },
    },
    provisional: null,
    options: [{ key: 'size', label: 'size', value: 'M' }],
    unitPrice: 2850,
    displayQuantity: 5,
    maxQuantity: 10,
    knownMaxQuantity: 10,
    lineTotal: 14250,
    notices,
    ...over,
  };
}

const READY: CheckoutReadiness = {
  kind: 'ready',
  quoteKey: 'q',
  pieces: 2,
  subtotal: 5700,
  priceUpdated: 0,
};

describe('checkoutNotice', () => {
  const base = {
    rows: [row('a', 'soldOut'), row('b', 'ok')],
    locale: 'en' as const,
    lineStrings: LINE,
  };

  it('nothing for a ready bag with no price change', () => {
    expect(checkoutNotice({ ...base, readiness: READY, attempted: true })).toBeNull();
  });

  it('a price change is an informational notice, not a block', () => {
    expect(
      checkoutNotice({ ...base, readiness: { ...READY, priceUpdated: 2 }, attempted: false })
    ).toEqual({ kind: 'priceUpdated', count: 2 });
  });

  it('checking shows only after Continue was pressed', () => {
    expect(
      checkoutNotice({ ...base, readiness: { kind: 'checking' }, attempted: false })
    ).toBeNull();
    expect(checkoutNotice({ ...base, readiness: { kind: 'checking' }, attempted: true })).toEqual({
      kind: 'checking',
    });
  });

  it('blocked names the affected pieces in rendered order', () => {
    expect(
      checkoutNotice({
        ...base,
        rows: [
          row('a', 'soldOut'),
          row('b', 'reduced'),
          row('c', 'productUnavailable', { product: null }),
        ],
        readiness: { kind: 'blocked', unavailable: 2, limited: 1, blockedKeys: ['a', 'b', 'c'] },
        attempted: false,
      })
    ).toEqual({
      kind: 'blocked',
      names: ['Name a', 'Name b', 'A piece that is no longer available'],
    });
  });

  it('failures carry whether a retry can help', () => {
    expect(
      checkoutNotice({ ...base, readiness: { kind: 'failed', rejected: true }, attempted: false })
    ).toEqual({ kind: 'failed', rejected: true });
  });
});

describe('checkoutNoticeText', () => {
  const strings = { notice: NOTICE, announcements: ANNOUNCEMENTS };

  it('blocked: bag updated, the names, Return to bag', () => {
    expect(
      checkoutNoticeText(
        { kind: 'blocked', names: ['Silk Midi Dress', 'Cashmere Pullover'] },
        strings,
        'en'
      )
    ).toEqual({
      heading: 'Your bag was updated',
      body: 'Update your bag to continue: Silk Midi Dress, Cashmere Pullover',
      action: 'returnToBag',
    });
    expect(checkoutNoticeText({ kind: 'blocked', names: ['أ', 'ب'] }, strings, 'ar').body).toBe(
      'Update your bag to continue: أ، ب'
    );
  });

  it('failed offers Try again; rejected sends back to the bag', () => {
    expect(checkoutNoticeText({ kind: 'failed', rejected: false }, strings, 'en').action).toBe(
      'tryAgain'
    );
    expect(checkoutNoticeText({ kind: 'failed', rejected: true }, strings, 'en')).toEqual({
      heading: 'Your bag needs updating before you continue',
      body: null,
      action: 'returnToBag',
    });
  });

  it('price updated is pluralised and has no action', () => {
    expect(checkoutNoticeText({ kind: 'priceUpdated', count: 1 }, strings, 'en')).toEqual({
      heading: '1 price updated',
      body: 'The prices shown are the current prices.',
      action: null,
    });
  });
});

describe('summaryToggleLabel', () => {
  const strings = {
    summary: { heading: 'Summary', toggle: 'Summary, {pieces}, {subtotal}' },
    bagSummary: { pieces: family('{count} piece', '{count} pieces'), updating: 'Updating' },
    currency: 'EGP',
  };
  const summary: BagSummary = {
    state: 'current',
    subtotal: 4500,
    purchasablePieces: 3,
    excludedPieces: 0,
    localPieces: 3,
  };

  it('names the pieces and the subtotal from a current quote', () => {
    expect(summaryToggleLabel(summary, strings, 'en')).toBe('Summary, 3 pieces, 4,500 EGP');
  });

  it('adds Updating while the figures are stale, and is just the heading before a quote', () => {
    expect(summaryToggleLabel({ ...summary, state: 'stale' }, strings, 'en')).toBe(
      'Summary, 3 pieces, 4,500 EGP, Updating'
    );
    expect(summaryToggleLabel(null, strings, 'en')).toBe('Summary');
  });
});

describe('summaryOpen', () => {
  it('opens by itself for a blocked bag unless the shopper chose', () => {
    const blocked: CheckoutReadiness = {
      kind: 'blocked',
      unavailable: 1,
      limited: 0,
      blockedKeys: ['a'],
    };
    expect(summaryOpen(null, blocked)).toBe(true);
    expect(summaryOpen(null, READY)).toBe(false);
    expect(summaryOpen(false, blocked)).toBe(false);
    expect(summaryOpen(true, READY)).toBe(true);
  });
});

describe('summaryLineModel', () => {
  it('ok: name, options, quantity, total and photograph', () => {
    expect(summaryLineModel(row('a', 'ok'), 'en', LINE)).toMatchObject({
      displayName: 'Name a',
      options: 'Size: M',
      quantity: 5,
      lineTotal: 14250,
      lineTotalStale: false,
      notices: [],
      imageUrl: 'https://m/a.jpg',
      photoUnknown: false,
    });
  });

  it('reduced shows the allowed quantity and its notice', () => {
    const reduced = row('a', 'reduced', { displayQuantity: 2, lineTotal: 5700 }, [
      { kind: 'quantityLimited', count: 2 },
    ]);
    expect(summaryLineModel(reduced, 'en', LINE)).toMatchObject({
      quantity: 2,
      lineTotal: 5700,
      notices: ['Only 2 available'],
    });
  });

  it('sold out has no total; a pending line keeps a stale total; unnamed rows are "This piece"', () => {
    expect(
      summaryLineModel(row('a', 'soldOut', { lineTotal: null }, [{ kind: 'soldOut' }]), 'en', LINE)
    ).toMatchObject({ lineTotal: null, notices: ['Sold out'] });
    expect(summaryLineModel(row('a', 'pending'), 'en', LINE).lineTotalStale).toBe(true);
    expect(
      summaryLineModel(row('a', 'pending', { product: null, lineTotal: null }), 'en', LINE)
    ).toMatchObject({ name: null, displayName: 'This piece', photoUnknown: true, imageUrl: null });
  });

  it('a provisional row uses the Add to Bag hint', () => {
    const provisional = row('a', 'pending', {
      product: null,
      lineTotal: null,
      provisional: {
        name: { text: 'Hint name', lang: 'en' },
        imageUrl: 'https://m/hint.jpg',
        unitPrice: 1900,
      },
    });
    expect(summaryLineModel(provisional, 'en', LINE)).toMatchObject({
      displayName: 'Hint name',
      imageUrl: 'https://m/hint.jpg',
      lineTotal: null,
    });
  });
});

describe('field errors and outcome', () => {
  const errors = {
    required: 'This is required',
    phoneInvalid: 'Enter a phone number of 8 to 15 digits',
    emailInvalid: 'Enter an email like name@example.com',
    tooLong: 'Use {max} characters or fewer',
  };

  it('fills the field limit into tooLong', () => {
    expect(fieldErrorText('tooLong', 'street', errors)).toBe('Use 150 characters or fewer');
    expect(fieldErrorText('required', 'fullName', errors)).toBe('This is required');
  });

  it('shows an error only once the field was left, or after Continue', () => {
    expect(shouldShowFieldError(false, false)).toBe(false);
    expect(shouldShowFieldError(true, false)).toBe(true);
    expect(shouldShowFieldError(false, true)).toBe(true);
  });

  it('the outcome toast is info with a stable id (preview copy)', () => {
    expect(outcomeToast({ kind: 'unavailable' }, { unavailablePreview: 'Not open yet' })).toEqual({
      tone: 'info',
      message: 'Not open yet',
      id: 'checkout-outcome',
    });
  });
});
