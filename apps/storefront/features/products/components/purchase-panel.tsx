'use client';

import { useId, useState } from 'react';
import { fillTemplate } from '@/lib/utils/fill-template';
import {
  availabilityStatus,
  displayedPrice,
  initialSelection,
  purchaseReadiness,
  valueAvailable,
  type PurchaseProduct,
  type Selection,
} from '../utils/variant-selection';

/** Every string arrives resolved on the server; templates keep `{name}` placeholders. */
export interface PurchasePanelStrings {
  inStock: string;
  soldOut: string;
  /** "From {price}" */
  priceFrom: string;
  /** "{option}: {value}" */
  selected: string;
  /** "{value}, sold out" */
  valueSoldOut: string;
}

export interface PurchasePanelProps {
  product: PurchaseProduct;
  /** Option key to its legend; `staff` marks an untranslated staff label (rendered `dir="auto"`). */
  legends: Record<string, { text: string; staff: boolean }>;
  /** `String(amount)` to the server-formatted price: the product price and every variant price. */
  prices: Record<string, string>;
  strings: PurchasePanelStrings;
}

// The radio is visually hidden, so the cell draws its focus ring; the scroll margin keeps a
// focused cell clear of the sticky header (WCAG 2.2 focus not obscured).
const CELL = [
  'relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-media border border-border px-3',
  'scroll-mt-[calc(var(--header-h)+1.5rem)] transition-colors duration-fast ease-ui',
  'hover:border-text has-checked:border-text has-checked:shadow-[inset_0_0_0_1px_var(--color-text)]',
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-solid has-focus-visible:outline-(--focus-ring-color)',
].join(' ');

/**
 * Option selection with a live price and availability (PD-11, the tenth client boundary).
 * Native radios give arrow keys and state announcements; sold-out values stay enabled so
 * they can be found and heard (never `disabled`, never colour alone). The rules live in
 * `variant-selection.ts`; `data-readiness` exposes the Cart contract (PD-B) with no button.
 */
export function PurchasePanel({ product, legends, prices, strings }: PurchasePanelProps) {
  const baseId = useId();
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product.options));

  const price = displayedPrice(selection, product);
  const formatted = prices[String(price.price)] ?? String(price.price);
  const status = availabilityStatus(selection, product);
  const readiness = purchaseReadiness(selection, product);

  return (
    <div data-purchase-panel data-readiness={readiness.kind}>
      {/* Mounted with the first render so later changes are announced. */}
      <div aria-live="polite" aria-atomic="true">
        <p className="type-body-lg tabular-nums">
          {price.kind === 'from'
            ? fillTemplate(strings.priceFrom, { price: formatted })
            : formatted}
        </p>
        <p className="type-small mt-2 min-h-[1lh] text-text-secondary">
          {status === 'inStock' ? strings.inStock : status === 'soldOut' ? strings.soldOut : null}
        </p>
      </div>

      {product.options.map((option, optionIndex) => {
        const legend = legends[option.key] ?? { text: option.label, staff: true };
        const chosen = selection[option.key] ?? null;
        const name = `${baseId}-option-${optionIndex}`;
        return (
          <fieldset key={option.key} className="mt-8 min-w-0">
            <legend className="type-label text-text-secondary">
              <span dir={legend.staff ? 'auto' : undefined}>
                {chosen === null
                  ? legend.text
                  : fillTemplate(strings.selected, { option: legend.text, value: chosen })}
              </span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {option.values.map((value) => {
                const available = valueAvailable(option.key, value, selection, product.variants);
                return (
                  <label key={value} className={CELL}>
                    <input
                      type="radio"
                      name={name}
                      value={value}
                      checked={chosen === value}
                      onChange={() => setSelection((prev) => ({ ...prev, [option.key]: value }))}
                      className="sr-only"
                    />
                    {available ? (
                      <span dir="auto" className="type-small">
                        {value}
                      </span>
                    ) : (
                      <>
                        <span
                          aria-hidden="true"
                          dir="auto"
                          className="type-small text-disabled line-through"
                        >
                          {value}
                        </span>
                        <span className="sr-only">
                          {fillTemplate(strings.valueSoldOut, { value })}
                        </span>
                      </>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
