import { describe, expect, it } from 'vitest';
import type { BagAnnouncementStrings, BagLineStrings } from './bag-strings';
import {
  BAG_QUOTE_TOAST_ID,
  bagAnnouncementText,
  bagAnnouncementToast,
  focusTargetAfterRemove,
  visibleRowKeys,
  lineStepper,
  noticeText,
  optionText,
  quantityChangedToast,
  removedToast,
  rowName,
  settledQuantity,
  stepperCommitValue,
  stepperLimitText,
} from './bag-view-model';
import type { BagRow, BagSummary } from './reconcile';

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

const ANNOUNCE: BagAnnouncementStrings = {
  quantityChanged: '{name}, quantity {count}. Subtotal {subtotal}',
  removed: '{name} removed from your bag',
  undo: 'Undo',
  retry: 'Try again',
  updated: 'Your bag was updated',
  issues: {
    unavailable: {
      one: '{count} piece is no longer available',
      other: '{count} pieces are no longer available',
    },
    limited: { one: '{count} quantity limited', other: '{count} quantities limited' },
    priceUpdated: { one: '{count} price updated', other: '{count} prices updated' },
  },
  errorLoad: "We couldn't update your bag",
};

function rowOf(over: Partial<BagRow> = {}): BagRow {
  return {
    key: 'k',
    line: { slug: 'silk-midi-dress', options: { size: 'M' }, quantity: 2 },
    status: 'ok',
    product: {
      slug: 'silk-midi-dress',
      name: 'فستان حرير',
      nameEn: 'Silk Midi Dress',
      image: null,
    },
    provisional: null,
    options: [{ key: 'size', label: 'Size', value: 'M' }],
    unitPrice: 2850,
    displayQuantity: 2,
    maxQuantity: 10,
    knownMaxQuantity: 10,
    lineTotal: 5700,
    notices: [],
    ...over,
  };
}

const CURRENT: BagSummary = {
  state: 'current',
  subtotal: 5700,
  purchasablePieces: 2,
  excludedPieces: 0,
  localPieces: 2,
};

describe('visibleRowKeys', () => {
  it('skips a row already fading out, so overlapping removals never focus it', () => {
    // 'b' is removed first and still fading; 'c' is removed next.
    const removing = new Set(['b']);
    const keys = visibleRowKeys(['a', 'b', 'c', 'd'], removing, 'c');
    expect(keys).toEqual(['a', 'c', 'd']);
    expect(focusTargetAfterRemove(keys, 'c')).toEqual({ kind: 'line', key: 'd' });
  });

  it('falls back past a fading neighbour to the row before', () => {
    const removing = new Set(['c']);
    const keys = visibleRowKeys(['a', 'b', 'c'], removing, 'b');
    expect(keys).toEqual(['a', 'b']);
    expect(focusTargetAfterRemove(keys, 'b')).toEqual({ kind: 'line', key: 'a' });
  });

  it('lands on the empty state when the only other row is fading', () => {
    const keys = visibleRowKeys(['a', 'b'], new Set(['a']), 'b');
    expect(focusTargetAfterRemove(keys, 'b')).toEqual({ kind: 'empty' });
  });
});

describe('focusTargetAfterRemove', () => {
  it('moves to the next row, else the previous one, else the empty heading', () => {
    expect(focusTargetAfterRemove(['a', 'b', 'c'], 'b')).toEqual({ kind: 'line', key: 'c' });
    expect(focusTargetAfterRemove(['a', 'b', 'c'], 'a')).toEqual({ kind: 'line', key: 'b' });
    expect(focusTargetAfterRemove(['a', 'b', 'c'], 'c')).toEqual({ kind: 'line', key: 'b' });
    expect(focusTargetAfterRemove(['a'], 'a')).toEqual({ kind: 'empty' });
  });

  it('an unknown key falls back to the first remaining row', () => {
    expect(focusTargetAfterRemove(['a', 'b'], 'x')).toEqual({ kind: 'line', key: 'a' });
    expect(focusTargetAfterRemove([], 'x')).toEqual({ kind: 'empty' });
  });
});

describe('rowName', () => {
  it('localizes a quoted product and marks a fallback language', () => {
    expect(rowName(rowOf(), 'en', LINE.unavailablePiece)).toEqual({
      text: 'Silk Midi Dress',
      lang: 'en',
    });
    expect(rowName(rowOf(), 'ar', LINE.unavailablePiece)).toEqual({
      text: 'فستان حرير',
      lang: 'ar',
    });
  });

  it('names an unavailable piece, and nothing names a line no quote has seen', () => {
    const gone = rowOf({ status: 'productUnavailable', product: null });
    expect(rowName(gone, 'en', LINE.unavailablePiece)).toEqual({
      text: LINE.unavailablePiece,
      lang: 'en',
    });
    expect(rowName(rowOf({ status: 'pending', product: null }), 'en', 'x')).toBeNull();
  });

  it('names a line no quote has seen from its Add to Bag hint, and the quote wins once present', () => {
    const provisional = {
      name: { text: 'فستان حرير', lang: 'ar' as const },
      imageUrl: null,
      unitPrice: 2850,
    };
    expect(rowName(rowOf({ status: 'pending', product: null, provisional }), 'en', 'x')).toEqual({
      text: 'فستان حرير',
      lang: 'ar',
    });
    expect(rowName(rowOf({ provisional }), 'en', 'x')).toEqual({
      text: 'Silk Midi Dress',
      lang: 'en',
    });
  });
});

describe('lineStepper and stepperCommitValue', () => {
  it('ok row: steps within 1..limit and stops at both ends', () => {
    const mid = lineStepper(rowOf(), false);
    expect(mid.control).toMatchObject({ decrementDisabled: false, incrementDisabled: false });
    expect(stepperCommitValue(2, mid, 1)).toBe(3);
    expect(stepperCommitValue(2, mid, -1)).toBe(1);

    const one = rowOf({ line: { ...rowOf().line, quantity: 1 }, displayQuantity: 1 });
    expect(stepperCommitValue(1, lineStepper(one, false), -1)).toBeNull();

    const ten = rowOf({ line: { ...rowOf().line, quantity: 10 }, displayQuantity: 10 });
    const capped = lineStepper(ten, false);
    expect(capped.control.incrementDisabled).toBe(true);
    expect(stepperCommitValue(10, capped, 1)).toBeNull();
    expect(stepperLimitText(capped.control, LINE)).toBe('You can add up to 10 of this piece');
  });

  it('pending row holds at the last quoted limit; unquoted defaults to the cap', () => {
    const held = lineStepper(
      rowOf({
        status: 'pending',
        line: { ...rowOf().line, quantity: 3 },
        displayQuantity: 3,
        maxQuantity: null,
        knownMaxQuantity: 3,
      }),
      true
    );
    expect(held.control).toMatchObject({ incrementDisabled: true, limit: 3 });
    expect(stepperLimitText(held.control, LINE)).toBe('Only 3 available');

    const unquoted = lineStepper(
      rowOf({ status: 'pending', maxQuantity: null, knownMaxQuantity: null }),
      true
    );
    expect(unquoted.control).toMatchObject({ incrementDisabled: false, limit: 10 });
  });

  it('reduced row: both presses commit a quantity the quote allows', () => {
    const reduced = rowOf({
      status: 'reduced',
      line: { ...rowOf().line, quantity: 4 },
      displayQuantity: 2,
      maxQuantity: 2,
      knownMaxQuantity: 2,
      notices: [{ kind: 'quantityLimited', count: 2 }],
    });
    const stepper = lineStepper(reduced, false);
    expect(stepper.value).toBe(2);
    expect(stepper.control).toMatchObject({ decrementDisabled: false, incrementDisabled: false });
    expect(stepperCommitValue(4, stepper, 1)).toBe(2);
    expect(stepperCommitValue(4, stepper, -1)).toBe(1);
    expect(stepperLimitText(stepper.control, LINE)).toBe('Only 2 available');

    const single = lineStepper({ ...reduced, displayQuantity: 1, maxQuantity: 1 }, false);
    expect(stepperCommitValue(4, single, 1)).toBe(1);
    expect(stepperCommitValue(4, single, -1)).toBe(1);
  });

  it('sold out and unavailable rows commit nothing', () => {
    for (const status of ['soldOut', 'variantUnavailable', 'productUnavailable'] as const) {
      const stepper = lineStepper(rowOf({ status, maxQuantity: 0, lineTotal: null }), false);
      expect(stepper.control).toMatchObject({ decrementDisabled: true, incrementDisabled: true });
      expect(stepperCommitValue(2, stepper, 1)).toBeNull();
      expect(stepperCommitValue(2, stepper, -1)).toBeNull();
    }
  });
});

describe('line text', () => {
  it('labels known option keys from the storefront and others from the server', () => {
    expect(
      optionText(
        [
          { key: 'size', label: 'size', value: 'M' },
          { key: 'fabric', label: 'Fabric', value: 'Silk' },
        ],
        LINE
      )
    ).toBe('Size: M, Fabric: Silk');
    expect(optionText([], LINE)).toBe('');
  });

  it('fills the quantity-limited notice', () => {
    expect(noticeText({ kind: 'quantityLimited', count: 2 }, LINE)).toBe('Only 2 available');
    expect(noticeText({ kind: 'priceUpdated' }, LINE)).toBe('Price updated');
  });
});

describe('announcements', () => {
  it('lists only the issue kinds present, pluralized', () => {
    expect(
      bagAnnouncementText(
        { kind: 'updated', markKey: 'q', issues: { unavailable: 1, limited: 0, priceUpdated: 2 } },
        ANNOUNCE,
        'en'
      )
    ).toBe('Your bag was updated. 1 piece is no longer available. 2 prices updated');
    expect(bagAnnouncementText({ kind: 'failed', markKey: 'f' }, ANNOUNCE, 'en')).toBe(
      ANNOUNCE.errorLoad
    );
  });

  it('a quantity change waits for a current quote, then announces once', () => {
    const rows = [rowOf({ line: { ...rowOf().line, quantity: 3 }, displayQuantity: 3 })];
    expect(settledQuantity({ kind: 'loading', rows, localPieces: 3 }, 'k')).toEqual({
      kind: 'wait',
    });
    // A stale summary shows the previous subtotal, which is never announced.
    expect(
      settledQuantity({ kind: 'ready', rows, summary: { ...CURRENT, state: 'stale' } }, 'k')
    ).toEqual({ kind: 'wait' });
    expect(settledQuantity({ kind: 'ready', rows, summary: CURRENT }, 'k')).toEqual({
      kind: 'announce',
      count: 3,
      subtotal: 5700,
    });
    expect(settledQuantity({ kind: 'ready', rows, summary: CURRENT }, 'gone')).toEqual({
      kind: 'drop',
    });
    expect(
      settledQuantity({ kind: 'failed', localPieces: 3, canRetry: true, canEmpty: false }, 'k')
    ).toEqual({ kind: 'drop' });
  });
});

describe('bag toasts', () => {
  it('maps a settled update to an info toast with no action', () => {
    expect(
      bagAnnouncementToast(
        { kind: 'updated', markKey: 'q', issues: { unavailable: 0, limited: 1, priceUpdated: 0 } },
        ANNOUNCE,
        'en'
      )
    ).toEqual({
      tone: 'info',
      message: 'Your bag was updated. 1 quantity limited',
      id: BAG_QUOTE_TOAST_ID,
      action: null,
    });
  });

  it('maps a quote failure to an error toast with Try again, under the same id', () => {
    expect(bagAnnouncementToast({ kind: 'failed', markKey: 'f' }, ANNOUNCE, 'en')).toEqual({
      tone: 'error',
      message: "We couldn't update your bag",
      id: BAG_QUOTE_TOAST_ID,
      action: 'retry',
    });
  });

  it('gives each line one quantity toast, replaced on the next change', () => {
    const first = quantityChangedToast(ANNOUNCE, 'k', 'Silk Midi Dress', 3, '8,550 EGP');
    expect(first).toEqual({
      tone: 'info',
      message: 'Silk Midi Dress, quantity 3. Subtotal 8,550 EGP',
      id: 'bag-quantity:k',
      action: null,
    });
    expect(quantityChangedToast(ANNOUNCE, 'k', 'Silk Midi Dress', 4, '11,400 EGP').id).toBe(
      first.id
    );
    expect(quantityChangedToast(ANNOUNCE, 'other', 'Tote', 1, '900 EGP').id).not.toBe(first.id);
  });

  it('offers Undo on a removal, per line', () => {
    expect(removedToast(ANNOUNCE, 'k', 'Silk Midi Dress')).toEqual({
      tone: 'info',
      message: 'Silk Midi Dress removed from your bag',
      id: 'bag-removed:k',
      action: 'undo',
    });
  });
});
