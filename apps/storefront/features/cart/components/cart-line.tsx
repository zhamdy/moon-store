import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { StatusText } from '@/components/ui/status';
import { ProductImagePlaceholder } from '@/features/products/components/product-image-placeholder';
import { langProps } from '@/features/products/utils/localized-name';
import { formatPrice } from '@/features/products/utils/price';
import { cn } from '@/lib/utils/cn';
import { fillTemplate } from '@/lib/utils/fill-template';
import type { BagLineStrings } from '../utils/bag-strings';
import {
  lineHasStepper,
  linePriceDisplay,
  lineStepper,
  noticeText,
  optionText,
  rowName,
  stepperCommitValue,
  stepperLimitText,
} from '../utils/bag-view-model';
import type { BagNotice, BagRow } from '../utils/reconcile';
import { QuantityStepper } from './quantity-stepper';

const NOTICE_TONE: Record<BagNotice['kind'], 'notice' | 'danger'> = {
  quantityLimited: 'notice',
  priceUpdated: 'notice',
  soldOut: 'danger',
  variantUnavailable: 'danger',
  productUnavailable: 'danger',
};

export type CartLineVariant = 'drawer' | 'page';

/**
 * 4:5 frames: 80px in the drawer; 96px on the page (each 16px less under 360, so the stepper and
 * Remove keep one row at 320), 128px from 768 ("Fitting room").
 */
const FRAME: Record<CartLineVariant, string> = {
  drawer: 'w-16 min-[360px]:w-20',
  page: 'w-20 min-[360px]:w-24 md:w-32',
};
const IMAGE_SIZES: Record<CartLineVariant, string> = {
  drawer: '80px',
  page: '(min-width: 768px) 128px, 96px',
};

/**
 * A loading shape: appears after 150ms and breathes (`[data-bag-placeholder]` in
 * globals.css). Never the brand mark, which means "no photograph", not "loading".
 */
export function BagPlaceholder({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-bag-placeholder=""
      className={cn('block bg-surface-soft', className)}
    />
  );
}

export interface BagFigureProps {
  /** The formatted quoted figure, or null when no quote has priced it yet. */
  value: string | null;
  /** The figure is the previous quote's while a new one loads: dimmed and busy. */
  stale: boolean;
  /** Visually hidden lead-in ("Total"). */
  label?: string;
  updating: string;
  className?: string;
  placeholderClassName?: string;
}

/**
 * A subtotal or line total. Stale figures stay in place, dimmed, so nothing blanks or
 * changes width between stepper presses; the value span persists, so its fade-in never replays.
 */
export function BagFigure({
  value,
  stale,
  label,
  updating,
  className,
  placeholderClassName = 'w-20',
}: BagFigureProps) {
  const busy = value === null || stale;
  return (
    <span
      aria-busy={busy || undefined}
      className={cn(
        'tabular-nums transition-colors duration-fast ease-ui',
        stale && 'text-text-secondary',
        className
      )}
    >
      {label && <span className="sr-only">{label} </span>}
      {value === null ? (
        <BagPlaceholder
          key="placeholder"
          className={cn('inline-block h-[0.8lh] align-middle', placeholderClassName)}
        />
      ) : (
        <span key="value" data-bag-reveal="">
          {value}
        </span>
      )}
      {busy && <span className="sr-only"> {updating}</span>}
    </span>
  );
}

export interface CartLineProps {
  row: BagRow;
  variant: CartLineVariant;
  locale: AppLocale;
  strings: BagLineStrings;
  /** A re-quote is in flight. */
  pending: boolean;
  /** Fading out before it unmounts. */
  removing?: boolean;
  /** Receives where focus lands after a neighbour is removed: the name link, else Remove. */
  focusRef?: (element: HTMLElement | null) => void;
  onQuantityChange(key: string, quantity: number, name: string): void;
  onRemove(row: BagRow, name: string): void;
  /** Called when the name link is followed (the drawer closes). */
  onNavigate?(): void;
}

/**
 * One bag line, shared by the drawer and the bag page ("Fitting room", 2026-09-27): the 4:5
 * photograph on the Stone mat, then the name with the line total at the end of its row, the
 * options, the unit price only when there is more than one ("3,200 EGP each"), any notice,
 * and the stepper with Remove at the foot. A line that can no longer be bought keeps its
 * photograph and its price (in secondary ink, where the total would be) and loses its
 * stepper. Hairline-separated by its list, no card; the photograph is decorative (the name
 * is the link). Figures come from `reconcileBag` through `linePriceDisplay`; nothing here
 * computes a price. A row no quote has seen still shows its options, stepper and Remove;
 * only name, photo and price are placeholders.
 */
export function CartLine({
  row,
  variant,
  locale,
  strings,
  pending,
  removing = false,
  focusRef,
  onQuantityChange,
  onRemove,
  onNavigate,
}: CartLineProps) {
  const name = rowName(row, locale, strings.unavailablePiece);
  const displayName = name?.text ?? strings.pendingPiece;
  const awaiting = row.status === 'pending';

  const Heading = variant === 'page' ? 'h2' : 'h3';
  const options = optionText(row.options, strings);
  const stepper = lineStepper(row, pending);
  const step = (delta: 1 | -1) => {
    const next = stepperCommitValue(row.line.quantity, stepper, delta);
    if (next !== null) onQuantityChange(row.key, next, displayName);
  };

  const heading = (
    <Heading
      className={cn(
        'type-body min-w-0 font-body font-medium break-words',
        name === null && 'flex-1'
      )}
    >
      {name === null ? (
        <>
          <span className="sr-only">{strings.pendingPiece}</span>
          <span aria-hidden="true" className="flex h-lh items-center">
            <BagPlaceholder className="h-[0.7lh] w-3/5" />
          </span>
        </>
      ) : (
        // Keyed wrapper: a hint name becoming the quoted name does not replay the fade.
        <span key="name" data-bag-reveal="">
          {row.product ? (
            <Link
              ref={focusRef}
              href={`/products/${row.product.slug}`}
              onClick={onNavigate}
              {...langProps(name, locale)}
              className="decoration-1 underline-offset-4 hover:underline"
            >
              {name.text}
            </Link>
          ) : (
            <span {...langProps(name, locale)}>{name.text}</span>
          )}
        </span>
      )}
    </Heading>
  );
  const figures = linePriceDisplay(row);
  const endFigure = figures.total ? (
    <p className="type-body shrink-0 font-medium">
      <BagFigure
        value={
          figures.total.value === null
            ? null
            : formatPrice(figures.total.value, locale, strings.currency)
        }
        stale={figures.total.stale}
        label={strings.lineTotal}
        updating={strings.updating}
        placeholderClassName="w-16"
      />
    </p>
  ) : figures.excludedPrice !== null ? (
    // Not in the subtotal: the price stays, in secondary ink, where the total would be.
    <p className="type-body shrink-0 text-text-secondary tabular-nums">
      <span className="sr-only">{strings.unitPrice} </span>
      <span key="price" data-bag-reveal="">
        {formatPrice(figures.excludedPrice, locale, strings.currency)}
      </span>
    </p>
  ) : null;
  const details = (
    <>
      {options && <p className="type-supporting mt-1 text-text-secondary">{options}</p>}
      {figures.unit ? (
        <p className="type-supporting text-text-secondary tabular-nums">
          <span className="sr-only">{strings.unitPrice} </span>
          <span key="price" data-bag-reveal="">
            {figures.unit.each
              ? fillTemplate(strings.each, {
                  price: formatPrice(figures.unit.amount, locale, strings.currency),
                })
              : formatPrice(figures.unit.amount, locale, strings.currency)}
          </span>
        </p>
      ) : (
        awaiting &&
        figures.total?.value == null &&
        row.unitPrice === null && (
          <p className="type-supporting mt-1 flex h-lh items-center">
            <BagPlaceholder key="placeholder" className="h-[0.7lh] w-1/4" />
          </p>
        )
      )}
    </>
  );
  const notices = row.notices.length > 0 && (
    <ul className="mt-2 space-y-1">
      {row.notices.map((notice) => (
        <li key={notice.kind}>
          {/* Stock and price changes are a notice (bronze); a piece that can no longer be
              bought is danger. A dot and the words, never colour alone. */}
          <StatusText tone={NOTICE_TONE[notice.kind]}>{noticeText(notice, strings)}</StatusText>
        </li>
      ))}
    </ul>
  );
  const quantityStepper = lineHasStepper(row) && (
    <QuantityStepper
      value={stepper.value}
      control={stepper.control}
      labels={{
        group: fillTemplate(strings.quantity, { name: displayName }),
        decrease: fillTemplate(strings.decrease, { name: displayName }),
        increase: fillTemplate(strings.increase, { name: displayName }),
        limit: stepperLimitText(stepper.control, strings),
      }}
      onStep={step}
    />
  );
  const removeButton = (
    <button
      ref={row.product ? undefined : focusRef}
      type="button"
      onClick={() => onRemove(row, displayName)}
      aria-label={fillTemplate(strings.removeLabel, { name: displayName })}
      className={cn(
        'type-supporting inline-flex min-h-(--size-tap) cursor-pointer items-center text-text-secondary underline decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:text-danger',
        // In the drawer, and on a phone, Remove sits at the row's inline end; on the page
        // from 768 it follows the stepper.
        variant === 'drawer' ? 'ms-auto' : 'ms-auto md:ms-0'
      )}
    >
      {strings.remove}
    </button>
  );

  const imageUrl = row.product?.image?.url ?? row.provisional?.imageUrl ?? null;
  // Nothing names the row yet, so its photograph is unknown rather than missing.
  const photoUnknown = name === null;

  return (
    <li
      data-removing={removing ? '' : undefined}
      className={cn(
        'relative flex gap-4 py-5 transition-opacity duration-fast ease-ui data-removing:opacity-0',
        variant === 'page' && 'md:gap-6 md:py-6'
      )}
    >
      <div
        className={cn(
          'relative isolate aspect-4/5 shrink-0 self-start overflow-hidden rounded-media-sm',
          !photoUnknown && 'bg-surface-media',
          FRAME[variant]
        )}
      >
        {imageUrl ? (
          <Image
            key="photo"
            src={imageUrl}
            alt=""
            fill
            sizes={IMAGE_SIZES[variant]}
            data-bag-reveal=""
            className="object-cover"
          />
        ) : photoUnknown ? (
          <BagPlaceholder key="placeholder" className="absolute inset-0" />
        ) : (
          <ProductImagePlaceholder key="mark" />
        )}
      </div>

      {/* One column in both surfaces: the name row, the lines under it, then the controls
          pushed to the photograph's foot. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-x-4">
          {heading}
          {endFigure}
        </div>
        {details}
        {notices}
        <div
          className={cn(
            'mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3',
            variant === 'page' && 'md:gap-x-6 md:pt-4'
          )}
        >
          {quantityStepper}
          {removeButton}
        </div>
      </div>
    </li>
  );
}
