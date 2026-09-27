'use client';

import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { buttonClassName } from '@/components/ui/button';
import type { AppLocale } from '@/i18n/routing';
import type { BagPageStrings } from '../utils/bag-strings';
import { storedPieceCount } from '../utils/bag-view-model';
import { checkoutReadiness } from '../utils/checkout-readiness';
import { selectPlural } from '../utils/plural-templates';
import { BagEmpty } from './bag-empty';
import { BagSummary } from './bag-summary';
import { CartLine } from './cart-line';
import { CheckoutEntry } from './checkout-entry';
import { useBagController } from './use-bag-controller';

export interface BagViewProps {
  /** The page's `h1`, rendered on the server; the island sets the piece count beside it. */
  heading: ReactNode;
  strings: BagPageStrings;
  locale: AppLocale;
  /** `catalogPath({ kind: 'all' })`, resolved on the server. */
  shopHref: string;
  /**
   * The empty bag's category photographs ("Directory", 2026-09-27), server-rendered by the
   * page (`CategoryDirectory variant="tiles"`).
   */
  emptyDirectory?: ReactNode;
}

const TEXT_ACTION =
  'type-small inline-flex min-h-11 cursor-pointer items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text';

/**
 * The bag page's review (plan Unit 7; boundary 15), laid out as "Fitting room" (owner
 * decision 2026-09-27): the title with the piece count beside it, then the lines on seven of
 * the page's twelve columns, a pause, and the Stone summary on four, sticky under the header;
 * one column below 1024. Shares the drawer's controller, so corrections, price memory, the
 * remove fade and focus hand-off and the toast rules are the same; messages are toasts in
 * the layout's one toaster.
 *
 * The server HTML and the first client render are one reserved, busy region (the bag's size
 * is unknown there, so no fake rows) beside the summary in its final layout; a non-empty bag
 * never flashes the empty state. The count appears once the bag has hydrated, inline beside
 * the title, so nothing moves.
 */
export function BagView({ heading, strings, locale, shopHref, emptyDirectory }: BagViewProps) {
  const {
    cart,
    view,
    fetch,
    pending,
    removing,
    emptyHeading,
    focusRef,
    onQuantityChange,
    onRemove,
    onRetry,
    onEmpty,
  } = useBagController({ active: true, locale, strings });
  const pieces = cart.hydrated ? storedPieceCount(cart.lines) : 0;
  const title = (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-7 md:pb-9">
      {heading}
      {pieces > 0 && (
        <p className="type-supporting text-text-secondary tabular-nums">
          {selectPlural(strings.summary.pieces, pieces, locale)}
        </p>
      )}
    </div>
  );
  // Not strict: a focus refetch of an unchanged bag must not flip the link (CO-3).
  const readiness = checkoutReadiness(
    { hydrated: cart.hydrated, lines: cart.hydrated ? cart.lines : [], view, fetch },
    { strict: false }
  );

  if (cart.hydrated && view.kind === 'empty') {
    return (
      <>
        {title}
        <BagEmpty
          headingRef={emptyHeading}
          title={strings.status.emptyTitle}
          body={strings.status.emptyBody}
          directory={emptyDirectory}
          action={
            <Link href={shopHref} className={buttonClassName({ className: 'w-full sm:w-auto' })}>
              {strings.status.emptyAction}
            </Link>
          }
        />
      </>
    );
  }

  const rows = view.kind === 'ready' || view.kind === 'loading' ? view.rows : null;

  return (
    <>
      {title}
      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-6">
        <div className="lg:col-span-7">
          {!cart.hydrated && (
            // One row's height at each width (frame + padding), so a one-line bag never shifts.
            <div aria-busy="true" className="min-h-[10rem] border-y border-border md:min-h-[13rem]">
              <p className="sr-only">{strings.summary.updating}</p>
            </div>
          )}

          {cart.hydrated && view.kind === 'failed' && (
            <div className="border-t border-border pt-10">
              <p className="type-body-lg">
                {selectPlural(strings.summary.piecesInBag, view.localPieces, locale)}
              </p>
              <p className="type-body mt-2 text-text-secondary">{strings.status.errorLoad}</p>
              <div className="mt-4 flex flex-wrap gap-x-6">
                {view.canRetry && (
                  <button type="button" onClick={onRetry} className={TEXT_ACTION}>
                    {strings.status.retry}
                  </button>
                )}
                {view.canEmpty && (
                  <button type="button" onClick={onEmpty} className={TEXT_ACTION}>
                    {strings.status.emptyBag}
                  </button>
                )}
              </div>
            </div>
          )}

          {cart.hydrated && rows && (
            <>
              {view.kind === 'loading' && <p className="sr-only">{strings.summary.updating}</p>}
              <ul className="divide-y divide-border border-y border-border">
                {rows.map((row) => (
                  <CartLine
                    key={row.key}
                    row={row}
                    variant="page"
                    locale={locale}
                    strings={strings.line}
                    pending={pending}
                    removing={removing.has(row.key)}
                    focusRef={focusRef(row.key)}
                    onQuantityChange={onQuantityChange}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            </>
          )}
        </div>

        {view.kind !== 'failed' && (
          <div className="mt-10 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:col-span-4 lg:col-start-9 lg:mt-0">
            <BagSummary
              summary={view.kind === 'ready' ? view.summary : null}
              strings={strings.summary}
              currency={strings.line.currency}
              locale={locale}
              shopHref={shopHref}
              checkoutAction={
                <CheckoutEntry
                  readiness={readiness}
                  strings={strings.summary.checkout}
                  locale={locale}
                />
              }
            />
          </div>
        )}
      </div>
    </>
  );
}
