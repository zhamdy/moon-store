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

/** Joins a line's options and quantity: "Size: M · Qty 1". */
const META_SEPARATOR = ' · ';

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
 * "Confirmed later" (CO-18). A Stone panel, as on the Bag ("Fitting room", 2026-09-27). One DOM
 * for every width: below 1024 it is one bar ("Summary · 3 pieces · 9,250 EGP") whose disclosure
 * opens the lines, Subtotal, Delivery and Edit bag, and opens by itself for a blocked bag; from
 * 1024 everything is shown and the lines scroll inside the sticky column, which then becomes a
 * labelled, focusable region.
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
  const pieces = summary
    ? selectPlural(bag.summary.pieces, summary.purchasablePieces, locale)
    : null;

  return (
    <section aria-labelledby={headingId} className="bg-surface-media px-4 sm:px-6 lg:p-8">
      <h2 id={headingId} className="type-label hidden text-text-secondary lg:block">
        {strings.summary.heading}
      </h2>
      {/* Below 1024 the panel is one bar: the heading, pieces and subtotal, said once. The lines,
          the Subtotal row and Edit bag open under it. */}
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
        className="flex min-h-15 w-full cursor-pointer items-center justify-between gap-3 text-start lg:hidden"
      >
        <span className="type-label text-text-secondary">{strings.summary.heading}</span>
        <span className="type-supporting flex min-w-0 items-center gap-2.5">
          {pieces && <span className="text-text-secondary tabular-nums">{pieces}</span>}
          <BagFigure
            value={subtotal}
            stale={stale}
            updating={bag.summary.updating}
            className="font-medium"
            placeholderClassName="w-20"
          />
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className={cn(
              'shrink-0 transition-transform duration-fast ease-ui',
              open && 'rotate-180'
            )}
          />
        </span>
      </button>

      <div id={listId} className={cn('pb-4 lg:block lg:pb-0', !open && 'hidden')}>
        <div
          ref={scroller}
          role={overflowing && desktop ? 'region' : undefined}
          aria-label={overflowing && desktop ? strings.summary.lines : undefined}
          tabIndex={overflowing && desktop ? 0 : undefined}
          className="lg:mt-4 lg:max-h-[calc(100svh-var(--header-h)-20rem)] lg:overflow-y-auto lg:overscroll-contain"
        >
          <ul className="divide-y divide-border border-y border-border lg:border-t-0">
            {rows.map((row) => {
              const line = summaryLineModel(row, locale, bag.line);
              const quantity = fillTemplate(strings.summary.quantity, { count: line.quantity });
              return (
                <li key={line.key} className="flex gap-4 py-3.5">
                  {/* The frame is Ivory on the Stone panel, so an empty one still reads. */}
                  <div
                    className={cn(
                      'relative isolate aspect-4/5 w-16 shrink-0 self-start overflow-hidden rounded-media-sm',
                      !line.photoUnknown && 'bg-bg'
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
                    <div className="flex items-start justify-between gap-x-3">
                      <p className="type-supporting min-w-0 font-medium break-words text-text">
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
                        <p className="type-supporting shrink-0">
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
                    <p className="type-supporting mt-0.5 text-text-secondary tabular-nums">
                      {line.options ? `${line.options}${META_SEPARATOR}${quantity}` : quantity}
                    </p>
                    {line.notices.length > 0 && (
                      <ul className="type-supporting mt-1 space-y-0.5 text-text">
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

        <dl className="mt-4 space-y-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="type-body">{bag.summary.subtotal}</dt>
            <dd>
              <BagFigure
                value={subtotal}
                stale={stale}
                updating={bag.summary.updating}
                className="type-body-lg font-medium"
                placeholderClassName="w-24"
              />
            </dd>
          </div>
          {excluded > 0 && (
            <div>
              <dt className="sr-only">{bag.summary.subtotal}</dt>
              <dd className={cn('type-supporting text-text', stale && 'text-text-secondary')}>
                {selectPlural(bag.summary.excluded, excluded, locale)}
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="type-supporting text-text-secondary">{strings.summary.delivery}</dt>
            <dd className="type-supporting text-text-secondary">{strings.summary.deliveryLater}</dd>
          </div>
        </dl>

        <Link
          href={bagHref}
          className="type-supporting mt-3 inline-flex min-h-11 items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text"
        >
          {strings.summary.editBag}
        </Link>
      </div>
    </section>
  );
}
