import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AppLocale } from '@/i18n/routing';
import { showToast } from '@/components/feedback/show-toast';
import { formatPrice } from '@/features/products/utils/price';
import { useCartQuote } from '../api/use-cart-quote';
import {
  cartStore,
  useCartActions,
  useCartLines,
  useCartSession,
  type CartSnapshot,
} from '../store/cart-store';
import { cartLineKey, type CartLine as StoredLine } from '../utils/cart-lines';
import type { BagAnnouncementStrings, BagLineStrings } from '../utils/bag-strings';
import {
  REMOVE_FADE_MS,
  bagAnnouncementToast,
  focusTargetAfterRemove,
  quantityChangedToast,
  removedToast,
  settledQuantity,
  visibleRowKeys,
  type BagToast,
  type RemoveFocusTarget,
} from '../utils/bag-view-model';
import { reconcileBag, type BagRow, type BagView } from '../utils/reconcile';

const NO_LINES: readonly StoredLine[] = [];
const NO_KEYS: ReadonlySet<string> = new Set();

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Raises a bag toast, attaching the handler its `action` names (and that action's label). */
function raise(
  bagToast: BagToast,
  strings: Pick<BagAnnouncementStrings, 'undo' | 'retry'>,
  handlers: { undo?(): void; retry?(): void } = {}
) {
  const handler = bagToast.action === null ? undefined : handlers[bagToast.action];
  showToast({
    tone: bagToast.tone,
    message: bagToast.message,
    id: bagToast.id,
    action:
      bagToast.action !== null && handler
        ? { label: strings[bagToast.action], onClick: handler }
        : undefined,
  });
}

export interface BagControllerOptions {
  /** The surface is showing the bag (the drawer while open; the bag page always). */
  active: boolean;
  locale: AppLocale;
  strings: { line: Pick<BagLineStrings, 'currency'>; announcements: BagAnnouncementStrings };
}

export interface BagController {
  cart: CartSnapshot;
  view: BagView;
  /** A re-quote is in flight. */
  pending: boolean;
  removing: ReadonlySet<string>;
  emptyHeading: RefObject<HTMLHeadingElement | null>;
  /** The element focus lands on after a neighbouring row is removed. */
  focusRef(key: string): (element: HTMLElement | null) => void;
  onQuantityChange(key: string, quantity: number, name: string): void;
  onRemove(row: BagRow, name: string): void;
  onRetry(): void;
  onEmpty(): void;
}

/**
 * What the drawer and the bag page share (plan Units 6-7): the quote, `reconcileBag`, and
 * the model's store writes, toasts, remove fade and focus hand-off, applied in effects.
 * Client-bundled without a directive: only boundary islands import it.
 */
export function useBagController({ active, locale, strings }: BagControllerOptions): BagController {
  const cart = useCartLines();
  const session = useCartSession();
  const actions = useCartActions();

  const quote = useCartQuote(cart, active);
  const { view, correction, announcement, rememberPrices, priceUpdates } = reconcileBag({
    lines: cart.hydrated ? cart.lines : NO_LINES,
    result: quote.result,
    fetch: quote.fetch,
    session,
  });
  const pending = quote.fetch.status === 'fetching';

  const [removing, setRemoving] = useState<ReadonlySet<string>>(NO_KEYS);
  const focusElements = useRef(new Map<string, HTMLElement>());
  const emptyHeading = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<RemoveFocusTarget | null>(null);
  const pendingQuantity = useRef<{ key: string; name: string } | null>(null);
  const appliedCorrection = useRef<string | null>(null);
  const timers = useRef(new Set<number>());
  // A toast's Try again can be pressed long after the render that raised it.
  const retryQuote = useRef(quote.retry);

  useEffect(() => {
    retryQuote.current = quote.retry;
  });

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const timer of pendingTimers) window.clearTimeout(timer);
    };
  }, []);

  // The one store correction, once per settled quote key.
  useEffect(() => {
    if (!active || !correction || appliedCorrection.current === correction.quoteKey) return;
    appliedCorrection.current = correction.quoteKey;
    for (const rewrite of correction.rewrites) {
      actions.applyCanonical(rewrite.key, rewrite.options);
    }
  }, [active, correction, actions]);

  // Session memory; both setters ignore a write that changes nothing.
  useEffect(() => {
    if (!active) return;
    if (priceUpdates) actions.markPriceUpdates(priceUpdates);
    if (rememberPrices) actions.rememberPrices(rememberPrices);
  }, [active, priceUpdates, rememberPrices, actions]);

  // Toasts go out after the quote settles.
  useEffect(() => {
    if (!active) return;
    const changed = pendingQuantity.current;
    if (changed) {
      const settle = settledQuantity(view, changed.key);
      if (settle.kind !== 'wait') pendingQuantity.current = null;
      if (settle.kind === 'announce') {
        const subtotal = formatPrice(settle.subtotal, locale, strings.line.currency);
        raise(
          quantityChangedToast(
            strings.announcements,
            changed.key,
            changed.name,
            settle.count,
            subtotal
          ),
          strings.announcements
        );
      }
    }
    // The live store, not the render's session: a Strict Mode re-run, or the drawer open over
    // `/bag` (two controllers), must not raise it twice. The stable id is the second guard.
    if (announcement && !cartStore.getSession().announcedQuoteKeys.has(announcement.markKey)) {
      actions.markQuoteAnnounced(announcement.markKey);
      raise(
        bagAnnouncementToast(announcement, strings.announcements, locale),
        strings.announcements,
        {
          retry: () => retryQuote.current(),
        }
      );
    }
  }, [active, view, announcement, strings, locale, actions]);

  // After every render: focus after a removal, once its row has unmounted.
  useEffect(() => {
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

  const rows: readonly BagRow[] = view.kind === 'ready' || view.kind === 'loading' ? view.rows : [];

  const onQuantityChange = (key: string, quantity: number, name: string) => {
    pendingQuantity.current = { key, name };
    actions.setQuantity(key, quantity);
  };

  const onRemove = (row: BagRow, name: string) => {
    if (removing.has(row.key)) return;
    const keys = visibleRowKeys(
      rows.map((r) => r.key),
      removing,
      row.key
    );

    const finish = () => {
      // What Undo needs, read as the line leaves the store: its position, quantity and hint.
      const stored = cartStore.getSnapshot();
      const index = stored.hydrated
        ? stored.lines.findIndex((line) => cartLineKey(line) === row.key)
        : -1;
      const line = stored.hydrated && index >= 0 ? stored.lines[index]! : null;
      const hint = cartStore.getSession().hints.get(row.key);

      pendingFocus.current = focusTargetAfterRemove(keys, row.key);
      if (pendingQuantity.current?.key === row.key) pendingQuantity.current = null;
      actions.remove(row.key);
      setRemoving((current) => {
        if (!current.has(row.key)) return current;
        const next = new Set(current);
        next.delete(row.key);
        return next;
      });

      if (line) {
        raise(removedToast(strings.announcements, row.key, name), strings.announcements, {
          undo: () => actions.restore({ line, index, hint }),
        });
      }
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
    quote.retry();
  };

  const onEmpty = () => {
    pendingFocus.current = { kind: 'empty' };
    actions.clear();
  };

  const focusRef = (key: string) => (element: HTMLElement | null) => {
    if (element) focusElements.current.set(key, element);
    else focusElements.current.delete(key);
  };

  return {
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
  };
}
