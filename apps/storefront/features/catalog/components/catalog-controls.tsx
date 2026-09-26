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
import { dismissToast, showToast } from '@/components/feedback/show-toast';
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
  applyPrice,
  applyStaged,
  clearAllFilters,
  commitPatch,
  controlsReducer,
  focusAfterRemoval,
  formatPriceSummary,
  removeSummaryPart,
  stagedFromParams,
  summaryParts,
  toggleStock,
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
  /** "Apply price", the index column's own price button. */
  applyPrice: string;
  summaryLabel: string;
  /** "Remove: {filter}" */
  remove: string;
  clear: string;
  priceSummary: PriceSummaryTemplates;
  sort: string;
}

/**
 * Where this instance sits ("Atelier", 2026-09-26). `toolbar` is the row above the grid:
 * below 1024 a sticky bar of Filter (the sheet) and Sort, the count and the active
 * filters under it; from 1024 the count and Sort, the filters being in the index column.
 * `index` is that column's inline filters, rendered from 1024 only. The listing renders
 * both, each with its own URL state and transition; nuqs keeps the URL the one source.
 */
export type CatalogControlsLayout = 'toolbar' | 'index';

export interface CatalogControlsProps {
  layout: CatalogControlsLayout;
  /** The toolbar's result count carries this id: the grid is described by it. */
  countId?: string;
  route: CatalogRoute;
  /**
   * What the server resolved this URL to. nuqs reads a repeated key's first
   * *occurrence* while the loader takes its first *valid* value, so the two disagree on
   * `?sort=best&sort=price-asc`: the grid sorted and this control showed the default
   * (MED-4). The server's resolution is the authority until the shopper commits a change
   * here, which also stops the next interaction serializing the default and silently
   * dropping the filter that was in effect.
   */
  resolved: CatalogParams;
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
const PRICE_ERROR_TOAST_ID = 'catalog-price-error';

/** Which price message shows, from the validation and which fields were left. */
function priceErrorText(
  validation: ReturnType<typeof validateStaged>,
  touched: { min: boolean; max: boolean },
  strings: CatalogControlsStrings
) {
  const showMin = touched.min && validation.minInvalid;
  const showMax = touched.max && validation.maxInvalid;
  const tooHigh = (touched.min && validation.minTooHigh) || (touched.max && validation.maxTooHigh);
  const order =
    (touched.min || touched.max) && !validation.minInvalid && !validation.maxInvalid
      ? validation.orderInvalid
      : false;
  const text =
    showMin || showMax
      ? strings.priceNumberError
      : tooHigh
        ? strings.priceMaxError
        : order
          ? strings.priceOrderError
          : '';
  return {
    text,
    minInvalid: showMin || (touched.min && validation.minTooHigh) || order,
    maxInvalid: showMax || (touched.max && validation.maxTooHigh) || order,
    minFrame: showMin || order,
    maxFrame: showMax || order,
  };
}

/**
 * The URL state both layouts share: nuqs with `shallow: false`, so the server
 * re-renders the grid inside this instance's transition, plus the settled-count
 * announcement. `data-pending` on an instance's root dims the grid through the
 * `[data-catalog]:has(...)` rule in app/globals.css, whichever instance committed.
 */
function useCatalogQuery(route: CatalogRoute, resolved: CatalogParams, resultCountText: string) {
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
  // Until then the server's resolution wins, because only it saw every occurrence of a
  // repeated key (MED-4).
  const [touched, setTouched] = useState(false);
  const committed = normalizeCatalogParams(touched ? query : resolved, route);

  // The live region is mounted empty and filled only when a transition settles, with
  // the count from the props that transition delivered. Adjusted during render (not
  // in an effect) so the announcement lands in the same commit as the new grid. An
  // identical count gets a trailing no-break space so it is announced again.
  const [announcement, setAnnouncement] = useState('');
  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (!isPending) {
      setAnnouncement(announcement === resultCountText ? `${resultCountText} ` : resultCountText);
    }
  }

  const commit = (next: CatalogParams) => {
    setTouched(true);
    void setQuery(next);
  };

  return { committed, isPending, commit, announcement };
}

/**
 * The catalog's one interactive island (KD-14/KD-15), rendered twice by the listing
 * ("Atelier", owner decision 2026-09-26; see `CatalogControlsLayout`): the toolbar above
 * the grid and the index column's inline filters. Every change is written to the URL
 * through nuqs, and the price rules are the pure `catalog-controls-state.ts` for both.
 */
export function CatalogControls(props: CatalogControlsProps) {
  return props.layout === 'index' ? <IndexControls {...props} /> : <ToolbarControls {...props} />;
}

/**
 * The toolbar. Its root is `display: contents`, so the bar is a direct child of the
 * rack column and can stick under the header for the column's whole height below
 * 1024 (where it is the only way to Filter and Sort); from 1024 it is a plain row.
 * The count is drawn twice — in the bar from 1024, under it below — and only the
 * visible one is ever read; the grid is described by the bar's, which carries `countId`.
 */
function ToolbarControls({
  countId,
  route,
  resolved,
  locale,
  currencyLabel,
  resultCountText,
  sortOptions,
  pricePlaceholders,
  strings,
}: CatalogControlsProps) {
  const { committed, isPending, commit, announcement } = useCatalogQuery(
    route,
    resolved,
    resultCountText
  );
  const parts = summaryParts(committed);
  const currentSort = committed.sort ?? defaultSortFor(route);

  const [sheet, dispatch] = useReducer(controlsReducer, INITIAL_CONTROLS_STATE);
  const validation = validateStaged(sheet.staged);

  const ids = useId();
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const sortRef = useRef<HTMLSelectElement>(null);
  const removeRefs = useRef<Partial<Record<SummaryPart, HTMLButtonElement | null>>>({});
  const pendingFocus = useRef<SummaryPart | 'filter' | null>(null);
  const revealTimeout = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(revealTimeout.current), []);

  // Runs after every render: a removal re-renders the summary, then focus lands. The
  // Filter button is not drawn from 1024 (the filters are in the index column), so
  // there the fallback is the sort control.
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    let element: HTMLElement | null | undefined =
      target === 'filter' ? filterButtonRef.current : removeRefs.current[target];
    if (element && element.getClientRects().length === 0) element = sortRef.current;
    if (element) {
      pendingFocus.current = null;
      element.focus();
    }
  });

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

  const error = priceErrorText(validation, sheet.touched, strings);

  // The toast is the price error's announcement (the inline garnet text stays, described by
  // the inputs); a new error replaces it, and fixing the fields or closing the sheet dismisses it.
  const priceErrorToast = sheet.open ? error.text : '';
  useEffect(() => {
    if (priceErrorToast) {
      showToast({ tone: 'error', message: priceErrorToast, id: PRICE_ERROR_TOAST_ID });
    } else {
      dismissToast(PRICE_ERROR_TOAST_ID);
    }
  }, [priceErrorToast]);

  const sortId = `${ids}-sort`;
  const hintId = `${ids}-price-hint`;
  const errorId = `${ids}-price-error`;
  const describedBy = [strings.priceHint ? hintId : null, error.text ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-catalog-controls=""
      data-pending={isPending ? '' : undefined}
      aria-busy={isPending || undefined}
      className="contents"
    >
      <div
        data-catalog-bar=""
        className="sticky top-(--header-h) z-20 -mx-(--page-gutter) flex min-h-(--size-control) items-stretch border-y border-border bg-bg lg:static lg:mx-0 lg:min-h-16 lg:items-center lg:justify-between lg:border-t-0"
      >
        <p id={countId} className="type-small hidden text-text-secondary tabular-nums lg:block">
          {resultCountText}
        </p>

        <button
          ref={filterButtonRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => dispatch({ type: 'open', committed })}
          className={cn(TEXT_CONTROL, 'type-ui group flex-1 justify-center gap-2 lg:hidden')}
        >
          <SlidersHorizontal size={18} strokeWidth={1.5} aria-hidden="true" />
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
        <span aria-hidden="true" className="my-3 w-px shrink-0 bg-border lg:hidden" />

        <div className="flex flex-1 items-center justify-center gap-2 lg:flex-none">
          <label htmlFor={sortId} className="type-small text-text-secondary">
            {strings.sort}
          </label>
          {/* The native select is laid transparently over its own label, so the control
              is as wide as the chosen option rather than the longest one. */}
          <div className="select-overlay inline-flex min-h-11 items-center gap-2 rounded-control lg:min-w-44 lg:justify-between lg:border lg:border-control lg:ps-3.5 lg:pe-3">
            <span aria-hidden="true" className="type-ui text-text">
              {sortOptions.find((option) => option.value === currentSort)?.label}
            </span>
            <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
            <select
              ref={sortRef}
              id={sortId}
              value={currentSort}
              onChange={(event) =>
                commit(commitPatch(committed, { sort: event.target.value as CatalogSort }, route))
              }
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'flex min-h-11 flex-wrap items-center gap-x-6 gap-y-1 pt-2',
          parts.length === 0 && 'lg:hidden'
        )}
      >
        <p className="type-small text-text-secondary tabular-nums lg:hidden">{resultCountText}</p>
        {parts.length > 0 && (
          <div
            role="group"
            aria-label={strings.summaryLabel}
            className="type-small flex flex-wrap items-center"
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
          className="fixed inset-0 bg-overlay transition-opacity duration-base ease-sheet data-closed:opacity-0"
        />

        <div className="fixed inset-0 flex items-end md:items-stretch md:justify-end">
          <DialogPanel
            transition
            className={cn(
              'flex max-h-[85dvh] w-full flex-col bg-surface text-text shadow-(--shadow-overlay) md:h-full md:max-h-none md:w-[26rem]',
              'transition duration-base ease-sheet data-closed:opacity-0',
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
                <label className="type-body mt-3 flex min-h-(--size-tap) cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={sheet.staged.inStock}
                    onChange={(event) =>
                      dispatch({ type: 'stage', patch: { inStock: event.target.checked } })
                    }
                    className="choice"
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
                <PriceFields
                  idPrefix={ids}
                  className="clear-both pt-5"
                  values={sheet.staged}
                  placeholders={pricePlaceholders}
                  error={error}
                  describedBy={describedBy}
                  currencyLabel={currencyLabel}
                  strings={strings}
                  onChange={(field, value) =>
                    dispatch({ type: 'stage', patch: { [field]: value } })
                  }
                  onBlur={(field) => dispatch({ type: 'touch', field })}
                  onFocus={revealField}
                  onEnter={applyFromSheet}
                />
                <PriceError id={errorId} text={error.text} />
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

/**
 * The index column's filters, from 1024 (hidden below, where the toolbar's sheet holds
 * them): availability applies on a tick; the price range is typed, then applied with
 * its own button or Enter, validated by the sheet's rules. The fields follow the URL,
 * so a change made elsewhere (the toolbar's summary, Back) resets them.
 */
function IndexControls({
  route,
  resolved,
  currencyLabel,
  resultCountText,
  pricePlaceholders,
  strings,
}: CatalogControlsProps) {
  const { committed, isPending, commit, announcement } = useCatalogQuery(
    route,
    resolved,
    resultCountText
  );
  const parts = summaryParts(committed);
  const ids = useId();

  const committedKey = `${committed.min ?? ''}|${committed.max ?? ''}`;
  const [syncedKey, setSyncedKey] = useState(committedKey);
  const [staged, setStaged] = useState(() => stagedFromParams(committed));
  const [touched, setTouched] = useState({ min: false, max: false });
  if (syncedKey !== committedKey) {
    setSyncedKey(committedKey);
    setStaged(stagedFromParams(committed));
    setTouched({ min: false, max: false });
  }

  const validation = validateStaged(staged);
  const error = priceErrorText(validation, touched, strings);

  const priceErrorToast = error.text;
  useEffect(() => {
    if (priceErrorToast) {
      showToast({ tone: 'error', message: priceErrorToast, id: PRICE_ERROR_TOAST_ID });
    } else {
      dismissToast(PRICE_ERROR_TOAST_ID);
    }
  }, [priceErrorToast]);

  const applyFromIndex = () => {
    const next = applyPrice(committed, staged, route);
    if (!next) {
      setTouched({ min: true, max: true });
      return;
    }
    commit(next);
  };

  const hintId = `${ids}-price-hint`;
  const errorId = `${ids}-price-error`;
  const describedBy = [strings.priceHint ? hintId : null, error.text ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      data-catalog-controls=""
      data-pending={isPending ? '' : undefined}
      aria-busy={isPending || undefined}
      role="group"
      aria-label={strings.sheetTitle}
      className="grid gap-9"
    >
      <fieldset>
        <legend className="type-label w-full border-b border-border pb-3 text-text-secondary">
          {strings.availability}
        </legend>
        <label className="type-ui mt-2 flex min-h-(--size-tap) cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={committed.stock === 'in'}
            onChange={(event) => commit(toggleStock(committed, event.target.checked, route))}
            className="choice"
          />
          {strings.inStockOnly}
        </label>
      </fieldset>

      <fieldset>
        <legend className="type-label w-full border-b border-border pb-3 text-text-secondary">
          {strings.price}
        </legend>
        {strings.priceHint && (
          <p id={hintId} className="type-supporting mt-3 text-text-secondary">
            {strings.priceHint}
          </p>
        )}
        <PriceFields
          idPrefix={ids}
          className="pt-4"
          values={staged}
          placeholders={pricePlaceholders}
          error={error}
          describedBy={describedBy}
          currencyLabel={currencyLabel}
          strings={strings}
          compact
          onChange={(field, value) => setStaged((current) => ({ ...current, [field]: value }))}
          onBlur={(field) => setTouched((current) => ({ ...current, [field]: true }))}
          onEnter={applyFromIndex}
        />
        <PriceError id={errorId} text={error.text} />
        <Button
          variant="secondary"
          size="sm"
          block
          onClick={applyFromIndex}
          disabled={!validation.valid}
          className="mt-1"
        >
          {strings.applyPrice}
        </Button>
      </fieldset>

      {parts.length > 0 && (
        <button
          type="button"
          onClick={() => commit(clearAllFilters(committed, route))}
          className={cn(TEXT_CONTROL, UNDERLINED, 'type-small justify-self-start')}
        >
          {strings.clearAll}
        </button>
      )}

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

interface PriceFieldsProps {
  idPrefix: string;
  className?: string;
  values: { min: string; max: string };
  placeholders: { min: string; max: string };
  error: ReturnType<typeof priceErrorText>;
  describedBy: string;
  currencyLabel: string;
  strings: CatalogControlsStrings;
  /** The index column's narrower fields: the currency affix tighter. */
  compact?: boolean;
  onChange: (field: 'min' | 'max', value: string) => void;
  onBlur: (field: 'min' | 'max') => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onEnter: () => void;
}

/** The two price inputs, shared by the sheet and the index column. */
function PriceFields({
  idPrefix,
  className,
  values,
  placeholders,
  error,
  describedBy,
  currencyLabel,
  strings,
  compact = false,
  onChange,
  onBlur,
  onFocus,
  onEnter,
}: PriceFieldsProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {(['min', 'max'] as const).map((field) => (
        <div key={field} className="min-w-0">
          <label htmlFor={`${idPrefix}-${field}`} className="type-field-label text-text-secondary">
            {strings[field]}
          </label>
          <div
            className="field-frame mt-2"
            data-invalid={(field === 'min' ? error.minFrame : error.maxFrame) ? '' : undefined}
          >
            <input
              id={`${idPrefix}-${field}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              value={values[field]}
              placeholder={placeholders[field]}
              aria-invalid={field === 'min' ? error.minInvalid : error.maxInvalid}
              aria-describedby={describedBy || undefined}
              onChange={(event) => onChange(field, event.target.value)}
              onBlur={() => onBlur(field)}
              onFocus={onFocus}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onEnter();
              }}
              className={cn('field-input tabular-nums', compact && 'min-w-0 ps-3')}
            />
            <span
              className={cn(
                'type-supporting shrink-0 text-text-secondary',
                compact ? 'pe-3' : 'pe-4'
              )}
            >
              {currencyLabel}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Height reserved; not a live region, since the error toast announces it. */
function PriceError({ id, text }: { id: string; text: string }) {
  return (
    <div className="min-h-6 pt-3">
      {text && (
        <p id={id} className="type-supporting flex items-start gap-2 font-medium text-danger">
          <CircleAlert size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
          {text}
        </p>
      )}
    </div>
  );
}
