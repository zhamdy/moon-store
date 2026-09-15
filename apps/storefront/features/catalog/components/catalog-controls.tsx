'use client';

import {
  Fragment,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  useTransition,
  type FocusEvent,
} from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { ChevronDown, CircleAlert, SlidersHorizontal, X } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/button';
import type { AppLocale } from '@/i18n/routing';
import { formatAmount } from '@/features/products/utils/price';
import { cn } from '@/lib/utils/cn';
import { fillTemplate } from '@/lib/utils/fill-template';
import {
  catalogParsers,
  defaultSortFor,
  normalizeCatalogParams,
  type CatalogParams,
  type CatalogRoute,
  type CatalogSort,
} from '../search-params';
import {
  INITIAL_CONTROLS_STATE,
  applyStaged,
  clearAllFilters,
  commitPatch,
  controlsReducer,
  focusAfterRemoval,
  formatPriceSummary,
  removeSummaryPart,
  summaryParts,
  validateStaged,
  type PriceSummaryTemplates,
  type SummaryPart,
} from './catalog-controls-state';

/** Every string arrives resolved; templates keep `{name}` for client-side values. */
export interface CatalogControlsStrings {
  filter: string;
  /** "{count} active" */
  filterActive: string;
  sheetTitle: string;
  close: string;
  availability: string;
  inStockOnly: string;
  inStock: string;
  price: string;
  min: string;
  max: string;
  /** "Pieces from 650 to 8,900 EGP", or `null` when the listing has no price range. */
  priceHint: string | null;
  priceNumberError: string;
  priceOrderError: string;
  priceMaxError: string;
  clearAll: string;
  apply: string;
  summaryLabel: string;
  /** "Remove: {filter}" */
  remove: string;
  clear: string;
  priceSummary: PriceSummaryTemplates;
  sort: string;
}

export interface CatalogControlsProps {
  route: CatalogRoute;
  locale: AppLocale;
  currencyLabel: string;
  /** "24 pieces" for the listing these props were rendered with; announced after a change. */
  resultCountText: string;
  /** The route's allowed sorts, labelled, in display order. */
  sortOptions: Array<{ value: CatalogSort; label: string }>;
  /** Formatted `priceRange` bounds, or `''` when unknown. */
  pricePlaceholders: { min: string; max: string };
  strings: CatalogControlsStrings;
}

const TEXT_CONTROL =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-text transition-colors duration-fast ease-ui';
const UNDERLINED =
  'underline decoration-text-secondary decoration-1 underline-offset-4 hover:decoration-text';
const BOTTOM_SHEET_QUERY = '(max-width: 767px)';

/**
 * The catalog's one interactive island (KD-14/KD-15): the active filter summary,
 * the Filter button and its sheet, and the sort select, all written to the URL
 * through nuqs with `shallow: false`, so the server re-renders the grid inside
 * this component's transition. `data-pending` on the root dims the grid through
 * the `[data-catalog]:has(...)` rule in app/globals.css.
 *
 * The root is `display: contents`: its children are items of the utility row
 * itself, so the summary can take its own line below 768 while Filter and Sort
 * stay beside the result count.
 */
export function CatalogControls({
  route,
  locale,
  currencyLabel,
  resultCountText,
  sortOptions,
  pricePlaceholders,
  strings,
}: CatalogControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useQueryStates(catalogParsers, {
    shallow: false,
    startTransition,
    clearOnDefault: true,
    scroll: false,
    history: 'push',
  });
  // nuqs updates this state as soon as a commit is made, before the server responds,
  // so the summary and the select reflect the change during the pending transition.
  const committed = normalizeCatalogParams(query, route);
  const parts = summaryParts(committed);

  const [sheet, dispatch] = useReducer(controlsReducer, INITIAL_CONTROLS_STATE);
  const validation = validateStaged(sheet.staged);

  const ids = useId();
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const removeRefs = useRef<Partial<Record<SummaryPart, HTMLButtonElement | null>>>({});
  const pendingFocus = useRef<SummaryPart | 'filter' | null>(null);
  const revealTimeout = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(revealTimeout.current), []);

  // Runs after every render: a removal re-renders the summary, then focus lands.
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    const element = target === 'filter' ? filterButtonRef.current : removeRefs.current[target];
    if (element) {
      pendingFocus.current = null;
      element.focus();
    }
  });

  // The live region is mounted empty and filled only when a transition settles, with
  // the count from the props that transition delivered. Adjusted during render (not
  // in an effect) so the announcement lands in the same commit as the new grid. An
  // identical count gets a trailing no-break space so it is announced again.
  const [announcement, setAnnouncement] = useState('');
  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (!isPending) {
      setAnnouncement(
        announcement === resultCountText ? `${resultCountText}\u00a0` : resultCountText
      );
    }
  }

  const commit = (next: CatalogParams) => {
    void setQuery(next);
  };

  const removePart = (part: SummaryPart) => {
    pendingFocus.current = focusAfterRemoval(parts, part);
    commit(removeSummaryPart(committed, part, route));
  };

  const clearFromSummary = () => {
    pendingFocus.current = 'filter';
    commit(clearAllFilters(committed, route));
  };

  const applyFromSheet = () => {
    const next = applyStaged(committed, sheet.staged, route);
    if (!next) {
      dispatch({ type: 'touch', field: 'min' });
      dispatch({ type: 'touch', field: 'max' });
      return;
    }
    // Headless UI returns focus to the Filter button as the dialog closes.
    dispatch({ type: 'close' });
    commit(next);
  };

  const clearFromSheet = () => {
    dispatch({ type: 'close' });
    commit(clearAllFilters(committed, route));
  };

  // Below 768 the sheet sits at the bottom, where the on-screen keyboard covers a
  // focused price input. Wait for the keyboard to open, then bring the field up.
  const revealField = (event: FocusEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    if (!window.matchMedia(BOTTOM_SHEET_QUERY).matches) return;
    // One pending reveal at a time: moving between the fields restarts the wait.
    window.clearTimeout(revealTimeout.current);
    revealTimeout.current = window.setTimeout(() => field.scrollIntoView({ block: 'center' }), 300);
  };

  const priceText = formatPriceSummary(committed, strings.priceSummary, currencyLabel, (amount) =>
    formatAmount(amount, locale)
  );
  const partLabel = (part: SummaryPart) => (part === 'stock' ? strings.inStock : (priceText ?? ''));

  const showMinError = sheet.touched.min && validation.minInvalid;
  const showMaxError = sheet.touched.max && validation.maxInvalid;
  const showTooHighError =
    (sheet.touched.min && validation.minTooHigh) || (sheet.touched.max && validation.maxTooHigh);
  const showOrderError =
    (sheet.touched.min || sheet.touched.max) && !validation.minInvalid && !validation.maxInvalid
      ? validation.orderInvalid
      : false;
  const errorText =
    showMinError || showMaxError
      ? strings.priceNumberError
      : showTooHighError
        ? strings.priceMaxError
        : showOrderError
          ? strings.priceOrderError
          : '';

  const sortId = `${ids}-sort`;
  const hintId = `${ids}-price-hint`;
  const errorId = `${ids}-price-error`;
  const describedBy = [strings.priceHint ? hintId : null, errorText ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-catalog-controls=""
      data-pending={isPending ? '' : undefined}
      aria-busy={isPending || undefined}
      className="contents"
    >
      {parts.length > 0 && (
        <div
          role="group"
          aria-label={strings.summaryLabel}
          className="type-small order-last flex basis-full flex-wrap items-center md:order-none md:ms-auto md:basis-auto"
        >
          {parts.map((part, index) => (
            <Fragment key={part}>
              {index > 0 && (
                <span aria-hidden="true" className="px-2 text-text-secondary">
                  ·
                </span>
              )}
              <button
                ref={(element) => {
                  removeRefs.current[part] = element;
                }}
                type="button"
                onClick={() => removePart(part)}
                aria-label={fillTemplate(strings.remove, { filter: partLabel(part) })}
                className={cn(TEXT_CONTROL, UNDERLINED, 'tabular-nums')}
              >
                {partLabel(part)}
                <X size={12} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </Fragment>
          ))}
          <button
            type="button"
            onClick={clearFromSummary}
            className={cn(TEXT_CONTROL, UNDERLINED, 'ms-5 text-text-secondary hover:text-text')}
          >
            {strings.clear}
          </button>
        </div>
      )}

      <button
        ref={filterButtonRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => dispatch({ type: 'open', committed })}
        className={cn(
          TEXT_CONTROL,
          'type-small group gap-2 ms-auto',
          parts.length > 0 && 'md:ms-0'
        )}
      >
        <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        <span className="decoration-1 underline-offset-4 group-hover:underline">
          {strings.filter}
        </span>
        {parts.length > 0 && (
          <>
            <span aria-hidden="true" className="tabular-nums">
              ({parts.length})
            </span>
            <span className="sr-only">
              {`, ${fillTemplate(strings.filterActive, { count: parts.length })}`}
            </span>
          </>
        )}
      </button>

      <div className="flex items-center gap-2">
        <label htmlFor={sortId} className="type-small text-text-secondary">
          {strings.sort}
        </label>
        <div className="relative">
          <select
            id={sortId}
            value={committed.sort ?? defaultSortFor(route)}
            onChange={(event) =>
              commit(commitPatch(committed, { sort: event.target.value as CatalogSort }, route))
            }
            className="type-small min-h-11 cursor-pointer appearance-none rounded-sm bg-transparent pe-6 text-text"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute end-0 top-1/2 -translate-y-1/2"
          />
        </div>
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      <Dialog
        open={sheet.open}
        onClose={() => dispatch({ type: 'close' })}
        transition
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-scrim transition-opacity duration-base ease-ui data-closed:opacity-0"
        />

        <div className="fixed inset-0 flex items-end md:items-stretch md:justify-end">
          <DialogPanel
            transition
            className={cn(
              'flex max-h-[85dvh] w-full flex-col bg-bg text-text md:h-full md:max-h-none md:w-[26rem]',
              'transition duration-base ease-ui data-closed:opacity-0',
              // Bottom sheet rises from below; the side sheet slides in from the inline end.
              'data-closed:translate-y-6 md:data-closed:translate-x-8 md:data-closed:translate-y-0 rtl:md:data-closed:-translate-x-8'
            )}
          >
            <div className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-border ps-5 pe-3 md:ps-8 md:pe-5">
              <DialogTitle
                as="h2"
                tabIndex={-1}
                data-autofocus
                className="type-h4 focus:outline-none"
              >
                {strings.sheetTitle}
              </DialogTitle>
              <button
                type="button"
                onClick={() => dispatch({ type: 'close' })}
                aria-label={strings.close}
                className="flex h-11 w-11 cursor-pointer items-center justify-center"
              >
                <X size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 md:px-8">
              <fieldset>
                <legend className="type-label text-text">{strings.availability}</legend>
                <label className="type-body mt-3 flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={sheet.staged.inStock}
                    onChange={(event) =>
                      dispatch({ type: 'stage', patch: { inStock: event.target.checked } })
                    }
                    className="size-5 shrink-0 cursor-pointer accent-action"
                  />
                  {strings.inStockOnly}
                </label>
              </fieldset>

              <fieldset className="mt-10 border-t border-border pt-8">
                <legend className="type-label float-start text-text">{strings.price}</legend>
                {strings.priceHint && (
                  <p id={hintId} className="type-small clear-both pt-2 text-text-secondary">
                    {strings.priceHint}
                  </p>
                )}
                <div className="clear-both grid grid-cols-2 gap-3 pt-5">
                  {(['min', 'max'] as const).map((field) => (
                    <div key={field}>
                      <label htmlFor={`${ids}-${field}`} className="type-small text-text-secondary">
                        {strings[field]}
                      </label>
                      <div
                        className={cn(
                          'mt-2 flex min-h-12 items-center rounded-sm border bg-bg',
                          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--focus-ring-color)',
                          (field === 'min' ? showMinError : showMaxError) || showOrderError
                            ? 'border-text'
                            : 'border-border'
                        )}
                      >
                        <input
                          id={`${ids}-${field}`}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          enterKeyHint="done"
                          value={sheet.staged[field]}
                          placeholder={pricePlaceholders[field]}
                          aria-invalid={
                            (field === 'min'
                              ? showMinError || (sheet.touched.min && validation.minTooHigh)
                              : showMaxError || (sheet.touched.max && validation.maxTooHigh)) ||
                            showOrderError
                          }
                          aria-describedby={describedBy || undefined}
                          onChange={(event) =>
                            dispatch({ type: 'stage', patch: { [field]: event.target.value } })
                          }
                          onBlur={() => dispatch({ type: 'touch', field })}
                          onFocus={revealField}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') applyFromSheet();
                          }}
                          className="type-body min-w-0 flex-1 bg-transparent py-2 ps-3 tabular-nums placeholder:text-text-secondary focus:outline-none"
                        />
                        <span className="type-small shrink-0 ps-2 pe-3 text-text-secondary">
                          {currencyLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Mounted empty so the error is announced when it appears. */}
                <div aria-live="polite" className="min-h-6 pt-3">
                  {errorText && (
                    <p id={errorId} className="type-small flex items-start gap-2 text-error">
                      <CircleAlert
                        size={16}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0"
                      />
                      {errorText}
                    </p>
                  )}
                </div>
              </fieldset>
            </div>

            <div className="flex shrink-0 items-center gap-6 border-t border-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={clearFromSheet}
                className={cn(TEXT_CONTROL, UNDERLINED, 'type-small shrink-0')}
              >
                {strings.clearAll}
              </button>
              <Button
                variant="primary"
                onClick={applyFromSheet}
                disabled={!validation.valid}
                className="flex-1"
              >
                {strings.apply}
              </Button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
