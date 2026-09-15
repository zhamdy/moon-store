import type { RefObject } from 'react';
import { Link } from '@/i18n/navigation';
import type { CheckoutNoticeText } from '../utils/checkout-view-model';

export interface CheckoutCartNoticeProps {
  text: CheckoutNoticeText;
  headingRef: RefObject<HTMLHeadingElement | null>;
  bagHref: string;
  labels: { returnToBag: string; tryAgain: string };
  onRetry(): void;
}

const TEXT_ACTION =
  'type-small inline-flex min-h-11 cursor-pointer items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text';

/**
 * What changed in the bag, above the form (CO-13). A rule at the inline start, not a boxed
 * alert, and not a live region: the quote toast announces changes, and the heading takes focus
 * only after a Continue that ended blocked or failed.
 */
export function CheckoutCartNotice({
  text,
  headingRef,
  bagHref,
  labels,
  onRetry,
}: CheckoutCartNoticeProps) {
  return (
    <div className="mb-10 border-s-2 border-text ps-4">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="type-body scroll-mt-[calc(var(--header-h)+1.5rem)] font-medium focus:outline-none"
      >
        {text.heading}
      </h2>
      {text.body && <p className="type-small mt-1 text-text-secondary">{text.body}</p>}
      {text.action === 'returnToBag' && (
        <Link href={bagHref} className={TEXT_ACTION}>
          {labels.returnToBag}
        </Link>
      )}
      {text.action === 'tryAgain' && (
        <button type="button" onClick={onRetry} className={TEXT_ACTION}>
          {labels.tryAgain}
        </button>
      )}
    </div>
  );
}
