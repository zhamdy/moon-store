'use client';

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
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
import { PurchaseSelectionContext, type PurchaseSelection } from './purchase-selection-context';

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
  /** "Choose a {option}" (`{option}`: the localized legend) */
  chooseOption: string;
}

export interface PurchasePanelProps {
  product: PurchaseProduct;
  /** Option key to its legend; `staff` marks an untranslated staff label (rendered `dir="auto"`). */
  legends: Record<string, { text: string; staff: boolean }>;
  /** `String(amount)` to the server-formatted price: the product price and every variant price. */
  prices: Record<string, string>;
  strings: PurchasePanelStrings;
  /** The purchase action, composed by the page; it reads the selection through context. */
  action?: ReactNode;
}

// The radio is visually hidden, so the cell draws its focus ring; the scroll margin keeps a
// focused cell clear of the sticky header (WCAG 2.2 focus not obscured).
const CELL = [
  'relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-media-sm border border-border px-3',
  'scroll-mt-[calc(var(--header-h)+1.5rem)] transition-colors duration-fast ease-ui',
  'hover:border-text has-checked:border-text has-checked:shadow-[inset_0_0_0_1px_var(--color-text)]',
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-solid has-focus-visible:outline-(--focus-ring-color)',
].join(' ');

/**
 * Option selection with a live price and availability (PD-11, the tenth client boundary).
 * Native radios give arrow keys and state announcements; sold-out values stay enabled so
 * they can be found and heard (never `disabled`, never colour alone). The rules live in
 * `variant-selection.ts`; `data-readiness` exposes the Cart contract (PD-B), and the
 * `action` slot receives it through `PurchaseSelectionContext` (CD-11).
 */
export function PurchasePanel({ product, legends, prices, strings, action }: PurchasePanelProps) {
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product.options));
  // "Choose a {option}" under the option that is missing, after a press; the next selection clears it.
  const [prompt, setPrompt] = useState<{ key: string; text: string } | null>(null);

  const price = displayedPrice(selection, product);
  const formatted = prices[String(price.price)] ?? String(price.price);
  const status = availabilityStatus(selection, product);
  const readiness = useMemo(() => purchaseReadiness(selection, product), [selection, product]);
  const unitPrice = readiness.kind === 'ready' && price.kind === 'exact' ? price.price : null;

  const focusFirstUnselected = useCallback(() => {
    if (readiness.kind !== 'needsSelection') return;
    const key = readiness.keys[0];
    const index = product.options.findIndex((option) => option.key === key);
    if (key === undefined || index < 0) return;
    const group = rootRef.current?.querySelector(`[data-option-index="${index}"]`);
    const radio =
      group?.querySelector<HTMLInputElement>('input[type="radio"]:checked') ??
      group?.querySelector<HTMLInputElement>('input[type="radio"]');
    radio?.focus();
    const legend = legends[key]?.text ?? product.options[index]!.label;
    setPrompt({ key, text: fillTemplate(strings.chooseOption, { option: legend }) });
  }, [readiness, product.options, legends, strings.chooseOption]);

  const context = useMemo<PurchaseSelection>(
    () => ({ readiness, unitPrice, focusFirstUnselected }),
    [readiness, unitPrice, focusFirstUnselected]
  );

  return (
    <PurchaseSelectionContext value={context}>
      <div ref={rootRef} data-purchase-panel data-readiness={readiness.kind}>
        {/* Mounted with the first render so later changes are announced. */}
        <div aria-live="polite" aria-atomic="true">
          <p className="type-body-lg tabular-nums">
            {price.kind === 'from'
              ? fillTemplate(strings.priceFrom, { price: formatted })
              : formatted}
          </p>
          {/* Height reserved for the badge, so choosing a sold-out size never shifts the layout. */}
          <p className="type-small mt-2 flex min-h-7 items-center text-text-secondary">
            {status === 'inStock' ? (
              strings.inStock
            ) : status === 'soldOut' ? (
              <span className="type-caption rounded-media-sm bg-action px-2 py-1 font-medium tracking-[0.08em] uppercase text-on-action">
                {strings.soldOut}
              </span>
            ) : null}
          </p>
        </div>

        {product.options.map((option, optionIndex) => {
          const legend = legends[option.key] ?? { text: option.label, staff: true };
          const chosen = selection[option.key] ?? null;
          const name = `${baseId}-option-${optionIndex}`;
          const promptId = `${name}-prompt`;
          const prompted = prompt?.key === option.key;
          return (
            <fieldset
              key={option.key}
              data-option-index={optionIndex}
              aria-describedby={prompted ? promptId : undefined}
              className="mt-8 min-w-0"
            >
              <legend
                className={`type-label transition-colors duration-fast ease-ui ${prompted ? 'text-text' : 'text-text-secondary'}`}
              >
                <span dir={legend.staff ? 'auto' : undefined}>
                  {chosen === null
                    ? legend.text
                    : fillTemplate(strings.selected, { option: legend.text, value: chosen })}
                </span>
              </legend>
              {/* Mounted empty with its height reserved: announced when it appears, and the
                  cells and Add to Bag never move under a second tap. */}
              <div aria-live="polite" className="min-h-6 pt-2">
                {prompted && (
                  <p
                    id={promptId}
                    className="type-small flex items-start gap-2 font-medium text-error"
                  >
                    <CircleAlert
                      size={16}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />
                    {prompt.text}
                  </p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const available = valueAvailable(option.key, value, selection, product.variants);
                  return (
                    <label
                      key={value}
                      className={available ? CELL : `${CELL} border-dashed bg-surface-soft`}
                    >
                      <input
                        type="radio"
                        name={name}
                        value={value}
                        checked={chosen === value}
                        onChange={() => {
                          setPrompt(null);
                          setSelection((prev) => ({ ...prev, [option.key]: value }));
                        }}
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
                            className="type-small text-text-secondary line-through"
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

        {action && (
          <div data-product-action className="mt-8">
            {action}
          </div>
        )}
      </div>
    </PurchaseSelectionContext>
  );
}
