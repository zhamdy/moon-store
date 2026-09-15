import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { formatPrice } from '@/features/products/utils/price';
import { cn } from '@/lib/utils/cn';
import type { BagSummaryStrings } from '../utils/bag-strings';
import { selectPlural } from '../utils/plural-templates';
import type { BagSummary as BagSummaryModel } from '../utils/reconcile';

export interface BagSummaryProps {
  /** Null while the first quote loads: rendered as stale. */
  summary: BagSummaryModel | null;
  strings: BagSummaryStrings;
  currency: string;
  locale: AppLocale;
  /** `catalogPath({ kind: 'all' })`, resolved on the server. */
  shopHref: string;
}

/**
 * The bag page summary (plan Unit 7): subtotal only (R10, CD-17), from a quote for the
 * current lines. A stale quote never shows its figure: "Updating", dimmed and busy. No
 * shipping, tax, discount or delivery text, and no Checkout control: the
 * `[data-checkout-action]` slot stays empty until Checkout.
 */
export function BagSummary({ summary, strings, currency, locale, shopHref }: BagSummaryProps) {
  const current = summary?.state === 'current' ? summary : null;
  const subtotal =
    current?.subtotal != null ? formatPrice(current.subtotal, locale, currency) : null;
  const excluded = current?.excludedPieces ?? 0;

  return (
    <section aria-labelledby="bag-summary-heading" className="border-t border-text pt-5">
      <h2 id="bag-summary-heading" className="type-h4">
        {strings.heading}
      </h2>

      <div className="mt-6 border-b border-border pb-5">
        <div
          aria-busy={subtotal === null || undefined}
          className="flex items-baseline justify-between gap-4"
        >
          <span className="type-body">{strings.subtotal}</span>
          <span
            className={cn('type-body-lg tabular-nums', subtotal === null && 'text-text-secondary')}
          >
            {subtotal ?? strings.updating}
          </span>
        </div>
        {current?.purchasablePieces != null && (
          <p className="type-small mt-1 text-text-secondary">
            {selectPlural(strings.pieces, current.purchasablePieces, locale)}
          </p>
        )}
        {excluded > 0 && (
          <p className="type-small mt-1 text-text">
            {selectPlural(strings.excluded, excluded, locale)}
          </p>
        )}
      </div>

      {/* Reserved for Checkout (CD-17): nothing renders here in this phase. */}
      <div data-checkout-action="" className="empty:hidden" />

      <Link
        href={shopHref}
        className="type-small mt-3 inline-flex min-h-11 items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text"
      >
        {strings.continueShopping}
      </Link>
    </section>
  );
}

/** The summary's shape before the store hydrates; nothing in it is readable. */
export function BagSummarySkeleton() {
  return (
    <div aria-hidden="true" className="border-t border-border pt-5">
      <div className="h-6 w-1/3 bg-surface-soft" />
      <div className="mt-6 h-5 w-full bg-surface-soft" />
    </div>
  );
}
