import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { formatPrice } from '@/features/products/utils/price';
import { cn } from '@/lib/utils/cn';
import type { BagSummaryStrings } from '../utils/bag-strings';
import { selectPlural } from '../utils/plural-templates';
import type { BagSummary as BagSummaryModel } from '../utils/reconcile';
import { BagFigure, BagPlaceholder } from './cart-line';

export interface BagSummaryProps {
  /** Null before the store hydrates and while the first quote loads: placeholders in place. */
  summary: BagSummaryModel | null;
  strings: BagSummaryStrings;
  currency: string;
  locale: AppLocale;
  /** `catalogPath({ kind: 'all' })`, resolved on the server. */
  shopHref: string;
  /** The Checkout entry (plan 2026-09-15-002, Unit 2); the slot hides itself when empty. */
  checkoutAction?: ReactNode;
}

/**
 * The bag page summary ("Fitting room", 2026-09-27): a Stone panel, as the design system
 * keeps the bag's summary, beside the lines from 1024 and under them below. Subtotal only
 * (R10, CD-17), always from a quote; a stale quote keeps its figures on screen, dimmed and
 * busy, until the new one settles. The layout is final from the server HTML on, so nothing
 * jumps when the quote arrives. No shipping, tax, discount or delivery text. The
 * `[data-checkout-action]` slot holds the Checkout entry, which renders nothing when
 * Checkout is off in this build.
 */
export function BagSummary({
  summary,
  strings,
  currency,
  locale,
  shopHref,
  checkoutAction,
}: BagSummaryProps) {
  const stale = summary?.state === 'stale';
  const subtotal = summary ? formatPrice(summary.subtotal, locale, currency) : null;
  const excluded = summary?.excludedPieces ?? 0;

  return (
    <section aria-labelledby="bag-summary-heading" className="bg-surface-media p-6 md:p-8">
      <h2 id="bag-summary-heading" className="type-label text-text-secondary">
        {strings.heading}
      </h2>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="type-body">{strings.subtotal}</span>
          <BagFigure
            value={subtotal}
            stale={stale}
            updating={strings.updating}
            className="type-body-lg font-medium"
            placeholderClassName="w-24"
          />
        </div>
        <p className="type-supporting mt-1 flex min-h-lh items-center text-text-secondary">
          {summary ? (
            selectPlural(strings.pieces, summary.purchasablePieces, locale)
          ) : (
            <BagPlaceholder className="h-[0.7lh] w-16" />
          )}
        </p>
        {excluded > 0 && (
          <p
            className={cn(
              'type-supporting mt-1 text-text transition-colors duration-fast ease-ui',
              stale && 'text-text-secondary'
            )}
          >
            {selectPlural(strings.excluded, excluded, locale)}
          </p>
        )}
      </div>

      <div data-checkout-action="" className="mt-6 border-t border-border empty:hidden">
        {checkoutAction}
      </div>

      <div className="flex justify-center">
        <Link
          href={shopHref}
          className="type-supporting inline-flex min-h-11 items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text"
        >
          {strings.continueShopping}
        </Link>
      </div>
    </section>
  );
}
