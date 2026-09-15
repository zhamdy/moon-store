import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { ProductImagePlaceholder } from '@/features/products/components/product-image-placeholder';
import { langProps } from '@/features/products/utils/localized-name';
import { formatPrice } from '@/features/products/utils/price';
import { cn } from '@/lib/utils/cn';
import { fillTemplate } from '@/lib/utils/fill-template';
import type { BagLineStrings } from '../utils/bag-strings';
import {
  lineStepper,
  noticeText,
  optionText,
  rowName,
  stepperCommitValue,
  stepperLimitText,
} from '../utils/bag-view-model';
import type { BagRow } from '../utils/reconcile';
import { QuantityStepper } from './quantity-stepper';

export type CartLineVariant = 'drawer' | 'page';

/** 72px 4:5 frames in the drawer; the page widens to 120px from 768. */
const FRAME: Record<CartLineVariant, string> = { drawer: 'w-18', page: 'w-18 md:w-30' };
const IMAGE_SIZES: Record<CartLineVariant, string> = {
  drawer: '72px',
  page: '(min-width: 768px) 120px, 72px',
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
 * One bag line, shared by the drawer and the bag page. Hairline-separated by its list, no
 * card. The photograph is decorative (the name beside it is the link). Stock and price
 * verdicts come from `reconcileBag`; nothing here computes a price. A row no quote has seen
 * still shows its options, stepper and Remove; only name, photo and price are placeholders.
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
    <Heading className={cn('type-body min-w-0 font-body break-words', name === null && 'flex-1')}>
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
  const lineTotal = (className: string) =>
    (row.lineTotal !== null || awaiting) && (
      <p className={className}>
        <BagFigure
          value={
            row.lineTotal === null ? null : formatPrice(row.lineTotal, locale, strings.currency)
          }
          stale={awaiting}
          label={strings.lineTotal}
          updating={strings.updating}
          placeholderClassName="w-16"
        />
      </p>
    );
  const details = (
    <>
      {options && <p className="type-small mt-1 text-text-secondary">{options}</p>}
      {row.unitPrice !== null ? (
        <p className="type-small mt-1 text-text-secondary tabular-nums">
          <span className="sr-only">{strings.unitPrice} </span>
          <span key="price" data-bag-reveal="">
            {formatPrice(row.unitPrice, locale, strings.currency)}
          </span>
        </p>
      ) : (
        awaiting && (
          <p className="type-small mt-1 flex h-lh items-center">
            <BagPlaceholder key="placeholder" className="h-[0.7lh] w-1/4" />
          </p>
        )
      )}
    </>
  );
  const notices = row.notices.length > 0 && (
    <ul className="type-small mt-2 space-y-0.5 text-text">
      {row.notices.map((notice) => (
        <li key={notice.kind}>{noticeText(notice, strings)}</li>
      ))}
    </ul>
  );
  const quantityStepper = row.status !== 'productUnavailable' && (
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
  const removeButton = (className: string) => (
    <button
      ref={row.product ? undefined : focusRef}
      type="button"
      onClick={() => onRemove(row, displayName)}
      aria-label={fillTemplate(strings.removeLabel, { name: displayName })}
      className={cn(
        'type-small inline-flex min-h-11 cursor-pointer items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text',
        className
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
        variant === 'page' && 'md:gap-6 md:py-7'
      )}
    >
      <div
        className={cn(
          'relative isolate aspect-4/5 shrink-0 self-start overflow-hidden rounded-media-sm',
          !photoUnknown && 'bg-surface-soft',
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

      {variant === 'drawer' ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-x-4">
            {heading}
            {lineTotal('type-body shrink-0')}
          </div>
          {details}
          {notices}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {quantityStepper}
            {removeButton('ms-auto')}
          </div>
        </div>
      ) : (
        // One DOM order for both layouts. Below 768 it stacks: text, the line total under
        // the unit price, then stepper and Remove on one row. From 768 the grid places the
        // stepper in its own column and the total at the inline end, Remove under the text.
        <div className="grid min-w-0 flex-1 grid-cols-1 content-start md:grid-cols-[minmax(0,1fr)_auto_minmax(6rem,auto)] md:gap-x-8">
          <div className="min-w-0 md:col-start-1 md:row-start-1">
            {heading}
            {details}
            {lineTotal('type-body mt-1 md:hidden')}
            {notices}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 md:contents">
            {quantityStepper && (
              <div className="md:col-start-2 md:row-start-1 md:self-start">{quantityStepper}</div>
            )}
            {removeButton(
              'ms-auto md:col-start-1 md:row-start-2 md:ms-0 md:mt-2 md:justify-self-start'
            )}
          </div>
          {lineTotal(
            'type-body hidden md:col-start-3 md:row-start-1 md:block md:pt-0.5 md:text-end'
          )}
        </div>
      )}
    </li>
  );
}
