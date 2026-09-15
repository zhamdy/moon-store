'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { usePurchaseSelection } from '@/features/products/components/purchase-selection-context';
import type { LocalizedText } from '@/features/products/utils/localized-name';
import { useCartActions } from '../store/cart-store';
import { addToBagIntent, drawerOpeningFor } from '../utils/add-to-bag-action';
import type { AddToBagStrings } from '../utils/bag-strings';
import { loadDrawer } from './load-drawer';

export interface AddToBagButtonProps {
  slug: string;
  /** The page's localized name: the drawer description and the line hint; never persisted. */
  name: LocalizedText;
  /** The product's first image, shown on the new line until its quote arrives; never persisted. */
  imageUrl: string | null;
  strings: AddToBagStrings;
}

/**
 * Add to Bag (the fourteenth client boundary), rendered in the purchase panel's action slot
 * so it reads the panel's readiness (CD-11). Never `disabled`: a press while a choice is
 * missing sends focus to that option; sold out is `aria-disabled` and stays focusable. The
 * label depends only on readiness, which the server computes identically, so the first
 * client render matches the server HTML.
 */
export function AddToBagButton({ slug, name, imageUrl, strings }: AddToBagButtonProps) {
  const { readiness, unitPrice, focusFirstUnselected } = usePurchaseSelection();
  const actions = useCartActions();
  const soldOut = readiness.kind === 'soldOut';

  useEffect(() => {
    // Warm the drawer chunk so the first add opens the dialog without waiting on it (CD-19).
    // A failed warm-up is ignored; a failed drawer load is caught by the trigger and retried on the next open.
    loadDrawer().catch(() => {});
  }, []);

  const onClick = () => {
    const intent = addToBagIntent(readiness, slug);
    if (intent.kind === 'focusSelection') {
      focusFirstUnselected();
    } else if (intent.kind === 'add') {
      const result = actions.add(intent.identity, { name, imageUrl, unitPrice });
      actions.openDrawer(drawerOpeningFor(result, name.text, strings));
    }
  };

  return (
    <Button
      onClick={onClick}
      aria-disabled={soldOut || undefined}
      className="w-full aria-disabled:cursor-not-allowed aria-disabled:bg-disabled aria-disabled:hover:bg-disabled"
    >
      {soldOut ? strings.soldOut : strings.addToBag}
    </Button>
  );
}
