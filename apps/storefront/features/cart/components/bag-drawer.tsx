import { useEffect, useRef, useState } from 'react';
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { BAG_HREF } from '@/components/layout/navigation-items';
import { formatPrice } from '@/features/products/utils/price';
import { cn } from '@/lib/utils/cn';
import { fillTemplate } from '@/lib/utils/fill-template';
import { useCartQuote } from '../api/use-cart-quote';
import { cartStore, useCartActions, useCartLines, useCartSession } from '../store/cart-store';
import type { CartLine as StoredLine } from '../utils/cart-lines';
import type { BagDrawerStrings } from '../utils/bag-strings';
import {
  REMOVE_FADE_MS,
  bagAnnouncementText,
  focusTargetAfterRemove,
  quantityChangedText,
  scrollTopToReveal,
  settledQuantity,
  type RemoveFocusTarget,
} from '../utils/bag-view-model';
import { selectPlural } from '../utils/plural-templates';
import { reconcileBag, type BagRow } from '../utils/reconcile';
import { CartLine, CartLineSkeleton } from './cart-line';
import { announceInDrawer } from './drawer-announcer';

export interface BagDrawerProps {
  strings: BagDrawerStrings;
  locale: AppLocale;
  /** `catalogPath({ kind: 'all' })`, resolved on the server. */
  shopHref: string;
}

const NO_LINES: readonly StoredLine[] = [];
const NO_KEYS: ReadonlySet<string> = new Set();

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

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The Bag drawer (plan Unit 6): reached only through `BagTrigger`'s lazy `dynamic()` import,
 * so it is not a client boundary of its own. It quotes the bag while open, renders
 * `reconcileBag`'s view, and applies the model's store writes and announcements in effects.
 * The panel's content unmounts when closed, so line photographs load only while it is open.
 */
export default function BagDrawer({ strings, locale, shopHref }: BagDrawerProps) {
  const cart = useCartLines();
  const session = useCartSession();
  const actions = useCartActions();
  const { drawer } = session;
  const { open } = drawer;

  const quote = useCartQuote(cart, open);
  const out = reconcileBag({
    lines: cart.hydrated ? cart.lines : NO_LINES,
    result: quote.result,
    fetch: quote.fetch,
    session,
  });
  const { view, correction, announcement, rememberPrices, priceUpdates } = out;
  const pending = quote.fetch.status === 'fetching';
  const addedKey = open ? drawer.addedKey : null;

  // The description is fixed at open (CD-13); the store clears it at the first interaction.
  const [opening, setOpening] = useState({ id: 0, description: null as string | null });
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpening({ id: opening.id + 1, description: drawer.description });
  }

  const [removing, setRemoving] = useState<ReadonlySet<string>>(NO_KEYS);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const rowElements = useRef(new Map<string, HTMLLIElement>());
  const focusElements = useRef(new Map<string, HTMLElement>());
  const emptyHeading = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<RemoveFocusTarget | null>(null);
  const pendingQuantity = useRef<{ key: string; name: string } | null>(null);
  const appliedCorrection = useRef<string | null>(null);
  const scrolledOpening = useRef(0);
  const timers = useRef(new Set<number>());

  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    closeForNavigation();
  }, [pathname]);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const timer of pendingTimers) window.clearTimeout(timer);
    };
  }, []);

  // The one store correction, once per settled quote key.
  useEffect(() => {
    if (!open || !correction || appliedCorrection.current === correction.quoteKey) return;
    appliedCorrection.current = correction.quoteKey;
    for (const rewrite of correction.rewrites) {
      actions.applyCanonical(rewrite.key, rewrite.options);
    }
  }, [open, correction, actions]);

  // Session memory; both setters ignore a write that changes nothing.
  useEffect(() => {
    if (!open) return;
    if (priceUpdates) actions.markPriceUpdates(priceUpdates);
    if (rememberPrices) actions.rememberPrices(rememberPrices);
  }, [open, priceUpdates, rememberPrices, actions]);

  // Announcements go out after the quote settles, through the trigger's live region.
  useEffect(() => {
    if (!open) return;
    const messages: string[] = [];
    const changed = pendingQuantity.current;
    if (changed) {
      const settle = settledQuantity(view, changed.key);
      if (settle.kind !== 'wait') pendingQuantity.current = null;
      if (settle.kind === 'announce') {
        const subtotal = formatPrice(settle.subtotal, locale, strings.line.currency);
        messages.push(
          quantityChangedText(strings.announcements, changed.name, settle.count, subtotal)
        );
      }
    }
    if (announcement) {
      messages.push(bagAnnouncementText(announcement, strings.announcements, locale));
      actions.markQuoteAnnounced(announcement.markKey);
    }
    if (messages.length > 0) announceInDrawer(messages.join('. '));
  }, [open, view, announcement, strings, locale, actions]);

  // After every render: bring an `added` or capped line into view once per opening (focus
  // stays on the title), and land focus after a removal once its row has unmounted.
  useEffect(() => {
    const container = scrollContainer.current;
    const row = addedKey === null ? undefined : rowElements.current.get(addedKey);
    if (container && row && scrolledOpening.current !== opening.id) {
      scrolledOpening.current = opening.id;
      const top = scrollTopToReveal(row, container);
      if (top !== null) container.scrollTop = top;
    }

    const target = pendingFocus.current;
    if (target === null) return;
    const element =
      target.kind === 'empty' ? emptyHeading.current : focusElements.current.get(target.key);
    if (element) {
      pendingFocus.current = null;
      element.focus();
    } else if (view.kind !== 'loading') {
      pendingFocus.current = null;
    }
  });

  const rows: readonly BagRow[] = view.kind === 'ready' ? view.rows : [];

  const onQuantityChange = (key: string, quantity: number, name: string) => {
    actions.browseDrawer();
    pendingQuantity.current = { key, name };
    actions.setQuantity(key, quantity);
  };

  const onRemove = (row: BagRow, name: string) => {
    if (removing.has(row.key)) return;
    actions.browseDrawer();
    announceInDrawer(fillTemplate(strings.announcements.removed, { name }));
    const keys = rows.map((r) => r.key).filter((key) => key === row.key || !removing.has(key));

    const finish = () => {
      pendingFocus.current = focusTargetAfterRemove(keys, row.key);
      if (pendingQuantity.current?.key === row.key) pendingQuantity.current = null;
      actions.remove(row.key);
      setRemoving((current) => {
        if (!current.has(row.key)) return current;
        const next = new Set(current);
        next.delete(row.key);
        return next;
      });
    };

    if (prefersReducedMotion()) {
      finish();
      return;
    }
    setRemoving((current) => new Set(current).add(row.key));
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      finish();
    }, REMOVE_FADE_MS);
    timers.current.add(timer);
  };

  const onRetry = () => {
    actions.browseDrawer();
    quote.retry();
  };

  const onEmpty = () => {
    actions.browseDrawer();
    pendingFocus.current = { kind: 'empty' };
    actions.clear();
  };

  const summary = view.kind === 'ready' ? view.summary : null;
  const subtotal =
    summary?.subtotal != null ? formatPrice(summary.subtotal, locale, strings.line.currency) : null;
  const excluded = summary?.state === 'current' ? (summary.excludedPieces ?? 0) : 0;

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
              {opening.description && (
                <Description className="type-small mt-1 text-text-secondary">
                  {opening.description}
                </Description>
              )}
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

          <div
            ref={scrollContainer}
            aria-busy={view.kind === 'loading' || undefined}
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 md:px-8"
          >
            {view.kind === 'loading' && (
              <>
                <p className="sr-only">{strings.summary.updating}</p>
                <ul aria-hidden="true" className="divide-y divide-border">
                  {Array.from({ length: view.skeletonRows }, (_, index) => (
                    <CartLineSkeleton key={index} variant="drawer" />
                  ))}
                </ul>
              </>
            )}

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

            {view.kind === 'ready' && (
              <ul className="divide-y divide-border">
                {view.rows.map((row) => (
                  <CartLine
                    key={row.key}
                    row={row}
                    variant="drawer"
                    locale={locale}
                    strings={strings.line}
                    pending={pending}
                    justAdded={addedKey === row.key}
                    removing={removing.has(row.key)}
                    rowRef={(element) => {
                      if (element) rowElements.current.set(row.key, element);
                      else rowElements.current.delete(row.key);
                    }}
                    focusRef={(element) => {
                      if (element) focusElements.current.set(row.key, element);
                      else focusElements.current.delete(row.key);
                    }}
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
                  <div
                    aria-busy={subtotal === null || undefined}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <span className="type-body">{strings.summary.subtotal}</span>
                    {/* A stale quote never shows its figure (CD-9): "Updating", dimmed. */}
                    <span
                      className={cn(
                        'type-body tabular-nums',
                        subtotal === null && 'text-text-secondary'
                      )}
                    >
                      {subtotal ?? strings.summary.updating}
                    </span>
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
