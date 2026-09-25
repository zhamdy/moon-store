import { useId } from 'react';
import { Button, buttonClassName } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { CHECKOUT_ENTRY_ENABLED, CHECKOUT_HREF } from '../constants';
import {
  checkoutEntryModel,
  checkoutEntryReasonText,
  type CheckoutEntryStrings,
} from '../utils/checkout-entry-model';
import type { CheckoutReadiness } from '../utils/checkout-readiness';

// The link carries the Button family's classes (components/ui/button.tsx), so the enabled
// link and the disabled button are the same control in two states.
const PRIMARY_LINK = buttonClassName({ block: true });

export interface CheckoutEntryProps {
  readiness: CheckoutReadiness;
  strings: CheckoutEntryStrings;
  locale: AppLocale;
}

/**
 * The Bag page's way into Checkout (plan 2026-09-15-002, Unit 2), in `BagSummary`'s
 * `[data-checkout-action]` slot. Client-bundled without a directive: only `bag-view.tsx`
 * reaches it. A link only when the quote says the bag can be bought; otherwise an
 * `aria-disabled` button, focusable and inert, described by the visible reason. The reason
 * row keeps its height in every state, so the summary never jumps. Not a live region: bag
 * changes are already announced by the quote toast.
 */
export function CheckoutEntry({ readiness, strings, locale }: CheckoutEntryProps) {
  const reasonId = useId();
  const model = checkoutEntryModel(readiness, CHECKOUT_ENTRY_ENABLED);
  if (model.kind === 'none') return null;

  return (
    <div className="pt-6">
      {model.kind === 'link' ? (
        <Link href={CHECKOUT_HREF} className={PRIMARY_LINK}>
          {strings.action}
        </Link>
      ) : (
        <Button aria-disabled aria-describedby={reasonId} block>
          {strings.action}
        </Button>
      )}
      <p id={reasonId} className="type-supporting mt-2 min-h-lh text-text-secondary">
        {model.kind === 'unavailable' ? checkoutEntryReasonText(model.reason, strings, locale) : ''}
      </p>
    </div>
  );
}
