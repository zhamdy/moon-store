'use client';

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { dismissToast, showToast } from '@/components/feedback/show-toast';
import { fillTemplate } from '@/lib/utils/fill-template';
import {
  availabilityStatus,
  displayedPrice,
  initialSelection,
  purchaseReadiness,
  unavailableValues,
  valueAvailable,
  type PurchaseProduct,
  type Selection,
} from '../utils/variant-selection';
import { PurchaseSelectionContext, type PurchaseSelection } from './purchase-selection-context';
import { StatusText } from '@/components/ui/status';

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
  /** The note beside a legend, `{values}` a list: "{values} is sold out" / "… are sold out". */
  soldOutNote: { one: string; other: string };
}

export interface PurchasePanelProps {
  product: PurchaseProduct;
  /** Option key to its legend; `staff` marks an untranslated staff label (rendered `dir="auto"`). */
  legends: Record<string, { text: string; staff: boolean }>;
  /** `String(amount)` to the server-formatted price: the product price and every variant price. */
  prices: Record<string, string>;
  strings: PurchasePanelStrings;
  /** The page's locale, for the list in the sold-out note (`Intl.ListFormat`). */
  locale: string;
  /** The description's lead paragraph, server-rendered, under the price. */
  lead?: ReactNode;
  /** The purchase action, composed by the page; it reads the selection through context. */
  action?: ReactNode;
}

// The radio is visually hidden, so the cell draws its focus ring; the scroll margin keeps a
// focused cell clear of the sticky header (WCAG 2.2 focus not obscured).
// `.option-cell` (app/globals.css): the design system's size cell — Ink fill when chosen, a
// dashed edge and one diagonal stroke when unavailable (`data-unavailable`), focus ring on
// the cell. The scroll margin keeps a focused cell clear of the sticky header.
const CELL = 'option-cell scroll-mt-[calc(var(--header-h)+1.5rem)]';

/** One id: repeated presses replace the "Choose a {option}" toast rather than stacking it. */
const CHOOSE_OPTION_TOAST_ID = 'choose-option';

/**
 * Option selection with a live price and availability (PD-11, the tenth client boundary).
 * Native radios give arrow keys and state announcements; sold-out values stay enabled so
 * they can be found and heard (never `disabled`, never colour alone). The rules live in
 * `variant-selection.ts`; `data-readiness` exposes the Cart contract (PD-B), and the
 * `action` slot receives it through `PurchaseSelectionContext` (CD-11).
 */
export function PurchasePanel({
  product,
  legends,
  prices,
  strings,
  locale,
  lead,
  action,
}: PurchasePanelProps) {
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
    const text = fillTemplate(strings.chooseOption, { option: legend });
    setPrompt({ key, text });
    // The toast is the announcement; the inline prompt stays as the visible, described error.
    showToast({ tone: 'error', message: text, id: CHOOSE_OPTION_TOAST_ID });
  }, [readiness, product.options, legends, strings.chooseOption]);

  const list = useMemo(
    () => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }),
    [locale]
  );

  const context = useMemo<PurchaseSelection>(
    () => ({ readiness, unitPrice, focusFirstUnselected }),
    [readiness, unitPrice, focusFirstUnselected]
  );

  return (
    <PurchaseSelectionContext value={context}>
      <div ref={rootRef} data-purchase-panel data-readiness={readiness.kind}>
        {/* Mounted with the first render so later changes are announced. The status sits
            beside the price, so nothing is reserved for it and nothing moves when it
            appears. */}
        <div aria-live="polite" aria-atomic="true">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="type-body-lg font-medium tabular-nums">
              {price.kind === 'from'
                ? fillTemplate(strings.priceFrom, { price: formatted })
                : formatted}
            </span>
            {status === 'inStock' ? (
              <StatusText tone="success">{strings.inStock}</StatusText>
            ) : status === 'soldOut' ? (
              <StatusText tone="danger">{strings.soldOut}</StatusText>
            ) : null}
          </p>
        </div>

        {lead && <div className="mt-4">{lead}</div>}

        {product.options.map((option, optionIndex) => {
          const legend = legends[option.key] ?? { text: option.label, staff: true };
          const chosen = selection[option.key] ?? null;
          const name = `${baseId}-option-${optionIndex}`;
          const promptId = `${name}-prompt`;
          const prompted = prompt?.key === option.key;
          const soldOut = unavailableValues(option, selection, product.variants);
          return (
            <fieldset
              key={option.key}
              data-option-index={optionIndex}
              aria-describedby={prompted ? promptId : undefined}
              className="mt-7 min-w-0"
            >
              {/* Floated so it lays out as a block row: the note sits at its inline end. */}
              <legend className="float-start flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span
                  dir={legend.staff ? 'auto' : undefined}
                  className={`type-field-label transition-colors duration-fast ease-ui ${prompted ? 'text-text' : 'text-text-secondary'}`}
                >
                  {chosen === null
                    ? legend.text
                    : fillTemplate(strings.selected, { option: legend.text, value: chosen })}
                </span>
                {/* Hidden from the group's name: every cell already says "sold out". */}
                {soldOut.length > 0 && (
                  <span aria-hidden="true" className="type-supporting text-text-secondary">
                    {fillTemplate(
                      soldOut.length === 1 ? strings.soldOutNote.one : strings.soldOutNote.other,
                      { values: list.format(soldOut) }
                    )}
                  </span>
                )}
              </legend>
              {/* Height reserved for one line of the prompt (22px, 26px in Arabic) and its
                  6px of air, so the cells and Add to Bag never move when it appears. Not a
                  live region: the error toast announces it, once. */}
              <div className="clear-both min-h-7 pt-1.5 [&:lang(ar)]:min-h-8">
                {prompted && (
                  <p
                    id={promptId}
                    className="type-small flex items-start gap-2 font-medium text-danger"
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
              <div className="mt-1 flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const available = valueAvailable(option.key, value, selection, product.variants);
                  return (
                    <label
                      key={value}
                      data-unavailable={available ? undefined : ''}
                      className={CELL}
                    >
                      <input
                        type="radio"
                        name={name}
                        value={value}
                        checked={chosen === value}
                        onChange={() => {
                          if (prompt !== null) dismissToast(CHOOSE_OPTION_TOAST_ID);
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
          <div data-product-action className="mt-6">
            {action}
          </div>
        )}
      </div>
    </PurchaseSelectionContext>
  );
}
