/**
 * One line of the cart: name, per-unit price, optional memo, quantity stepper
 * and line total. Presentation only — every mutation is a callback up to the
 * cart store. Extracted from CartPanel (issue #51); markup unchanged.
 */
import { Button, Input } from '@heroui/react';
import { Minus, Plus, X, Pencil } from 'lucide-react';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import { lineKey } from '../../lib/cartLines';
import type { CartItem } from '../../store/cartStore';

export default function CartLineItem({
  item,
  isEditingMemo,
  onStartEditingMemo,
  onCommitMemo,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  isEditingMemo: boolean;
  onStartEditingMemo: () => void;
  onCommitMemo: (memo: string) => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      /* E2E: a cart line has no role and shows only the product name, so there is
         no accessible name to scope its per-line controls by. */
      data-testid={`cart-line-${lineKey(item)}`}
      className="flex items-center gap-3 p-3 bg-muted/20 hover:bg-muted/40 transition-colors rounded-lg border border-border/50"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
          <button
            onClick={onStartEditingMemo}
            className="p-0.5 rounded hover:bg-background transition-colors"
            title={t('cart.addMemo')}
          >
            <Pencil className={`h-3 w-3 ${item.memo ? 'text-primary' : 'text-muted-foreground'}`} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground font-data">{formatCurrency(item.unit_price)}</p>
        {item.memo && <p className="text-xs text-primary/80 mt-0.5">{item.memo}</p>}
        {isEditingMemo && (
          <Input
            autoFocus
            size="sm"
            variant="bordered"
            placeholder={t('cart.memoPlaceholder')}
            defaultValue={item.memo || ''}
            className="mt-1"
            onBlur={(e) => onCommitMemo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onCommitMemo((e.target as HTMLInputElement).value);
              }
            }}
          />
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="h-7 w-7"
          onPress={() => onQuantityChange(item.quantity - 1)}
          aria-label="Decrease quantity"
        >
          <Minus className="h-3.5 w-3.5 text-primary" />
        </Button>
        {/* E2E: a bare number with no accessible name. The +/- buttons are
            reachable by aria-label; the value itself is not. */}
        <span
          data-testid="cart-line-qty"
          className="w-7 text-center text-sm font-data font-medium text-foreground"
        >
          {item.quantity}
        </span>
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="h-7 w-7"
          onPress={() => onQuantityChange(item.quantity + 1)}
          isDisabled={item.quantity >= item.stock}
          aria-label="Increase quantity"
        >
          <Plus className="h-3.5 w-3.5 text-primary" />
        </Button>
      </div>
      <p className="text-sm font-semibold font-data w-20 text-end text-foreground">
        {formatCurrency(item.unit_price * item.quantity)}
      </p>
      <Button
        isIconOnly
        variant="light"
        color="danger"
        size="sm"
        className="h-7 w-7"
        onPress={onRemove}
        aria-label="Remove item"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
