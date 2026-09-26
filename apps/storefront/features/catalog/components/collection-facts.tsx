import { formatAmount, formatPrice } from '@/features/products/utils/price';
import type { AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';

export interface CollectionFactsProps {
  locale: AppLocale;
  /** "6 pieces", resolved by the caller (`formatResultCount`). */
  count: string;
  /** From the collection's listing; omitted when it could not be read. */
  priceRange?: { min: number; max: number } | null;
  /** `products.currency`. */
  currency: string;
  className?: string;
}

/**
 * A collection's facts in one quiet line: "6 pieces · 1,800–5,500 EGP", or one price when
 * every piece costs the same. The range sits in `<bdi dir="ltr">` so it never reverses in
 * Arabic (the design system's rule for ranges); the currency label stays outside it, where
 * the locale puts it.
 */
export function CollectionFacts({
  locale,
  count,
  priceRange,
  currency,
  className,
}: CollectionFactsProps) {
  return (
    <p className={cn('type-supporting text-text-secondary tabular-nums', className)}>
      {count}
      {priceRange && (
        <>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, </span>
          {priceRange.min === priceRange.max ? (
            formatPrice(priceRange.min, locale, currency)
          ) : (
            <>
              <bdi dir="ltr">
                {formatAmount(priceRange.min, locale)}–{formatAmount(priceRange.max, locale)}
              </bdi>{' '}
              {currency}
            </>
          )}
        </>
      )}
    </p>
  );
}
