import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { BagFigure, BagPlaceholder } from '@/features/cart/components/cart-line';
import type { CheckoutReadiness } from '@/features/cart/utils/checkout-readiness';
import { selectPlural } from '@/features/cart/utils/plural-templates';
import type { BagRow, BagSummary } from '@/features/cart/utils/reconcile';
import { ProductImagePlaceholder } from '@/features/products/components/product-image-placeholder';
import { langProps } from '@/features/products/utils/localized-name';
import { formatPrice } from '@/features/products/utils/price';
import { cn } from '@/lib/utils/cn';
import { fillTemplate } from '@/lib/utils/fill-template';
import type { CheckoutPageStrings } from '../utils/checkout-strings';
import { summaryLineModel, summaryOpen, summaryToggleLabel } from '../utils/checkout-view-model';
import { useMediaQuery } from './use-media-query';

const DESKTOP = '(min-width: 1024px)';

export interface CheckoutSummaryProps {
  rows: readonly BagRow[];
  /** Null before the first quote: figures are placeholders. */
  summary: BagSummary | null;
  readiness: CheckoutReadiness;
  strings: CheckoutPageStrings;
  locale: AppLocale;
  bagHref: string;
}

/**
 * The order summary (CO-19), built only from the quote: image, localized name, options,
 * quantity, line total, subtotal. No SKU, stock number or id, and no Total: delivery is
 * "Confirmed later" (CO-18). One DOM for every width: below 1024 the lines sit behind a
 * disclosure that opens by itself for a blocked bag; from 1024 they are always shown and scroll
 * inside the sticky column, which then becomes a labelled, focusable region.
 */
export function CheckoutSummary({
  rows,
  summary,
  readiness,
  strings,
  locale,
  bagHref,
}: CheckoutSummaryProps) {
  const headingId = useId();
  const listId = useId();
  const [userChoice, setUserChoice] = useState<boolean | null>(null);
  const desktop = useMediaQuery(DESKTOP);
  const open = summaryOpen(userChoice, readiness);
  const linesVisible = desktop || open;

  const scroller = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { bag } = strings;
  const stale = summary?.state === 'stale';
  const subtotal = summary ? formatPrice(summary.subtotal, locale, bag.line.currency) : null;
  const excluded = summary?.excludedPieces ?? 0;

  return (
    <section aria-labelledby={headingId} className="border-t border-text pt-5">
      <h2 id={headingId} className="type-h4 hidden lg:block">
        {strings.summary.heading}
      </h2>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={summaryToggleLabel(
          summary,
          { summary: strings.summary, bagSummary: bag.summary, currency: bag.line.currency },
          locale
        )}
        onClick={() => setUserChoice(!open)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 text-start lg:hidden"
      >
        <span className="type-h4">{strings.summary.heading}</span>
        <span className="flex items-center gap-3">
          <BagFigure
            value={subtotal}
            stale={stale}
            updating={bag.summary.updating}
            className="type-body"
            placeholderClassName="w-20"
          />
          <ChevronDown
            size={20}
            strokeWidth={1.5}
            aria-hidden="true"
            className={cn(
              'shrink-0 transition-transform duration-fast ease-ui',
              open && 'rotate-180'
            )}
          />
        </span>
      </button>

      <div
        ref={scroller}
        id={listId}
        role={overflowing && desktop ? 'region' : undefined}
        aria-label={overflowing && desktop ? strings.summary.lines : undefined}
        tabIndex={overflowing && desktop ? 0 : undefined}
        className={cn(
          'mt-4 lg:mt-6 lg:max-h-[calc(100svh-var(--header-h)-20rem)] lg:overflow-y-auto lg:overscroll-contain',
          !open && 'hidden',
          'lg:block'
        )}
      >
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((row) => {
            const line = summaryLineModel(row, locale, bag.line);
            return (
              <li key={line.key} className="flex gap-4 py-4">
                <div
                  className={cn(
                    'relative isolate aspect-4/5 w-16 shrink-0 self-start overflow-hidden rounded-media-sm',
                    !line.photoUnknown && 'bg-surface-soft'
                  )}
                >
                  {linesVisible && line.imageUrl ? (
                    <Image
                      src={line.imageUrl}
                      alt=""
                      fill
                      sizes="64px"
                      data-bag-reveal=""
                      className="object-cover"
                    />
                  ) : line.photoUnknown ? (
                    <BagPlaceholder className="absolute inset-0" />
                  ) : (
                    !line.imageUrl && <ProductImagePlaceholder />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-x-4">
                    <p className="type-small min-w-0 font-medium break-words text-text">
                      {line.name ? (
                        <span {...langProps(line.name, locale)}>{line.name.text}</span>
                      ) : (
                        <>
                          <span className="sr-only">{line.displayName}</span>
                          <BagPlaceholder className="inline-block h-[0.7lh] w-24 align-middle" />
                        </>
                      )}
                    </p>
                    {(line.lineTotal !== null || line.lineTotalStale) && (
                      <p className="type-small shrink-0">
                        <BagFigure
                          value={
                            line.lineTotal === null
                              ? null
                              : formatPrice(line.lineTotal, locale, bag.line.currency)
                          }
                          stale={line.lineTotalStale}
                          label={bag.line.lineTotal}
                          updating={bag.line.updating}
                          placeholderClassName="w-14"
                        />
                      </p>
                    )}
                  </div>
                  {line.options && (
                    <p className="type-small mt-0.5 text-text-secondary">{line.options}</p>
                  )}
                  <p className="type-small mt-0.5 text-text-secondary tabular-nums">
                    {fillTemplate(strings.summary.quantity, { count: line.quantity })}
                  </p>
                  {line.notices.length > 0 && (
                    <ul className="type-small mt-1 space-y-0.5 text-text">
                      {line.notices.map((notice) => (
                        <li key={notice}>{notice}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <dl className="mt-5 space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-body">{bag.summary.subtotal}</dt>
          <dd>
            <BagFigure
              value={subtotal}
              stale={stale}
              updating={bag.summary.updating}
              className="type-body-lg"
              placeholderClassName="w-24"
            />
          </dd>
        </div>
        {excluded > 0 && (
          <div>
            <dt className="sr-only">{bag.summary.subtotal}</dt>
            <dd className={cn('type-small text-text', stale && 'text-text-secondary')}>
              {selectPlural(bag.summary.excluded, excluded, locale)}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-small text-text-secondary">{strings.summary.delivery}</dt>
          <dd className="type-small text-text-secondary">{strings.summary.deliveryLater}</dd>
        </div>
      </dl>

      <Link
        href={bagHref}
        className="type-small mt-4 inline-flex min-h-11 items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text"
      >
        {strings.summary.editBag}
      </Link>
    </section>
  );
}
