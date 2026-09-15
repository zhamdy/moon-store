'use client';

import { useCallback, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { BagPageStrings } from '../utils/bag-strings';
import { selectPlural } from '../utils/plural-templates';
import { BagSummary } from './bag-summary';
import { CartLine } from './cart-line';
import { useBagController } from './use-bag-controller';

export interface BagViewProps {
  strings: BagPageStrings;
  locale: AppLocale;
  /** `catalogPath({ kind: 'all' })`, resolved on the server. */
  shopHref: string;
  /** The id of the page shell's polite live region (server-rendered, empty). */
  statusId: string;
}

const TEXT_ACTION =
  'type-small inline-flex min-h-11 cursor-pointer items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text';

/**
 * The bag page's review (plan Unit 7; the sixteenth client boundary). Shares the drawer's
 * controller, so corrections, price memory, the remove fade and focus hand-off and the
 * announcement rules are the same; messages go to the page shell's own live region, which
 * exists in the server HTML before anything is written to it.
 *
 * The server HTML and the first client render are one reserved, busy region (the bag's size
 * is unknown there, so no fake rows) beside the summary in its final layout; a non-empty bag
 * never flashes the empty state.
 */
export function BagView({ strings, locale, shopHref, statusId }: BagViewProps) {
  const generation = useRef(0);
  const announce = useCallback(
    (message: string) => {
      const region = document.getElementById(statusId);
      if (!region) return;
      const token = ++generation.current;
      // Repeating the current text would not be announced again: clear, then rewrite.
      if (message !== '' && region.textContent === message) {
        region.textContent = '';
        requestAnimationFrame(() => {
          if (token === generation.current) region.textContent = message;
        });
        return;
      }
      region.textContent = message;
    },
    [statusId]
  );

  const {
    cart,
    view,
    pending,
    removing,
    emptyHeading,
    focusRef,
    onQuantityChange,
    onRemove,
    onRetry,
    onEmpty,
  } = useBagController({ active: true, locale, strings, announce });

  if (cart.hydrated && view.kind === 'empty') {
    return (
      <div className="flex flex-col items-start gap-4 border-t border-border pt-10">
        <h2 ref={emptyHeading} tabIndex={-1} className="type-h4 focus:outline-none">
          {strings.status.emptyTitle}
        </h2>
        <Link href={shopHref} className={TEXT_ACTION}>
          {strings.status.emptyAction}
        </Link>
      </div>
    );
  }

  const rows = view.kind === 'ready' || view.kind === 'loading' ? view.rows : null;

  return (
    <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12 xl:gap-x-16">
      <div className="lg:col-span-8">
        {!cart.hydrated && (
          // One row's height at each width (frame + padding), so a one-line bag never shifts.
          <div
            aria-busy="true"
            className="min-h-[8.125rem] border-y border-border md:min-h-[12.875rem]"
          >
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
        <div className="mt-12 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:col-span-4 lg:mt-0">
          <BagSummary
            summary={view.kind === 'ready' ? view.summary : null}
            strings={strings.summary}
            currency={strings.line.currency}
            locale={locale}
            shopHref={shopHref}
          />
        </div>
      )}
    </div>
  );
}
