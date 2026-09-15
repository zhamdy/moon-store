'use client';

import { lazy, Suspense, useState, type MouseEvent } from 'react';
import { ShoppingBag } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { BAG_HREF } from '@/components/layout/navigation-items';
import { useCartActions, useCartLines, useCartSession } from '../store/cart-store';
import { totalPieces } from '../utils/cart-lines';
import { bagTriggerLabel } from '../utils/bag-trigger-label';
import type { AppLocale } from '@/i18n/routing';
import type { BagDrawerStrings, BagTriggerStrings } from '../utils/bag-strings';
import { DrawerErrorBoundary } from './drawer-error-boundary';
import { loadDrawer } from './load-drawer';

export interface BagTriggerProps {
  strings: BagTriggerStrings;
  /** Resolved on the server with the trigger's; passed through to the lazy drawer. */
  drawerStrings: BagDrawerStrings;
  /** The empty drawer's Continue shopping target, from `catalogPath` on the server. */
  shopHref: string;
  locale: AppLocale;
}

function isPlainPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

const warmDrawer = () => {
  // Warm-up only; the lazy component requests the same module again when it first renders.
  loadDrawer().catch(() => {});
};

/**
 * The header Bag action (the fifteenth client boundary): the same 44px icon link to `/bag`
 * the header always rendered, plus the count badge and the lazy drawer host (CD-12, CD-19).
 * An unmodified primary click off `/bag` opens the drawer, the only way it opens; a modified
 * click, a click before hydration or a click on `/bag` navigates. Bag messages are toasts.
 *
 * The server snapshot is "not hydrated", so the server HTML and the first client render are
 * the same element: label "Bag", no badge, no `aria-haspopup`.
 */
export function BagTrigger({ strings, drawerStrings, shopHref, locale }: BagTriggerProps) {
  const cart = useCartLines();
  const { drawer } = useCartSession();
  const actions = useCartActions();
  const onBag = usePathname() === BAG_HREF;

  // Mount the drawer at its first opening and keep it mounted, so its close transition runs.
  const [drawerMounted, setDrawerMounted] = useState(false);
  if (drawer.open && !drawerMounted) {
    setDrawerMounted(true);
  }
  // React.lazy, not next/dynamic (~1.2 KB gz less eager JS); in state so a failed import can retry.
  const [BagDrawer, setBagDrawer] = useState(() => lazy(loadDrawer));

  const onDrawerError = () => {
    // A rejected lazy is cached forever: close, unmount, and retry the import on the next open.
    actions.closeDrawer();
    setDrawerMounted(false);
    setBagDrawer(() => lazy(loadDrawer));
  };

  const count = cart.hydrated ? totalPieces(cart.lines) : 0;
  const label = bagTriggerLabel(cart.hydrated, count, onBag, strings, locale);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!cart.hydrated || onBag || !isPlainPrimaryClick(event)) {
      return;
    }
    event.preventDefault();
    actions.openDrawer();
  };

  return (
    <>
      <Link
        href={BAG_HREF}
        aria-label={label.ariaLabel}
        aria-haspopup={label.ariaHaspopup}
        aria-current={label.ariaCurrent}
        onClick={onClick}
        onPointerEnter={warmDrawer}
        onFocus={warmDrawer}
        className="relative flex h-11 w-11 items-center justify-center transition-opacity duration-fast ease-ui hover:opacity-70"
      >
        <ShoppingBag size={20} strokeWidth={1.5} aria-hidden="true" />
        {label.badgeText !== null && (
          // `bg-bg text-text` read through the header's --surface-* variables: ink on ivory
          // when solid, ivory on transparent over the hero.
          <span
            aria-hidden="true"
            className="type-caption absolute -end-0.5 top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center bg-bg px-1 text-text tabular-nums"
          >
            {label.badgeText}
          </span>
        )}
      </Link>
      {drawerMounted && (
        <DrawerErrorBoundary onError={onDrawerError}>
          <Suspense fallback={null}>
            <BagDrawer strings={drawerStrings} locale={locale} shopHref={shopHref} />
          </Suspense>
        </DrawerErrorBoundary>
      )}
    </>
  );
}
