import type { AppLocale } from '@/i18n/routing';
import type { CheckoutReadiness } from './checkout-readiness';
import { selectPlural, type PluralTemplates } from './plural-templates';

/** Resolved strings for the Bag page's Checkout entry. */
export interface CheckoutEntryStrings {
  action: string;
  checking: string;
  failed: string;
  /** "Remove {count} unavailable piece to continue", per plural category. */
  blockedUnavailable: PluralTemplates;
  /** "Update the quantity of {count} piece to continue", per plural category. */
  blockedLimited: PluralTemplates;
}

export type CheckoutEntryReason =
  | { kind: 'checking' }
  | { kind: 'unavailable'; count: number }
  | { kind: 'limited'; count: number }
  | { kind: 'failed' };

export type CheckoutEntryModel =
  | { kind: 'none' }
  | { kind: 'link' }
  | { kind: 'unavailable'; reason: CheckoutEntryReason };

/**
 * What the Bag summary's checkout slot renders (plan 2026-09-15-002, Unit 2). Nothing while
 * the bag is empty or unknown, or when Checkout is off in this build (CO-22); a link only
 * for a ready bag; otherwise an inert control that says why. Unavailable lines win over
 * limited ones: removing a piece is the stronger action.
 */
export function checkoutEntryModel(
  readiness: CheckoutReadiness,
  enabled: boolean
): CheckoutEntryModel {
  if (!enabled) return { kind: 'none' };
  switch (readiness.kind) {
    case 'hydrating':
    case 'empty':
      return { kind: 'none' };
    case 'ready':
      return { kind: 'link' };
    case 'checking':
      return { kind: 'unavailable', reason: { kind: 'checking' } };
    case 'failed':
      return { kind: 'unavailable', reason: { kind: 'failed' } };
    case 'blocked':
      return {
        kind: 'unavailable',
        reason:
          readiness.unavailable > 0
            ? { kind: 'unavailable', count: readiness.unavailable }
            : { kind: 'limited', count: readiness.limited },
      };
  }
}

export function checkoutEntryReasonText(
  reason: CheckoutEntryReason,
  strings: CheckoutEntryStrings,
  locale: AppLocale
): string {
  switch (reason.kind) {
    case 'checking':
      return strings.checking;
    case 'failed':
      return strings.failed;
    case 'unavailable':
      return selectPlural(strings.blockedUnavailable, reason.count, locale);
    case 'limited':
      return selectPlural(strings.blockedLimited, reason.count, locale);
  }
}
