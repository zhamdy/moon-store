import type { AppLocale } from '@/i18n/routing';
import type { ShowToastInput } from '@/components/feedback/show-toast';
import type { BagLineStrings, BagSummaryStrings } from '@/features/cart/utils/bag-strings';
import type { BagAnnouncementStrings } from '@/features/cart/utils/bag-strings';
import { noticeText, optionText, rowName } from '@/features/cart/utils/bag-view-model';
import type { CheckoutReadiness } from '@/features/cart/utils/checkout-readiness';
import { selectPlural } from '@/features/cart/utils/plural-templates';
import type { BagRow, BagSummary } from '@/features/cart/utils/reconcile';
import type { LocalizedText } from '@/features/products/utils/localized-name';
import { formatPrice } from '@/features/products/utils/price';
import { fillTemplate } from '@/lib/utils/fill-template';
import type { CheckoutOutcome } from '../commerce/checkout-commerce';
import {
  CHECKOUT_LIMITS,
  type CheckoutErrorKey,
  type CheckoutField,
} from '../schemas/checkout-form';
import type { CheckoutPageStrings } from './checkout-strings';

/**
 * Pure rules the checkout island renders with (plan 2026-09-15-002, Unit 7). Kept out of the
 * components because the storefront has no DOM harness: everything decided here is tested.
 */

function listSeparator(locale: AppLocale): string {
  return locale === 'ar' ? '، ' : ', ';
}

export type CheckoutNotice =
  | { kind: 'checking' }
  | { kind: 'blocked'; names: readonly string[] }
  | { kind: 'failed'; rejected: boolean }
  | { kind: 'priceUpdated'; count: number };

export interface CheckoutNoticeInput {
  readiness: CheckoutReadiness;
  /** Continue was pressed: only then does "checking" show, so entry never flashes it. */
  attempted: boolean;
  rows: readonly BagRow[];
  locale: AppLocale;
  lineStrings: Pick<BagLineStrings, 'unavailablePiece' | 'pendingPiece'>;
}

/** What the cart notice above the form says, or null (CO-13). Never a live region. */
export function checkoutNotice({
  readiness,
  attempted,
  rows,
  locale,
  lineStrings,
}: CheckoutNoticeInput): CheckoutNotice | null {
  switch (readiness.kind) {
    case 'checking':
      return attempted ? { kind: 'checking' } : null;
    case 'blocked':
      return {
        kind: 'blocked',
        names: readiness.blockedKeys.map((key) => {
          const row = rows.find((candidate) => candidate.key === key);
          const name = row ? rowName(row, locale, lineStrings.unavailablePiece) : null;
          return name?.text ?? lineStrings.pendingPiece;
        }),
      };
    case 'failed':
      return { kind: 'failed', rejected: readiness.rejected };
    case 'ready':
      return readiness.priceUpdated > 0
        ? { kind: 'priceUpdated', count: readiness.priceUpdated }
        : null;
    default:
      return null;
  }
}

export interface CheckoutNoticeText {
  heading: string;
  body: string | null;
  action: 'returnToBag' | 'tryAgain' | null;
}

export function checkoutNoticeText(
  notice: CheckoutNotice,
  strings: {
    notice: CheckoutPageStrings['notice'];
    announcements: Pick<BagAnnouncementStrings, 'updated' | 'issues'>;
  },
  locale: AppLocale
): CheckoutNoticeText {
  switch (notice.kind) {
    case 'checking':
      return { heading: strings.notice.checking, body: null, action: null };
    case 'blocked':
      return {
        heading: strings.announcements.updated,
        body: fillTemplate(strings.notice.blockedBody, {
          names: notice.names.join(listSeparator(locale)),
        }),
        action: 'returnToBag',
      };
    case 'failed':
      return notice.rejected
        ? { heading: strings.notice.rejected, body: null, action: 'returnToBag' }
        : { heading: strings.notice.failed, body: null, action: 'tryAgain' };
    case 'priceUpdated':
      return {
        heading: selectPlural(strings.announcements.issues.priceUpdated, notice.count, locale),
        body: strings.notice.priceUpdatedBody,
        action: null,
      };
  }
}

/**
 * The summary disclosure's accessible name below 1024: "Summary, 3 pieces, 4,500 EGP", plus
 * "Updating" while the figures are the previous quote's. Just "Summary" before any quote.
 */
export function summaryToggleLabel(
  summary: BagSummary | null,
  strings: {
    summary: Pick<CheckoutPageStrings['summary'], 'heading' | 'toggle'>;
    bagSummary: Pick<BagSummaryStrings, 'pieces' | 'updating'>;
    currency: string;
  },
  locale: AppLocale
): string {
  if (!summary) return strings.summary.heading;
  const label = fillTemplate(strings.summary.toggle, {
    pieces: selectPlural(strings.bagSummary.pieces, summary.purchasablePieces, locale),
    subtotal: formatPrice(summary.subtotal, locale, strings.currency),
  });
  return summary.state === 'stale'
    ? `${label}${listSeparator(locale)}${strings.bagSummary.updating}`
    : label;
}

/** Below 1024 the disclosure opens by itself for a blocked bag, unless the shopper chose. */
export function summaryOpen(userChoice: boolean | null, readiness: CheckoutReadiness): boolean {
  return userChoice ?? readiness.kind === 'blocked';
}

export interface SummaryLineModel {
  key: string;
  name: LocalizedText | null;
  /** The name, or "This piece" while nothing names the row. */
  displayName: string;
  options: string;
  /** `reduced` shows the allowed quantity (CD-15), as the Bag does. */
  quantity: number;
  lineTotal: number | null;
  /** The previous quote's figure, dimmed and busy, while this line waits for its verdict. */
  lineTotalStale: boolean;
  notices: readonly string[];
  imageUrl: string | null;
  /** Nothing names the row yet: its photograph is unknown rather than missing. */
  photoUnknown: boolean;
}

export function summaryLineModel(
  row: BagRow,
  locale: AppLocale,
  strings: BagLineStrings
): SummaryLineModel {
  const name = rowName(row, locale, strings.unavailablePiece);
  return {
    key: row.key,
    name,
    displayName: name?.text ?? strings.pendingPiece,
    options: optionText(row.options, strings),
    quantity: row.displayQuantity,
    lineTotal: row.lineTotal,
    lineTotalStale: row.status === 'pending',
    notices: row.notices.map((notice) => noticeText(notice, strings)),
    imageUrl: row.product?.image?.url ?? row.provisional?.imageUrl ?? null,
    photoUnknown: name === null,
  };
}

export function fieldErrorText(
  key: CheckoutErrorKey,
  field: CheckoutField,
  errors: CheckoutPageStrings['errors']
): string {
  return key === 'tooLong'
    ? fillTemplate(errors.tooLong, { max: CHECKOUT_LIMITS[field] })
    : errors[key];
}

/** Nothing turns red mid-typing: an error shows once the field was left, or after Continue. */
export function shouldShowFieldError(isBlurred: boolean, attempted: boolean): boolean {
  return isBlurred || attempted;
}

export const CHECKOUT_OUTCOME_TOAST_ID = 'checkout-outcome';

/** The outcome is a non-field event, so it is the one toast Checkout raises (CO-12, CO-15). */
export function outcomeToast(
  outcome: CheckoutOutcome,
  strings: Pick<CheckoutPageStrings['outcome'], 'unavailablePreview'>
): ShowToastInput {
  switch (outcome.kind) {
    case 'unavailable':
      return { tone: 'info', message: strings.unavailablePreview, id: CHECKOUT_OUTCOME_TOAST_ID };
  }
}
