'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BAG_HREF } from '@/components/layout/navigation-items';
import { showToast } from '@/components/feedback/show-toast';
import { usePurchaseSelection } from '@/features/products/components/purchase-selection-context';
import type { LocalizedText } from '@/features/products/utils/localized-name';
import { useRouter } from '@/i18n/navigation';
import { fillTemplate } from '@/lib/utils/fill-template';
import { MAX_LINE_QUANTITY } from '../constants';
import { useCartActions } from '../store/cart-store';
import { addToBagIntent, addToBagToast } from '../utils/add-to-bag-action';
import type { AddToBagStrings } from '../utils/bag-strings';
import { quantityControl } from '../utils/quantity-control';
import { QuantityStepper } from './quantity-stepper';

export interface AddToBagButtonProps {
  slug: string;
  /** The page's localized name: the add toast and the line hint; never persisted. */
  name: LocalizedText;
  /** The product's first image, shown on the new line until its quote arrives; never persisted. */
  imageUrl: string | null;
  strings: AddToBagStrings;
}

/**
 * Add to Bag (the fourteenth client boundary), rendered in the purchase panel's action slot
 * so it reads the panel's readiness (CD-11), with the bag's quantity stepper beside it (owner
 * decision 2026-09-15: 1..10, reset to 1 after an add that landed pieces). An add is
 * acknowledged by a toast with View bag, never by opening the drawer (owner decision
 * 2026-09-15, overriding CD-13). Never `disabled`: a press while a choice is missing sends
 * focus to that option; sold out hides the stepper and is `aria-disabled`, still focusable.
 * The quantity starts at 1 and the stepper's visibility and the label depend only on
 * readiness, which the server computes identically, so the first client render matches.
 */
export function AddToBagButton({ slug, name, imageUrl, strings }: AddToBagButtonProps) {
  const { readiness, unitPrice, focusFirstUnselected } = usePurchaseSelection();
  const actions = useCartActions();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const soldOut = readiness.kind === 'soldOut';

  const onClick = () => {
    const intent = addToBagIntent(readiness, slug, quantity);
    if (intent.kind === 'focusSelection') {
      focusFirstUnselected();
    } else if (intent.kind === 'add') {
      const result = actions.add(intent.identity, {
        quantity: intent.quantity,
        hint: { name, imageUrl, unitPrice },
      });
      const { tone, message, id } = addToBagToast(result, name.text, strings, intent.quantity);
      showToast({
        tone,
        message,
        id,
        action: { label: strings.viewBag, onClick: () => router.push(BAG_HREF) },
      });
      if (result.addedQuantity > 0) setQuantity(1);
    }
  };

  if (soldOut) {
    return (
      <Button
        onClick={onClick}
        aria-disabled
        className="w-full aria-disabled:cursor-not-allowed aria-disabled:bg-disabled aria-disabled:hover:bg-disabled"
      >
        {strings.soldOut}
      </Button>
    );
  }

  // The PDP has no quote: the limit is the line cap alone, as for an unquoted bag line.
  const control = quantityControl(quantity, { status: 'unquoted', pending: false });

  return (
    // Wraps rather than squeezing: below 10rem of room beside the stepper the button takes its
    // own full-width line (320px in Arabic). The button stretches to the bordered stepper's
    // height, so the two edges line up.
    <div className="flex flex-wrap items-stretch gap-3">
      <QuantityStepper
        size="action"
        value={quantity}
        control={control}
        labels={{
          group: fillTemplate(strings.stepper.quantity, { name: name.text }),
          increase: fillTemplate(strings.stepper.increase, { name: name.text }),
          decrease: fillTemplate(strings.stepper.decrease, { name: name.text }),
          limit:
            control.incrementDescription === 'capped'
              ? fillTemplate(strings.capped, { max: MAX_LINE_QUANTITY })
              : null,
        }}
        onStep={(delta) =>
          setQuantity((current) => Math.min(Math.max(current + delta, 1), MAX_LINE_QUANTITY))
        }
      />
      <Button onClick={onClick} className="min-w-0 grow basis-40">
        {strings.addToBag}
      </Button>
    </div>
  );
}
