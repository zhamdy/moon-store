import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AppLocale } from '@/i18n/routing';
import { formatPrice } from '@/features/products/utils/price';
import { fillTemplate } from '@/lib/utils/fill-template';
import { useCartQuote } from '../api/use-cart-quote';
import {
  cartStore,
  useCartActions,
  useCartLines,
  useCartSession,
  type CartSnapshot,
} from '../store/cart-store';
import type { CartLine as StoredLine } from '../utils/cart-lines';
import type { BagAnnouncementStrings, BagLineStrings } from '../utils/bag-strings';
import {
  REMOVE_FADE_MS,
  bagAnnouncementText,
  focusTargetAfterRemove,
  quantityChangedText,
  settledQuantity,
  visibleRowKeys,
  type RemoveFocusTarget,
} from '../utils/bag-view-model';
import { reconcileBag, type BagRow, type BagView } from '../utils/reconcile';

const NO_LINES: readonly StoredLine[] = [];
const NO_KEYS: ReadonlySet<string> = new Set();

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface BagControllerOptions {
  /** The surface is showing the bag (the drawer while open; the bag page always). */
  active: boolean;
  locale: AppLocale;
  strings: { line: Pick<BagLineStrings, 'currency'>; announcements: BagAnnouncementStrings };
  /** Writes to the surface's own polite live region; must be referentially stable. */
  announce(message: string): void;
  /** Runs before every bag interaction (the drawer ends its `added` mode here). */
  onInteract?(): void;
  /** Runs after every render, before a pending removal focus lands (the drawer's scroll). */
  onAfterRender?(): void;
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
 * the model's store writes, announcements, remove fade and focus hand-off, applied in
 * effects. Client-bundled without a directive: only boundary islands import it.
 */
export function useBagController({
  active,
  locale,
  strings,
  announce,
  onInteract,
  onAfterRender,
}: BagControllerOptions): BagController {
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

  // Announcements go out after the quote settles, through the surface's live region.
  useEffect(() => {
    if (!active) return;
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
    // The live store, not the render's session: a Strict Mode re-run must not announce twice.
    if (announcement && !cartStore.getSession().announcedQuoteKeys.has(announcement.markKey)) {
      messages.push(bagAnnouncementText(announcement, strings.announcements, locale));
      actions.markQuoteAnnounced(announcement.markKey);
    }
    if (messages.length > 0) announce(messages.join('. '));
  }, [active, view, announcement, strings, locale, actions, announce]);

  // After every render: the surface's own work first, then focus after a removal once its
  // row has unmounted.
  useEffect(() => {
    onAfterRender?.();

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
    onInteract?.();
    pendingQuantity.current = { key, name };
    actions.setQuantity(key, quantity);
  };

  const onRemove = (row: BagRow, name: string) => {
    if (removing.has(row.key)) return;
    onInteract?.();
    announce(fillTemplate(strings.announcements.removed, { name }));
    const keys = visibleRowKeys(
      rows.map((r) => r.key),
      removing,
      row.key
    );

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
    onInteract?.();
    quote.retry();
  };

  const onEmpty = () => {
    onInteract?.();
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
