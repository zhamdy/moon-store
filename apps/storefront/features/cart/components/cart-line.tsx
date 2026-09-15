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

export interface CartLineProps {
  row: BagRow;
  variant: CartLineVariant;
  locale: AppLocale;
  strings: BagLineStrings;
  /** A re-quote is in flight. */
  pending: boolean;
  /** The line an `added` or capped opening points at: hairline marker plus "Just added". */
  justAdded?: boolean;
  /** Fading out before it unmounts. */
  removing?: boolean;
  rowRef?: (element: HTMLLIElement | null) => void;
  /** Receives where focus lands after a neighbour is removed: the name link, else Remove. */
  focusRef?: (element: HTMLElement | null) => void;
  onQuantityChange(key: string, quantity: number, name: string): void;
  onRemove(row: BagRow, name: string): void;
  /** Called when the name link is followed (the drawer closes). */
  onNavigate?(): void;
}

export function CartLineSkeleton({ variant }: { variant: CartLineVariant }) {
  return (
    <li aria-hidden="true" className="flex gap-4 py-5">
      <div className={cn('aspect-4/5 shrink-0 rounded-media-sm bg-surface-soft', FRAME[variant])} />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-4 w-3/5 bg-surface-soft" />
        <div className="h-3 w-1/4 bg-surface-soft" />
      </div>
    </li>
  );
}

/**
 * One bag line, shared by the drawer and the bag page. Hairline-separated by its list, no
 * card. The photograph is decorative (the name beside it is the link). Stock and price
 * verdicts come from `reconcileBag`; nothing here computes a price.
 */
export function CartLine({
  row,
  variant,
  locale,
  strings,
  pending,
  justAdded = false,
  removing = false,
  rowRef,
  focusRef,
  onQuantityChange,
  onRemove,
  onNavigate,
}: CartLineProps) {
  const name = rowName(row, locale, strings.unavailablePiece);
  if (name === null) return <CartLineSkeleton variant={variant} />;

  const Heading = variant === 'page' ? 'h2' : 'h3';
  const options = optionText(row.options, strings);
  const stepper = lineStepper(row, pending);
  const step = (delta: 1 | -1) => {
    const next = stepperCommitValue(row.line.quantity, stepper, delta);
    if (next !== null) onQuantityChange(row.key, next, name.text);
  };

  const heading = (
    <Heading className="type-body min-w-0 font-body break-words">
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
    </Heading>
  );
  const lineTotal = (className: string) =>
    row.lineTotal !== null && (
      <p className={className}>
        <span className="sr-only">{strings.lineTotal} </span>
        {formatPrice(row.lineTotal, locale, strings.currency)}
      </p>
    );
  const details = (
    <>
      {justAdded && <p className="sr-only">{strings.justAdded}</p>}

      {options && <p className="type-small mt-1 text-text-secondary">{options}</p>}
      {row.unitPrice !== null && (
        <p className="type-small mt-1 text-text-secondary tabular-nums">
          <span className="sr-only">{strings.unitPrice} </span>
          {formatPrice(row.unitPrice, locale, strings.currency)}
        </p>
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
        group: fillTemplate(strings.quantity, { name: name.text }),
        decrease: fillTemplate(strings.decrease, { name: name.text }),
        increase: fillTemplate(strings.increase, { name: name.text }),
        limit: stepperLimitText(stepper.control, strings),
      }}
      onStep={step}
    />
  );
  const removeButton = (className: string) => (
    <button
      ref={row.product ? undefined : focusRef}
      type="button"
      onClick={() => onRemove(row, name.text)}
      aria-label={fillTemplate(strings.removeLabel, { name: name.text })}
      className={cn(
        'type-small inline-flex min-h-11 cursor-pointer items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text',
        className
      )}
    >
      {strings.remove}
    </button>
  );

  return (
    <li
      ref={rowRef}
      data-removing={removing ? '' : undefined}
      className={cn(
        'relative flex gap-4 py-5 transition-opacity duration-fast ease-ui data-removing:opacity-0',
        variant === 'page' && 'md:gap-6 md:py-7'
      )}
    >
      {justAdded && (
        <span aria-hidden="true" className="absolute inset-y-5 -start-3 w-px bg-text" />
      )}

      <div
        className={cn(
          'relative isolate aspect-4/5 shrink-0 self-start overflow-hidden rounded-media-sm bg-surface-soft',
          FRAME[variant]
        )}
      >
        {row.product?.image ? (
          <Image
            src={row.product.image.url}
            alt=""
            fill
            sizes={IMAGE_SIZES[variant]}
            className="object-cover"
          />
        ) : (
          <ProductImagePlaceholder />
        )}
      </div>

      {variant === 'drawer' ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-x-4">
            {heading}
            {lineTotal('type-body shrink-0 tabular-nums')}
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
            {lineTotal('type-body mt-1 tabular-nums md:hidden')}
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
            'type-body hidden tabular-nums md:col-start-3 md:row-start-1 md:block md:pt-0.5 md:text-end'
          )}
        </div>
      )}
    </li>
  );
}
