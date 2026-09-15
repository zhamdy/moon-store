import { useEffect, useRef } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { BAG_HREF } from '@/components/layout/navigation-items';
import { formatPrice } from '@/features/products/utils/price';
import { cartStore, useCartActions, useCartSession } from '../store/cart-store';
import type { BagDrawerStrings } from '../utils/bag-strings';
import { selectPlural } from '../utils/plural-templates';
import { BagFigure, CartLine } from './cart-line';
import { useBagController } from './use-bag-controller';

export interface BagDrawerProps {
  strings: BagDrawerStrings;
  locale: AppLocale;
  /** `catalogPath({ kind: 'all' })`, resolved on the server. */
  shopHref: string;
}

const TEXT_ACTION =
  'type-small inline-flex min-h-11 cursor-pointer items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text';
const PRIMARY_LINK =
  'inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-action px-7 font-body font-medium text-on-action transition-colors duration-fast ease-ui hover:bg-action-hover active:bg-action-hover';

/**
 * Closes for a navigation (a line name, View bag, the empty state's link, or any pathname
 * change). Headless UI would hand focus back to the invoker, which on the next page is a
 * stale place to be; focus lands on the page's main region instead, as the skip link's does.
 */
function closeForNavigation() {
  if (!cartStore.getSession().drawer.open) return;
  cartStore.closeDrawer();
  requestAnimationFrame(() => {
    document.getElementById('main-content')?.focus({ preventScroll: true });
  });
}

/**
 * The Bag drawer (plan Unit 6): reached only through `BagTrigger`'s lazy import, so it is not
 * a client boundary of its own, and opened only from the header Bag link (Add to Bag raises a
 * toast instead, owner decision 2026-09-15). `useBagController` quotes the bag while open,
 * reconciles it and applies the model's store writes and toasts; this renders it.
 * The panel's content unmounts when closed, so line photographs load only while it is open.
 */
export default function BagDrawer({ strings, locale, shopHref }: BagDrawerProps) {
  const { drawer } = useCartSession();
  const actions = useCartActions();
  const { open } = drawer;

  const {
    view,
    pending,
    removing,
    emptyHeading,
    focusRef,
    onQuantityChange,
    onRemove,
    onRetry,
    onEmpty,
  } = useBagController({ active: open, locale, strings });

  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    closeForNavigation();
  }, [pathname]);

  const rows = view.kind === 'ready' || view.kind === 'loading' ? view.rows : null;
  const summary = view.kind === 'ready' ? view.summary : null;
  const subtotal = summary ? formatPrice(summary.subtotal, locale, strings.line.currency) : null;
  const excluded = summary?.excludedPieces ?? 0;

  return (
    <Dialog open={open} onClose={() => actions.closeDrawer()} transition className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-scrim transition-opacity duration-base ease-ui data-closed:opacity-0"
      />

      {/* From the inline end at every width: the same side as the Bag icon, full height. */}
      <div className="fixed inset-0 flex justify-end">
        <DialogPanel
          transition
          className="flex h-full w-full max-w-[26rem] flex-col bg-bg text-text transition duration-base ease-ui data-closed:translate-x-full rtl:data-closed:-translate-x-full"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border py-2.5 ps-5 pe-3 md:ps-8 md:pe-5">
            <div className="min-w-0 py-2">
              <DialogTitle
                as="h2"
                tabIndex={-1}
                data-autofocus
                className="type-h4 focus:outline-none"
              >
                {strings.title}
              </DialogTitle>
            </div>
            <button
              type="button"
              onClick={() => actions.closeDrawer()}
              aria-label={strings.close}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"
            >
              <X size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 md:px-8">
            {view.kind === 'loading' && <p className="sr-only">{strings.summary.updating}</p>}

            {view.kind === 'failed' && (
              <div className="py-10">
                <p className="type-body">
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

            {view.kind === 'empty' && (
              <div className="flex flex-col items-start gap-4 py-12">
                <h3 ref={emptyHeading} tabIndex={-1} className="type-body-lg focus:outline-none">
                  {strings.status.emptyTitle}
                </h3>
                <Link href={shopHref} onClick={closeForNavigation} className={TEXT_ACTION}>
                  {strings.status.emptyAction}
                </Link>
              </div>
            )}

            {rows && (
              <ul className="divide-y divide-border">
                {rows.map((row) => (
                  <CartLine
                    key={row.key}
                    row={row}
                    variant="drawer"
                    locale={locale}
                    strings={strings.line}
                    pending={pending}
                    removing={removing.has(row.key)}
                    focusRef={focusRef(row.key)}
                    onQuantityChange={onQuantityChange}
                    onRemove={onRemove}
                    onNavigate={closeForNavigation}
                  />
                ))}
              </ul>
            )}
          </div>

          {view.kind !== 'empty' && (
            <div className="flex shrink-0 flex-col gap-4 border-t border-border px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-8 md:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {view.kind !== 'failed' && (
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="type-body">{strings.summary.subtotal}</span>
                    {/* A stale quote keeps the previous figure, dimmed and busy (CD-9). */}
                    <BagFigure
                      value={subtotal}
                      stale={summary?.state === 'stale'}
                      updating={strings.summary.updating}
                      className="type-body"
                    />
                  </div>
                  {excluded > 0 && (
                    <p className="type-small mt-1 text-text-secondary">
                      {selectPlural(strings.summary.excluded, excluded, locale)}
                    </p>
                  )}
                </div>
              )}
              {/* Reserved for Checkout (CD-17): nothing renders here in this phase. */}
              <div data-checkout-action="" className="empty:hidden" />
              <Link
                href={BAG_HREF}
                onClick={closeForNavigation}
                data-surface="ink"
                className={PRIMARY_LINK}
              >
                {strings.viewBag}
              </Link>
              <div className="flex justify-center">
                <button type="button" onClick={() => actions.closeDrawer()} className={TEXT_ACTION}>
                  {strings.continueShopping}
                </button>
              </div>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
