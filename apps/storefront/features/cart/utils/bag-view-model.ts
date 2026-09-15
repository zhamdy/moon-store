import type { AppLocale } from '@/i18n/routing';
import type { ToastTone } from '@/components/feedback/show-toast';
import { localizedName, type LocalizedText } from '@/features/products/utils/localized-name';
import { fillTemplate } from '@/lib/utils/fill-template';
import { MAX_LINE_QUANTITY } from '../constants';
import type { CartQuoteOption } from '../types/cart-quote';
import type { BagAnnouncementStrings, BagLineStrings } from './bag-strings';
import { selectPlural } from './plural-templates';
import { quantityControl, type QuantityControlState } from './quantity-control';
import type { BagAnnouncement, BagIssueCounts, BagNotice, BagRow, BagView } from './reconcile';

/**
 * Pure rules the bag surfaces (drawer, bag page) render with. Kept out of the components
 * because the storefront has no DOM harness: everything decided here is unit-tested.
 */

/** The removed row's fade before it unmounts (`--motion-fast`). */
export const REMOVE_FADE_MS = 180;

export type RemoveFocusTarget = { kind: 'line'; key: string } | { kind: 'empty' };

/**
 * The rows focus can land on when `targetKey` is removed: rows already fading out are
 * skipped, so two overlapping removals never hand focus to a row that is going away.
 */
export function visibleRowKeys(
  rowKeys: readonly string[],
  removing: ReadonlySet<string>,
  targetKey: string
): string[] {
  return rowKeys.filter((key) => key === targetKey || !removing.has(key));
}

/**
 * Where focus goes once a removed row unmounts (plan *Announcement policy*): the row that
 * followed it, else the one before it, else the empty-state heading. `keys` is the rendered
 * order (newest first).
 */
export function focusTargetAfterRemove(
  keys: readonly string[],
  removedKey: string
): RemoveFocusTarget {
  const index = keys.indexOf(removedKey);
  const remaining = keys.filter((key) => key !== removedKey);
  if (remaining.length === 0) return { kind: 'empty' };
  if (index < 0) return { kind: 'line', key: remaining[0]! };
  // After the filter, `remaining[index]` is the row that followed the removed one.
  return { kind: 'line', key: remaining[index] ?? remaining[index - 1]! };
}

/**
 * The row's display name: the quote's product, else the Add to Bag hint, else the
 * unavailable-piece text. `null` when nothing names it yet (no quote line and no hint): the
 * row renders its options, stepper and Remove with placeholders for name, photo and price.
 */
export function rowName(
  row: Pick<BagRow, 'product' | 'status' | 'provisional'>,
  locale: AppLocale,
  unavailablePiece: string
): LocalizedText | null {
  if (row.product) return localizedName(row.product, locale);
  if (row.provisional) return row.provisional.name;
  return row.status === 'productUnavailable' ? { text: unavailablePiece, lang: locale } : null;
}

export interface LineStepper {
  value: number;
  control: QuantityControlState;
}

type StepperRow = Pick<
  BagRow,
  'status' | 'line' | 'displayQuantity' | 'maxQuantity' | 'knownMaxQuantity'
>;

/**
 * The stepper for a row. A pending row holds at its last quoted limit. A `reduced` row
 * whose stored quantity exceeds the allowed one shows the allowed quantity, and neither
 * button is disabled: either press acts on the line by committing a quantity the quote
 * allows (CD-15), so an `aria-disabled` control never does something.
 */
export function lineStepper(row: StepperRow, pending: boolean): LineStepper {
  const unquoted = row.status === 'pending';
  const max = unquoted ? row.knownMaxQuantity : row.maxQuantity;
  const value = row.displayQuantity;
  const control = quantityControl(value, {
    status: row.status === 'pending' ? 'unquoted' : row.status,
    maxQuantity: max ?? undefined,
    pending,
  });
  if (row.status === 'reduced' && row.line.quantity !== value) {
    return { value, control: { ...control, decrementDisabled: false, incrementDisabled: false } };
  }
  return { value, control };
}

/** The quantity one press writes to the store, or `null` when it changes nothing. */
export function stepperCommitValue(
  storedQuantity: number,
  { value, control }: LineStepper,
  delta: 1 | -1
): number | null {
  const disabled = delta > 0 ? control.incrementDisabled : control.decrementDisabled;
  if (disabled) return null;
  const target = Math.min(Math.max(value + delta, 1), Math.max(1, control.limit));
  return target === storedQuantity ? null : target;
}

/** The + button's accessible description at the limit. */
export function stepperLimitText(
  control: Pick<QuantityControlState, 'incrementDescription' | 'limit'>,
  strings: Pick<BagLineStrings, 'notice'>
): string | null {
  switch (control.incrementDescription) {
    case 'stockLimit':
      return fillTemplate(strings.notice.quantityLimited, { count: control.limit });
    case 'capped':
      return fillTemplate(strings.notice.capped, { max: MAX_LINE_QUANTITY });
    default:
      return null;
  }
}

/** "Size: M, Colour: Black": storefront labels for known keys, the server's otherwise. */
export function optionText(
  options: readonly CartQuoteOption[],
  strings: Pick<BagLineStrings, 'optionValue' | 'optionLabels'>
): string {
  const labels: Readonly<Record<string, string | undefined>> = strings.optionLabels;
  return options
    .map((option) =>
      fillTemplate(strings.optionValue, {
        label: labels[option.key.toLowerCase()] ?? option.label,
        value: option.value,
      })
    )
    .join(', ');
}

export function noticeText(notice: BagNotice, strings: Pick<BagLineStrings, 'notice'>): string {
  return notice.kind === 'quantityLimited'
    ? fillTemplate(strings.notice.quantityLimited, { count: notice.count })
    : strings.notice[notice.kind];
}

const ISSUE_ORDER = [
  'unavailable',
  'limited',
  'priceUpdated',
] as const satisfies readonly (keyof BagIssueCounts)[];

/** "Your bag was updated. 1 piece is no longer available", or the load failure. */
export function bagAnnouncementText(
  announcement: BagAnnouncement,
  strings: Pick<BagAnnouncementStrings, 'updated' | 'issues' | 'errorLoad'>,
  locale: string
): string {
  if (announcement.kind === 'failed') return strings.errorLoad;
  const { issues } = announcement;
  return [
    strings.updated,
    ...ISSUE_ORDER.filter((kind) => issues[kind] > 0).map((kind) =>
      selectPlural(strings.issues[kind], issues[kind], locale)
    ),
  ].join('. ');
}

export type QuantitySettle =
  | { kind: 'wait' }
  | { kind: 'drop' }
  | { kind: 'announce'; count: number; subtotal: number };

/**
 * Whether a quantity change on `key` can be announced: only once a quote for the current
 * lines has settled, so several presses produce one message with the real subtotal.
 */
export function settledQuantity(view: BagView, key: string): QuantitySettle {
  if (view.kind === 'loading') return { kind: 'wait' };
  if (view.kind !== 'ready') return { kind: 'drop' };
  const { summary } = view;
  // A stale summary still shows the previous subtotal; only a current one is announced.
  if (summary.state !== 'current') return { kind: 'wait' };
  const row = view.rows.find((candidate) => candidate.key === key);
  if (!row) return { kind: 'drop' };
  if (row.status === 'pending') return { kind: 'wait' };
  return { kind: 'announce', count: row.displayQuantity, subtotal: summary.subtotal };
}

/**
 * A bag message as a toast (owner decision 2026-09-15). `action` names the handler the
 * controller attaches; its label is the same-named string. Ids are stable so a newer message
 * of the same kind replaces the one showing, and the drawer over `/bag` never stacks two.
 */
export interface BagToast {
  tone: ToastTone;
  message: string;
  id: string;
  action: 'undo' | 'retry' | null;
}

/** One id for the quote's status: an update notice and a failure replace each other. */
export const BAG_QUOTE_TOAST_ID = 'bag-quote';

export function bagAnnouncementToast(
  announcement: BagAnnouncement,
  strings: Pick<BagAnnouncementStrings, 'updated' | 'issues' | 'errorLoad'>,
  locale: string
): BagToast {
  return announcement.kind === 'failed'
    ? { tone: 'error', message: strings.errorLoad, id: BAG_QUOTE_TOAST_ID, action: 'retry' }
    : {
        tone: 'info',
        message: bagAnnouncementText(announcement, strings, locale),
        id: BAG_QUOTE_TOAST_ID,
        action: null,
      };
}

/** "{name}, quantity {count}. Subtotal {subtotal}", one toast per line, replaced on each change. */
export function quantityChangedToast(
  strings: Pick<BagAnnouncementStrings, 'quantityChanged'>,
  key: string,
  name: string,
  count: number,
  subtotal: string
): BagToast {
  return {
    tone: 'info',
    message: fillTemplate(strings.quantityChanged, { name, count, subtotal }),
    id: `bag-quantity:${key}`,
    action: null,
  };
}

/** "{name} removed from your bag" with Undo; per line, so two removals are two toasts. */
export function removedToast(
  strings: Pick<BagAnnouncementStrings, 'removed'>,
  key: string,
  name: string
): BagToast {
  return {
    tone: 'info',
    message: fillTemplate(strings.removed, { name }),
    id: `bag-removed:${key}`,
    action: 'undo',
  };
}
