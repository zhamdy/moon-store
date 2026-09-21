'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CircleAlert, ShoppingBag, X } from 'lucide-react';
import { dismissToast, showToast } from '@/components/feedback/show-toast';
import { Button } from '@/components/ui/button';
import { BAG_HREF } from '@/components/layout/navigation-items';
import {
  displayedPrice,
  initialSelection,
  purchaseReadiness,
  valueAvailable,
  type Selection,
} from '@/features/products/utils/variant-selection';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { fillTemplate } from '@/lib/utils/fill-template';
import { useCartActions } from '../store/cart-store';
import { addToBagIntent, addToBagToast } from '../utils/add-to-bag-action';
import type { QuickAddStrings } from '../utils/bag-strings';
import { quickAddPress, type QuickAddModel } from '../utils/quick-add-model';

export interface QuickAddProps {
  product: QuickAddModel;
  strings: QuickAddStrings;
  /**
   * `brand` (default) is the bronze hairline a tile carries — a row of filled blocks
   * would read as a marketplace grid. `solid` fills it, for the one lead card in a
   * composition, which is the only place a second weight earns its keep.
   */
  emphasis?: 'brand' | 'solid';
}

/** One id per surface: a second press replaces the notice rather than stacking toasts. */
const CHOOSE_TOAST_ID = 'quick-add-choose';

// The option cell, the product page's (`purchase-panel.tsx`): a visually hidden radio
// whose label draws the state and the focus ring, 44px so a thumb can hit it. Sold-out
// values stay enabled and findable — dashed, struck through and named to a screen reader.
const CELL = [
  'relative flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-media-sm border border-border px-3',
  'transition-colors duration-fast ease-ui',
  'hover:border-text has-checked:border-text has-checked:shadow-[inset_0_0_0_1px_var(--color-text)]',
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-solid has-focus-visible:outline-(--focus-ring-color)',
].join(' ');

/**
 * Add to Bag on a product card, with Quick Add (the twentieth client boundary; owner
 * brief 2026-09-20). It is the product page's purchase behaviour compressed into a card
 * and **not a second cart**: the rules are `variant-selection.ts`, the intent and the
 * acknowledgement are `add-to-bag-action.ts`, and the write is the one `cart-store`
 * `add`. Only the composition is new.
 *
 * One press:
 *
 * - **Nothing to choose** (no options, or every option single-valued) — adds one piece
 *   and raises the add toast with View bag, exactly as the product page does.
 * - **A choice is required** — opens the Quick Add panel. No size is ever chosen for the
 *   shopper, and the panel carries the *required options only*: it is not a small PDP.
 * - **Sold out** — the button stays focusable and `aria-disabled`, reading "Sold out"
 *   (never `disabled`, which would hide it from a keyboard).
 *
 * The panel is anchored under the button rather than in the card's flow, so opening one
 * card's options never reflows the grid or the rail around it. Escape and a pointer
 * outside close it and return focus to the button; opening moves focus to the first
 * group that still needs an answer. Pressing Add to Bag with a group unanswered focuses
 * that group and names it, inline and as one error toast — the product page's pattern.
 *
 * The quantity is one piece per press: the stepper belongs on the product page, and a
 * card that carries one has stopped being a card.
 */
export function QuickAdd({ product, strings, emphasis = 'brand' }: QuickAddProps) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const actions = useCartActions();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product.options));
  const [prompt, setPrompt] = useState<{ key: string; text: string } | null>(null);

  const readiness = useMemo(() => purchaseReadiness(selection, product), [selection, product]);
  const press = quickAddPress(readiness);
  /**
   * The group's legend. `size` and `color` are the two keys the storefront translates
   * (the product page's `TRANSLATED_KEYS`); any other key keeps the staff's own label,
   * which may be in either language and so is rendered `dir="auto"`.
   */
  const legendOf = useCallback(
    (key: string, label: string): { text: string; staff: boolean } =>
      key === 'size'
        ? { text: strings.optionLabels.size, staff: false }
        : key === 'color'
          ? { text: strings.optionLabels.color, staff: false }
          : { text: label, staff: true },
    [strings.optionLabels]
  );

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setPrompt(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /** Focuses the group that still needs an answer, and names it inline and in a toast. */
  const askFor = useCallback(
    (key: string) => {
      const index = product.options.findIndex((option) => option.key === key);
      if (index < 0) return;
      const group = rootRef.current?.querySelector(`[data-option-index="${index}"]`);
      const radio =
        group?.querySelector<HTMLInputElement>('input[type="radio"]:checked') ??
        group?.querySelector<HTMLInputElement>('input[type="radio"]');
      radio?.focus();
      const text = fillTemplate(strings.chooseOption, {
        option: legendOf(key, product.options[index]!.label).text,
      });
      setPrompt({ key, text });
      showToast({ tone: 'error', message: text, id: CHOOSE_TOAST_ID });
    },
    [product.options, strings.chooseOption, legendOf]
  );

  const add = useCallback(() => {
    const intent = addToBagIntent(readiness, product.slug, 1);
    if (intent.kind === 'focusSelection') {
      askFor(intent.key);
      return;
    }
    if (intent.kind !== 'add') return;
    const price = displayedPrice(selection, product);
    const result = actions.add(intent.identity, {
      quantity: 1,
      hint: {
        name: product.name,
        imageUrl: product.imageUrl,
        unitPrice: price.kind === 'exact' ? price.price : null,
      },
    });
    const { tone, message, id } = addToBagToast(result, product.name.text, strings, 1);
    showToast({
      tone,
      message,
      id,
      action: { label: strings.viewBag, onClick: () => router.push(BAG_HREF) },
    });
    if (open) close(true);
  }, [readiness, product, selection, actions, strings, router, askFor, open, close]);

  const onTrigger = () => {
    if (press === 'soldOut') return;
    if (press === 'add') {
      add();
      return;
    }
    if (open) {
      close(true);
      return;
    }
    setOpen(true);
    // The panel is rendered by this same commit, so the focus move waits for it.
    requestAnimationFrame(() => {
      if (readiness.kind === 'needsSelection' && readiness.keys[0]) askFor(readiness.keys[0]);
    });
  };

  // Escape and a pointer outside close the panel. Both are registered only while it is
  // open, so a page of 24 cards carries no listeners until one is opened.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        dismissToast(CHOOSE_TOAST_ID);
        close(true);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  const namedLabel = fillTemplate(
    press === 'choose' ? strings.chooseOptions : strings.addToBagLabel,
    { name: product.name.text }
  );

  return (
    // z-10 keeps the action above the title link's card-wide overlay (product-card.tsx),
    // and `relative` anchors the panel to the button rather than to the card's flow.
    // `data-open` is what keeps the card's revealed action on screen while its panel
    // is open (`[data-card-action]` in app/globals.css): a pointer that has left the
    // card to reach the panel must not take the options away with it. Spacing above
    // the button belongs to the card's action slot, not here - it is zero where the
    // action sits on the photograph.
    <div
      ref={rootRef}
      data-quick-add=""
      data-open={open ? '' : undefined}
      className="relative z-10"
    >
      <Button
        ref={triggerRef}
        variant={emphasis === 'solid' ? 'primary' : 'brand'}
        onClick={onTrigger}
        aria-disabled={press === 'soldOut' || undefined}
        aria-label={press === 'soldOut' ? undefined : namedLabel}
        // The disclosure exists for as long as the product has options, even once every
        // group is answered and one more press would add.
        aria-expanded={product.options.length > 0 ? open : undefined}
        aria-controls={open ? panelId : undefined}
        // Opaque rather than the `brand` variant's transparent fill: the same button
        // is read over a photograph once the card reveals it, where a hairline alone
        // has nothing behind it. The bronze fill on hover is the variant's own.
        className={cn('type-label w-full gap-2 px-4', emphasis === 'brand' && 'bg-surface')}
      >
        {press === 'soldOut' ? (
          strings.soldOut
        ) : (
          <>
            <ShoppingBag size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
            {strings.addToBag}
          </>
        )}
      </Button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={namedLabel}
          className={cn(
            'absolute inset-x-0 top-full z-20 mt-2 border border-border bg-surface p-4',
            // The panel is the one place on a card that sits over its neighbours, so it
            // carries a hairline and the warm surface rather than a shadow.
            'motion-safe:animate-quick-add'
          )}
        >
          <button
            type="button"
            onClick={() => close(true)}
            aria-label={strings.closeOptions}
            className="absolute end-2 top-2 flex size-8 items-center justify-center text-text-secondary transition-colors duration-fast ease-ui hover:text-text"
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>

          {product.options.map((option, optionIndex) => {
            const { text: legend, staff } = legendOf(option.key, option.label);
            const chosen = selection[option.key] ?? null;
            const name = `${baseId}-option-${optionIndex}`;
            const promptId = `${name}-prompt`;
            const prompted = prompt?.key === option.key;
            return (
              <fieldset
                key={option.key}
                data-option-index={optionIndex}
                aria-describedby={prompted ? promptId : undefined}
                className={optionIndex === 0 ? 'min-w-0' : 'mt-4 min-w-0'}
              >
                <legend className="type-label pe-8 text-text-secondary">
                  <span dir={staff ? 'auto' : undefined}>
                    {chosen === null
                      ? fillTemplate(strings.chooseOption, { option: legend })
                      : fillTemplate(strings.selected, { option: legend, value: chosen })}
                  </span>
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const available = valueAvailable(
                      option.key,
                      value,
                      selection,
                      product.variants
                    );
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
                            if (prompt !== null) dismissToast(CHOOSE_TOAST_ID);
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
                {prompted && (
                  <p
                    id={promptId}
                    className="type-caption mt-2 flex items-start gap-1.5 font-medium text-error"
                  >
                    <CircleAlert
                      size={14}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />
                    {prompt.text}
                  </p>
                )}
              </fieldset>
            );
          })}

          <Button
            variant="primary"
            onClick={add}
            aria-label={fillTemplate(strings.addToBagLabel, { name: product.name.text })}
            className="type-label mt-4 w-full px-4"
          >
            {strings.addToBag}
          </Button>
        </div>
      )}
    </div>
  );
}
